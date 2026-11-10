import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {indexData} from '../src/engine/equipment.js';
import {verifyBuild} from '../src/engine/verify.js';
const raw=JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8'));
const workerSource=await readFile(new URL('../src/engine/worker.js',import.meta.url),'utf8');

function deterministicWorker({queued,clockStep}) {
  const moduleUrl=source=>'data:text/javascript,'+encodeURIComponent(source);
  const engine=moduleUrl(`export function createSearch(){let step=0;return {step(){step++;return {results:[],counts:{examined:step,queued:${queued},elapsed:step*13000},exhausted:step===4};}};}`);
  const equipment=moduleUrl('export const indexData=data=>data;');
  const source=workerSource.replace("'./equipment.js'",JSON.stringify(equipment)).replace("'./solver.js'",JSON.stringify(engine));
  const bootstrap=`const {parentPort}=await import('node:worker_threads');let time=0;Date.now=()=>time+=${clockStep};globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);await import(${JSON.stringify(moduleUrl(source))});parentPort.on('message',data=>self.onmessage({data}));`;
  return new Worker(new URL(moduleUrl(bootstrap)),{type:'module'});
}

for(const scenario of [
  {name:'continues past the old 12-second deadline without pausing',queued:1,clockStep:13000},
  {name:'continues past the old queue threshold without pausing',queued:300000,clockStep:0},
]) {
  test(`worker ${scenario.name}`,async()=>{
    const worker=deterministicWorker(scenario);
    try{await new Promise((resolve,reject)=>{
      const progress=[];
      const timeout=setTimeout(()=>reject(Error('Worker did not finish')),5000);
      const fail=error=>{clearTimeout(timeout);reject(error);};
      worker.on('error',fail);
      worker.on('message',message=>{
        try{
          if(message.type==='ready')worker.postMessage({type:'search',query:{},runId:7});
          if(message.type==='paused')throw Error('Unexpected automatic pause');
          if(message.type==='error')throw Error(message.error);
          if(message.type==='progress')progress.push(message);
          if(message.type==='done'){
            assert.equal(message.runId,7);
            assert.deepEqual(progress.map(p=>p.counts.examined),[1,2,3,4]);
            assert.equal(progress.at(-1).exhausted,true);
            assert.ok(progress.at(-1).counts.elapsed>12000);
            clearTimeout(timeout);resolve();
          }
        }catch(error){fail(error);}
      });
      worker.postMessage({type:'init',db:{}});
    });}finally{await worker.terminate();}
  });
}

test('worker emits valid progress, pauses, and resumes the same search',async()=>{
  const db=indexData(raw);
  const query={requirements:{72:3,57:2},weaponTypes:['great-sword'],families:['crafted'],attribute:'any',rank:'high',transcended:true,priority:'defense',limit:20,scenario:{}};
  const workerModule=new URL('../src/engine/worker.js',import.meta.url).href;
  const code=`const {parentPort}=await import('node:worker_threads');globalThis.self=globalThis;globalThis.postMessage=data=>parentPort.postMessage(data);await import(${JSON.stringify(workerModule)});parentPort.on('message',data=>self.onmessage({data}));`;
  const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(code)),{type:'module'});
  try{await new Promise((resolve,reject)=>{
    let stage=0,firstExamined=0;
    const timeout=setTimeout(()=>reject(Error('Worker timeout')),15000);
    worker.on('error',e=>{clearTimeout(timeout);reject(e);});
    worker.on('message',message=>{
      try{
        if(message.type==='ready')worker.postMessage({type:'search',runId:1,query});
        if(message.type==='error')throw Error(message.error);
        if(message.type==='progress'){
          assert.ok(message.results.length>0);
          for(const build of message.results)assert.equal(verifyBuild(db,build,query).valid,true);
          if(stage===0){firstExamined=message.counts.examined;stage=1;worker.postMessage({type:'pause'});}
          else if(stage===2){assert.ok(message.counts.examined>firstExamined);clearTimeout(timeout);resolve();}
        }
        if(message.type==='paused'&&stage===1){stage=2;worker.postMessage({type:'resume'});}
      }catch(e){clearTimeout(timeout);reject(e);}
    });
    worker.postMessage({type:'init',db:raw});
  });}finally{await worker.terminate();}
});
