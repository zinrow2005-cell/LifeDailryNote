/* 拾光記帳 Daybook V1.9.8：network-first，僅快取靜態網站資源，不處理 Google Apps Script 網域 */
const CACHE='daybook-public-v1.9.8';
const SHELL=['./index.html','./styles.v1.9.8.css','./app.v1.9.8.js','./manifest.webmanifest','./version.json','./check-update.html','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('daybook-public-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const isStatic=/\.(?:html|js|css|json|webmanifest|png)$/.test(url.pathname);
 if(!isStatic && request.mode!=='navigate')return;
 event.respondWith((async()=>{
  try{
   const response=await fetch(request,{cache:'no-store'});
   if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone());}
   return response;
  }catch(err){
   const cached=await caches.match(request,{ignoreSearch:true});
   if(cached)return cached;
   if(request.mode==='navigate'){const fallback=await caches.match('./index.html');if(fallback)return fallback;}
   throw err;
  }
 })());
});
