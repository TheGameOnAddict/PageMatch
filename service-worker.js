const VERSION='pagematch-assets-__BUILD_HASH__';
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(VERSION);
  const response=await fetch('./precache.json',{cache:'no-store'});
  if(!response.ok)throw Error('Offline asset manifest unavailable');
  for(const url of await response.json())await cache.add(new Request(url,{cache:'reload'}));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  // Keep one prior release usable in a tab that is still open during an update.
  const previous=(await caches.keys()).filter(key=>key.startsWith('pagematch-assets-')&&key!==VERSION);
  for(const key of previous.slice(0,-1))await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    if(req.mode==='navigate'){
      try{const response=await fetch(req,{cache:'no-store'});if(response.ok)return response;throw Error('App unavailable');}
      catch(error){
        const offline=await cache.match(new URL('./',self.registration.scope).href);
        if(offline)return offline;
        throw error;
      }
    }
    return await cache.match(req)||await caches.match(req)||fetch(req);
  })());
});
