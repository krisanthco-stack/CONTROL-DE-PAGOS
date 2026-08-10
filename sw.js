const CACHE='cuadrilla-modular-v1.4.1';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./logo.svg','./icon-192.png','./icon-512.png','./maskable-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>e.request.mode==='navigate'?caches.match('./index.html'):undefined)))});
