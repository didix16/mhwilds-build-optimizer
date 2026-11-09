import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {readFile} from 'node:fs/promises';
import {indexData} from '../src/engine/equipment.js';
import {verifyBuild} from '../src/engine/verify.js';
const raw=JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8'));
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
