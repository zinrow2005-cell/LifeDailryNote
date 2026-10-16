# 拾光記帳 V1.6 — Google Sheets + Apps Script 同步設定

> 此版不使用 Supabase。你的記帳網頁仍放在 GitHub Pages，透過自己部署的 Apps Script 操作**私有** Google 試算表。同步需要使用者自行配置；壓縮檔沒有你的試算表 ID、API 金鑰或家庭記帳。

## 一、準備（建議先做）

1. 在既有拾光記帳 V1.5 頁面，先 **下載完整 JSON 備份**，保存於不公開的位置。不要把 JSON 上傳公開 GitHub。
2. 選擇要使用的 Google 試算表。可以直接使用你既有的試算表：這套程式只在其中增加三張工作表 `DAYBOOK_records`、`DAYBOOK_planner`、`DAYBOOK_meta`，不會改動其他原有分頁（但建議還是複製一份作備份）。
3. 開啟試算表網址 `https://docs.google.com/spreadsheets/d/【這段就是試算表 ID】/edit`，記下 ID。
4. 確認你的記帳 GitHub 網址。例如 `https://zinrow2005-cell.github.io/你的Repo/` 的**來源（Origin）**是 `https://zinrow2005-cell.github.io`，不包含 `/你的Repo/`。

## 二、建立獨立 Apps Script 專案（不覆蓋原本程式）

1. 開啟 [script.google.com](https://script.google.com)，點「新增專案」。**請開新專案**，不要直接把已有 Apps Script 系統的 Code.gs 整份覆蓋。也不必公開分享 Google 試算表。
2. 開啟壓縮檔內的 `AppsScript/Code.gs`，將內容貼進新專案的 `Code.gs`。
3. 新增 HTML 檔案，名稱必須是 **`Bridge`**，將 `AppsScript/Bridge.html` 貼入。
4. 修改 `Code.gs` 最上方的 `DAYBOOK_CONFIG.SHEET_ID` 為你的試算表 ID；修改 `DAYBOOK_CONFIG.ALLOWED_ORIGIN` 為你的 GitHub 網站來源（只允許這個來源的記帳頁面使用橋接）。
5. 執行 `setupDaybook()`，依 Google 提示授權；到「執行記錄」複製剛產生的 **64 碼同步金鑰**，保存於安全位置。再次執行會旋轉（更換）金鑰，既有裝置必須重新設定。
6. 在 Apps Script 右上角「部署」→「新增部署」→ 選擇**網頁應用程式**，執行身分選「我」，可存取對象依照腳本可提供的選項選「任何人」。由於這個 URL 是公開可載入的，伺服器另外以長金鑰限制資料讀寫，且 iframe 只接受你指定的網站來源。
7. 完成部署後，複製結尾為 `/exec` 的網址。**不要用 `/dev`**；每次修改 Apps Script 後應更新部署版本。

## 三、連接記帳系統

1. 將壓縮檔中 GitHub 網站檔案更新到原本的 Repo（`index.html`、`app.js`、`styles.css`、`sw.js`、manifest 與 icons），**不要**把 `AppsScript/`、試算表 ID 或 64 碼金鑰放進公開網頁程式碼。
2. 在電腦開啟你的記帳網站，進入「資料備份與設定」→「Google 試算表跨裝置同步」。
3. 輸入剛才的 Apps Script `/exec` 網址和 **64 碼同步金鑰**，按「儲存設定並測試同步」。
4. 第一次同步前，如發現資料筆數不正確或之前有其他雲端資料，請不要清空帳目，先下載 JSON 備份並核對。
5. 在手機、平板開同一個 GitHub 網址，分別輸入同一組 Apps Script 網址及同步金鑰。各裝置的本機帳目仍留在 IndexedDB，連線時才同步。

## 四、工作表結構（系統管理，不要手動改欄名）

| 新增工作表 | 欄位 | 儲存內容 |
|---|---|---|
| `DAYBOOK_records` | id, payload_json, deleted, version, updated_at | 每筆收入／支出、刪除標記及版本號 |
| `DAYBOOK_planner` | 同上 | 每月份預算、固定收支及其版本 |
| `DAYBOOK_meta` | 同上 | 分類設定 |

資料是 JSON 欄位加版本控制；**這三張工作表是同步資料庫**，請以拾光記帳網頁查看或編輯，不建議直接在 Sheets 更改 JSON。你原來的會計統計工作表維持原狀。

## 五、安全、限制與常見問題

- 這是以 Apps Script「執行身分：我」的權限存取你私人試算表，**持有同步金鑰的人就可能以系統權限讀寫這三張工作表**。金鑰必須視同密碼保護。不要把 Google 試算表改成「知道連結的任何人可編輯」。
- `ALLOWED_ORIGIN` 會限制 Apps Script 橋接只接收指定 GitHub 來源的網頁訊息，但**不等於完整的 Google OAuth 使用者身分驗證**。如金鑰外洩，請重新執行 `setupDaybook()` 並更新部署設定／各裝置金鑰。
- 跨網域 `fetch()` 直接呼叫 Apps Script Web App 常受 CORS／轉址限制，所以這版採用 **HtmlService iframe + google.script.run + postMessage**。請勿自行改為在前端存放可直接寫 Sheet 的 service credentials。
- 若部署在自訂網域，務必把 `ALLOWED_ORIGIN` 改成正確的網站 `https://...` 來源；若部署設為「僅限自己」，跨裝置 iframe 的 Google 登入與第三方 Cookie 限制可能造成橋接失敗。
- 離線可記帳；同步並非即時推播，頁面保持開啟時約 90 秒嘗試一次，也可以按「立即同步」。無法連線時本機佇列不會因失敗而清空。
- 兩台裝置同時修改同一交易、同月份預算或同固定收支模板，會以版本號檢測衝突、保留未同步的本機修改，再由你選擇採用版本。仍應定期匯出 JSON 備份。
- Apps Script 有執行時間及服務配額，資料大量增長後同步可能變慢。初次匯入 1,267 筆可能需要多次操作；完成前不要關閉分頁。
- **尚未以你的真實 Google 帳號和 Apps Script 部署網址進行端到端連線測試。** 請先用備份／少量測試記帳驗證流程，再作為正式共用帳本。
- 這套獨立同步程式不會直接接管你目前已使用的其他 Google Apps Script；要與原有程式**直接對接**，需先檢查你原本的 Code.gs 及表單結構，避免欄位／權限不相容。
