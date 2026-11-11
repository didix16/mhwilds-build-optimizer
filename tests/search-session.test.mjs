import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Worker as NodeWorker} from 'node:worker_threads';
import 'fake-indexeddb/auto';
import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {useSearchArchive} from '../src/archive/useSearchArchive.js';
import {archives} from '../src/archive/store.js';
import {indexData,ARMOR_KINDS} from '../src/engine/equipment.js';

const raw=JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8'));
const db=indexData({...raw,weapons:raw.weapons.filter(w=>w.kind==='great-sword'&&w.family==='crafted').slice(0,2),armor:ARMOR_KINDS.flatMap(k=>raw.armor.filter(a=>a.kind===k&&a.rank==='high').slice(0,3))});
const query={requirements:{72:1},weaponTypes:['great-sword'],families:['crafted'],attribute:'any',rank:'high',transcended:true,priority:'defense',limit:2,scenario:{}};
const workers=new Set();
class BrowserWorker {
  constructor(url){
    const bootstrap=`const {parentPort}=await import('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);await import(${JSON.stringify(url.href)});parentPort.on('message',data=>self.onmessage({data}));`;
    this.inner=new NodeWorker(new URL('data:text/javascript,'+encodeURIComponent(bootstrap)),{type:'module'});workers.add(this);
    this.inner.on('message',data=>this.onmessage?.({data}));this.inner.on('error',error=>this.onerror?.(error));
  }
  postMessage(message){this.inner.postMessage(message);}
  terminate(){workers.delete(this);return this.inner.terminate();}
}
const waitFor=async(predicate)=>{const until=Date.now()+15000;while(!predicate()){if(Date.now()>until)throw Error('Session integration timeout');await new Promise(resolve=>setTimeout(resolve,10));}};

test('search session saves all results, recovers after closing, and retries a failed storage transaction',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost/optimizer/'});
  const previous={window:globalThis.window,document:globalThis.document,Worker:globalThis.Worker,act:globalThis.IS_REACT_ACT_ENVIRONMENT};
  globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.Worker=BrowserWorker;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
  let archive,progress,paused=false,error,pauseOnProgress=true,root;
  function Harness(){archive=useSearchArchive(db,{onStart(){paused=false;error=null;},onProgress(data){progress=data;if(pauseOnProgress){pauseOnProgress=false;archive.pause();}},onPaused(){paused=true;},onDone(){paused=true;},onResume(){paused=false;},onError(e){error=e;}});return null;}
  const mount=async()=>{root=createRoot(document.getElementById('root'));await act(async()=>{root.render(React.createElement(Harness));await new Promise(r=>setTimeout(r,0));});};
  const originalSave=archives.save;
  try{
    await mount();
    // A storage failure must retain the failed payload and stop exploration.
    let fail=true;archives.save=async(...args)=>{if(fail){fail=false;throw Error('Simulated quota failure');}return originalSave(...args);};
    await act(async()=>{await archive.launch(query);await waitFor(()=>paused);});
    assert.equal(error,null);assert.match(archive.storageError,/quota failure/);
    let saved;await act(async()=>{const points=await Promise.all([archive.savePoint(),archive.savePoint()]);saved=points.at(-1);});
    assert.equal(archive.storageError,'');assert.ok(saved.counts.examined>0);assert.equal(saved.resultCount,saved.counts.feasible);assert.ok(saved.resultCount>query.limit);
    const firstCount=saved.counts.examined,id=saved.id;
    await act(async()=>{await archive.detach();});
    await act(async()=>root.unmount());
    await mount();await act(async()=>{await archive.refresh();});
    const stored=archive.runs.find(r=>r.id===id);assert.ok(stored.sequence>0);
    pauseOnProgress=true;paused=false;
    await act(async()=>{await archive.launch(stored.query,stored);await waitFor(()=>paused);});
    await act(async()=>{saved=await archive.savePoint();});
    assert.ok(saved.counts.examined>firstCount);assert.equal(saved.resultCount,saved.counts.feasible);assert.equal(error,null);
    const all=[];for await(const rows of archives.records(id,saved.sequence))all.push(...rows);assert.equal(all.length,saved.resultCount);assert.equal(new Set(all.map(b=>b.key)).size,all.length);assert.ok(all.every(b=>b.stats&&Number.isFinite(b.stats.attack)&&!('damage' in b.stats)));
    // Resuming the currently attached run also works after flushing a newer sequence.
    pauseOnProgress=true;paused=false;
    await act(async()=>{await archive.launch(saved.query,saved);await waitFor(()=>paused);});
    assert.equal(error,null);
    await act(async()=>{await archive.detach();});
    await archives.remove(id);
  }finally{
    archives.save=originalSave;
    if(root)await act(async()=>root.unmount());
    await Promise.all([...workers].map(w=>w.terminate()));await archives.close();await new Promise(r=>setTimeout(r,20));dom.window.close();
    globalThis.window=previous.window;globalThis.document=previous.document;globalThis.Worker=previous.Worker;globalThis.IS_REACT_ACT_ENVIRONMENT=previous.act;
  }
});
