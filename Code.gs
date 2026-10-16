/**
 * 拾光記帳 V1.7 — Google Sheets backend / direct hosted app (standalone Apps Script project).
 * Step 1: Update SHEET_ID + ALLOWED_ORIGIN below.
 * Step 2: Run setupDaybook() and COPY the generated sync key from execution log.
 * Step 3: Deploy web app: execute as Me; access Anyone (for the protected bridge).
 * NEVER paste the sync key into GitHub files, Apps Script code, or share screenshots.
 */
const DAYBOOK_CONFIG = {
  SHEET_ID: '請貼上你自己的Google試算表ID',
  ALLOWED_ORIGIN: 'https://zinrow2005-cell.github.io',
  PREFIX: 'DAYBOOK_'
};
const DAYBOOK_LIMIT = 80;

function setupDaybook() {
  if (!/^[\w-]{20,}$/.test(DAYBOOK_CONFIG.SHEET_ID)) throw Error('請先填入真實 Google 試算表 ID');
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(DAYBOOK_CONFIG.ALLOWED_ORIGIN)) throw Error('ALLOWED_ORIGIN 必須是網站完整來源，例如 https://xxx.github.io');
  const ss = SpreadsheetApp.openById(DAYBOOK_CONFIG.SHEET_ID);
  daybookSheet_('records'); daybookSheet_('planner'); daybookSheet_('meta');
  const key = (Utilities.getUuid() + '-' + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('DAYBOOK_KEY_HASH', hashDaybook_(key));
  console.log('\n===== 拾光記帳同步金鑰，僅顯示此次，請安全保存 =====\n' + key + '\n===== 不要上傳 GitHub 或轉傳 =====');
  console.log('已設定試算表：' + ss.getName() + '。新工作表為 DAYBOOK_records / DAYBOOK_planner / DAYBOOK_meta。');
  return '設定完成：金鑰已列在執行記錄。再次執行 setupDaybook 會重設金鑰，讓舊裝置失效。';
}

