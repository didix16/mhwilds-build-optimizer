import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {serviceWorkerSource} from '../scripts/offline-worker.mjs';

function environment(scope,existing=[]) {
  const handlers={},opened=[],deleted=[],precache=[];
  const cache={addAll:async files=>precache.push(...files),match:async request=>request==='./index.html'?'offline-index':undefined};
  const context={URL,self:{registration:{scope},skipWaiting:async()=>{},clients:{claim:async()=>{}},addEventListener:(type,handler)=>{handlers[type]=handler;}},caches:{open:async name=>{opened.push(name);return cache;},keys:async()=>existing,delete:async name=>{deleted.push(name);return true;}},fetch:async()=>{throw Error('offline');}};
  vm.runInNewContext(serviceWorkerSource(['index.html','data/database.json'],'new'),context);
  return {handlers,opened,deleted,precache};
}
async function lifecycle(handler){let pending;handler({waitUntil:p=>{pending=p;}});await pending;}

test('offline cache isolates root and project deployments on the same Pages domain',async()=>{
  const project=environment('https://hunter.github.io/my-builds/');
  const root=environment('https://hunter.github.io/');
  await lifecycle(project.handlers.install);await lifecycle(root.handlers.install);
  assert.notEqual(project.opened[0],root.opened[0]);
  assert.equal(project.opened[0],'wilds-forge-%2Fmy-builds%2F-new');
  assert.deepEqual(project.precache,['./index.html','./data/database.json']);
});
test('activating a project cache only deletes old versions belonging to that project',async()=>{
  const project=environment('https://hunter.github.io/my-builds/',['wilds-forge-%2Fmy-builds%2F-old','wilds-forge-%2Fmy-builds%2F-new','wilds-forge-%2Fother-project%2F-old','unrelated-app']);
  await lifecycle(project.handlers.activate);
  assert.deepEqual(project.deleted,['wilds-forge-%2Fmy-builds%2F-old']);
});
test('offline navigation uses the project index and leaves other repository requests alone',async()=>{
  const project=environment('https://hunter.github.io/my-builds/');
  let response;
  project.handlers.fetch({request:{method:'GET',url:'https://hunter.github.io/my-builds/',mode:'navigate'},respondWith:p=>{response=p;}});
  assert.equal(await response,'offline-index');
  let intercepted=false;
  project.handlers.fetch({request:{method:'GET',url:'https://hunter.github.io/another-project/data/database.json'},respondWith:()=>{intercepted=true;}});
  assert.equal(intercepted,false);
});
