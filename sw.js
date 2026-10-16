// 拾光記帳 V1.9.1 本機版：cache-first 靜態檔案，其餘使用 network-first。
const CACHE='daybook-public-v1.9.1';
const SHELL=['./','./index.html','./styles.css?v=1.9.1','./app.js?v=1.9.1','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('daybook-public-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==self.location.origin)return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).catch(()=>caches.match('./index.html')));return;}
  e.respondWith(caches.match(r).then(c=>c||fetch(r)));});