function doGet() {
  // V1.7: render the full application directly in Apps Script's own HTML Service.
  // No third-party iframe, postMessage, GitHub CORS or Cloud APIs needed.
  return HtmlService.createTemplateFromFile('Index').evaluate()
    .setTitle('拾光記帳 · Daybook V1.7')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function daybookInclude_(name) {
  if (['Styles', 'Client'].indexOf(name) === -1) throw Error('禁止載入未允許的檔案');
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Entry point called ONLY through HtmlService google.script.run. */
function daybookApi(req) {
  req = req || {};
  const expected = PropertiesService.getScriptProperties().getProperty('DAYBOOK_KEY_HASH');
  if (!expected || !req.key || !constantTimeEqual_(hashDaybook_(String(req.key)), expected)) throw Error('同步金鑰不正確，或尚未執行 setupDaybook');
  if (req.action === 'ping') return { ok: true, sheet: '已連接私有 Google 試算表', serverTime: new Date().toISOString() };
  if (req.action === 'pull') return daybookPull_();
  if (req.action === 'push') return daybookPush_(req.changes);
  throw Error('無效的同步指令');
}

function daybookSheet_(kind) {
  const ss = SpreadsheetApp.openById(DAYBOOK_CONFIG.SHEET_ID);
  const name = DAYBOOK_CONFIG.PREFIX + kind;
  let sh = ss.getSheetByName(name);
  const headers=['id','payload_json','deleted','version','updated_at'];
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1,1,1,5).setValues([headers]); sh.setFrozenRows(1); }
  else { const current=sh.getRange(1,1,1,5).getValues()[0];if(headers.some((h,i)=>String(current[i])!==h))throw Error('工作表名稱衝突：'+name+' 已存在但不是拾光記帳格式，請改 PREFIX，避免覆蓋原資料'); }
  return sh;
}
function daybookRead_(kind) {
  const sh=daybookSheet_(kind),last=sh.getLastRow(),rows=last>1?sh.getRange(2,1,last-1,5).getValues():[];
  return {sh,rows,byId:new Map(rows.map((r,i)=>[String(r[0]),{row:i+2,raw:r}]).filter(x=>x[0]))};
}
function daybookParse_(item) {
  try {return item[1] ? JSON.parse(String(item[1])) : null;} catch (e) {throw Error('雲端 JSON 損壞，請先檢查工作表：'+item[0]);}
}
function daybookPull_() {
  const result={ok:true,records:[],planner:[],meta:[]};
  for (const kind of ['records','planner','meta']) {
    const data=daybookRead_(kind);
    if(data.rows.length>25000)throw Error('資料量超過單次載入限制，請分批封存');
    result[kind]=data.rows.filter(r=>r[0]).map(r=>({id:String(r[0]),payload:daybookParse_(r),deleted:r[2]===true||String(r[2]).toLowerCase()==='true',version:Number(r[3])||0}));
  }
  return result;
}
function daybookPush_(changes) {
  if(!Array.isArray(changes)||changes.length>DAYBOOK_LIMIT) throw Error('單次最多可寫入 '+DAYBOOK_LIMIT+' 筆');
  const lock=LockService.getScriptLock();
  if(!lock.tryLock(24000))throw Error('同步繁忙，請稍後重試');
  try {
    const sets={},ans=[];
    for(const kind of ['records','planner','meta'])sets[kind]=daybookRead_(kind);
    const added={records:[],planner:[],meta:[]};
    const seen=new Set();
    for(const change of changes) {
      const kind=String(change.kind||''),id=String(change.id||'');
      if(seen.has(kind+':'+id))throw Error('同一批次含重複 ID');seen.add(kind+':'+id);
      if(!sets[kind]||!/^[a-z0-9_.:-]{1,180}$/i.test(id))throw Error('資料種類或 ID 不正確');
      const expect=Number(change.baseVersion||0),deleted=change.deleted===true;
      if(!Number.isInteger(expect)||expect<0)throw Error('版本號不正確');
      const payload=deleted?null:change.payload;
      if(!deleted&&(typeof payload!=='object'||payload===null||Array.isArray(payload)))throw Error('寫入資料格式不正確');
      const serialized=deleted?'':JSON.stringify(payload);
      if(serialized.length>25000)throw Error('單一資料超過長度上限');
      const data=sets[kind],current=data.byId.get(id),old=current?.raw;
      const ver=old?Number(old[3])||0:0;
      // Replays are idempotent even when a response was lost.
      if(old&&(old[2]===true||String(old[2]).toLowerCase()==='true')===deleted&&String(old[1]||'')===serialized) {
        ans.push({kind,id,status:'ok',version:ver}); continue;
      }
      if(ver!==expect) {ans.push({kind,id,status:'conflict',version:ver,remote:old?{id,payload:daybookParse_(old),deleted:old[2]===true||String(old[2]).toLowerCase()==='true',version:ver}:null});continue;}
      const next=ver+1,record=[id,serialized,deleted,next,new Date().toISOString()];
      if(current) data.sh.getRange(current.row,1,1,5).setValues([record]);
      else {added[kind].push(record);data.byId.set(id,{row:data.sh.getLastRow()+added[kind].length,raw:record});}
      ans.push({kind,id,status:'ok',version:next});
    }
    for(const kind of ['records','planner','meta']) {const rows=added[kind];if(rows.length) {const sh=sets[kind].sh;const needed=sh.getLastRow()+rows.length;if(needed>sh.getMaxRows())sh.insertRowsAfter(sh.getMaxRows(),needed-sh.getMaxRows());sh.getRange(sh.getLastRow()+1,1,rows.length,5).setValues(rows);} }
    SpreadsheetApp.flush();return {ok:true,results:ans};
  } finally {lock.releaseLock();}
}
function hashDaybook_(value) {return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,value).map(b=>('0'+(b&255).toString(16)).slice(-2)).join('');}
function constantTimeEqual_(a,b){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}

/** Safe configuration check: does not print or regenerate the sync key. */
function checkDaybookSetup() {
  const ss=SpreadsheetApp.openById(DAYBOOK_CONFIG.SHEET_ID);
  const hash=PropertiesService.getScriptProperties().getProperty('DAYBOOK_KEY_HASH');
  const tabs=['records','planner','meta'].map(kind=>DAYBOOK_CONFIG.PREFIX+kind);
  const result={sheet: ss.getName(), syncKeyExists:Boolean(hash), tabs: tabs.map(name=>({name, exists:Boolean(ss.getSheetByName(name))})), allowedOrigin:DAYBOOK_CONFIG.ALLOWED_ORIGIN};
  console.log(JSON.stringify(result));
  return result;
}
