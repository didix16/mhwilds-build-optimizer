import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const files=[];
async function walk(dir){for(const file of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())await walk(full);else if(file.name!=='sw.js')files.push(full.replaceAll('\\','/').replace(/^dist\//,''));}}
await walk('dist');
const hash=createHash('sha256');for(const file of files.sort())hash.update(await readFile(`dist/${file}`));
const version=hash.digest('hex').slice(0,16);
const script=`// Generated static-only offline cache. No external requests are made by the optimizer.
const CACHE='wilds-forge-${version}';
const FILES=${JSON.stringify(files.map(f=>'./'+f))};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('wilds-forge-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;
    try{return await fetch(event.request);}catch(error){if(event.request.mode==='navigate')return await cache.match('./index.html');throw error;}
  }));
});
`;
await writeFile('dist/sw.js',script);
console.log(`Offline cache ${version}: ${files.length} local files.`);
