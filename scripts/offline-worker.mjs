export function serviceWorkerSource(files, version) {
  return `// Generated static-only offline cache. No external requests are made by the optimizer.
const SCOPE=new URL(self.registration.scope);
const PREFIX='wilds-forge-'+encodeURIComponent(SCOPE.pathname)+'-';
const CACHE=PREFIX+${JSON.stringify(version)};
const FILES=${JSON.stringify(files.map(f => './' + f))};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname))return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;
    try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}
  }));
});
`;
}
