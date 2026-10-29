const VERSION='pagematch-assets-__BUILD_HASH__';
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  const response=await fetch('./precache.json',{cache:'no-store'});
  if(!response.ok)throw Error('Offline asset manifest unavailable');
  for(const url of await response.json())await cache.add(new Request(url,{cache:'reload'}));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for(const key of await caches.keys())if(key.startsWith('pagematch-assets-')&&key!==VERSION)await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{const cache=await caches.open(VERSION);return await cache.match(req)||fetch(req);})());
});
