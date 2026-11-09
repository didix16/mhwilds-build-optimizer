import { indexData } from './equipment.js';
import { createSearch } from './solver.js';
let db,search,running=false,timer,runId,windowStart;
function tick(){
  if(!running)return;
  try{const state=search.step(130);postMessage({type:'progress',runId,...state});if(state.exhausted){running=false;postMessage({type:'done',runId});}else if(state.counts.queued>200000||Date.now()-windowStart>12000){running=false;postMessage({type:'paused',runId,reason:state.counts.queued>200000?'memoryPause':'budgetPause'});}else timer=setTimeout(tick,0);}
  catch(e){running=false;postMessage({type:'error',runId,error:e.message});}
}
self.onmessage=({data})=>{
  try{
    if(data.type==='init'){db=indexData(data.db);postMessage({type:'ready'});}
    if(data.type==='search'){clearTimeout(timer);runId=data.runId;search=createSearch(db,data.query);running=true;windowStart=Date.now();tick();}
    if(data.type==='pause'){running=false;clearTimeout(timer);postMessage({type:'paused',runId});}
    if(data.type==='resume'){if(!search)return;running=true;windowStart=Date.now();tick();}
  }catch(e){postMessage({type:'error',runId,error:e.message});}
};
