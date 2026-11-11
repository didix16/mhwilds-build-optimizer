import { useEffect,useRef,useState } from 'react';
import { archives } from './store.js';
import { archiveCatalog } from './records.js';
import { datasetFingerprint,SEARCH_VERSION } from '../engine/search-record.js';
import { createReportBlob,downloadBlob } from '../report/export.js';

export function useSearchArchive(db,callbacks) {
  const latest=useRef(callbacks);latest.current=callbacks;
  const worker=useRef(null),current=useRef(null),generation=useRef(0),requests=useRef(new Map()),failed=useRef(null);
  const ready=useRef(Promise.resolve());
  const [runs,setRuns]=useState([]),[active,setActive]=useState(null),[busy,setBusy]=useState(false),[exportProgress,setExportProgress]=useState(null),[storageError,setStorageError]=useState('');
  async function refresh(){try{setRuns(await archives.list());}catch(e){setStorageError(String(e.message||e));}}
  useEffect(()=>{refresh();return()=>{worker.current?.terminate();for(const p of requests.current.values())p.reject(Error('Search closed'));requests.current.clear();};},[]);
  function setCurrent(run){current.current=run;setActive(run);setRuns(old=>[run,...old.filter(r=>r.id!==run.id)].sort((a,b)=>b.updatedAt-a.updatedAt));}
  function rejectRequests(error){for(const p of requests.current.values())p.reject(error);requests.current.clear();}
  async function commit(payload,w){
    const session=current.current;
    if(!session)return;
    try{
      const run=await archives.save(session.id,{...payload,owner:session.owner});
      if(current.current?.id!==session.id||current.current?.owner!==session.owner)return;
      const recovered=!!failed.current;
      failed.current=null;setStorageError('');setCurrent(run);w.postMessage({type:'stored',sequence:payload.sequence});
      if(recovered)latest.current.onRecovered?.();
      const request=requests.current.get(payload.requestId);if(request){requests.current.delete(payload.requestId);request.resolve(run);}
    }catch(error){if(current.current?.id!==session.id)return;failed.current=payload;setStorageError(String(error.message||error));w.postMessage({type:'storage-error',sequence:payload.sequence});rejectRequests(error);}
  }
  async function savePoint(){
    if(!current.current)return null;
    if(failed.current)await commit(failed.current,worker.current);
    if(failed.current)throw Error('Storage unavailable. Free space and try saving again.');
    if(!worker.current)return current.current;
    await ready.current;
    return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();requests.current.set(requestId,{resolve,reject});worker.current.postMessage({type:'checkpoint',requestId});});
  }
  async function detach(){if(worker.current){await ready.current;worker.current?.postMessage({type:'pause'});await savePoint();worker.current?.terminate();worker.current=null;}current.current=null;setActive(null);}
  useEffect(()=>{
    const hidden=()=>{if(document.visibilityState==='hidden'&&worker.current)savePoint().catch(()=>{});};
    document.addEventListener('visibilitychange',hidden);return()=>document.removeEventListener('visibilitychange',hidden);
  },[]);
  async function launch(query,existing){
    setBusy(true);
    try{
      const same=!!existing&&existing.id===current.current?.id;
      await detach();
      let run=same?await archives.get(existing.id):existing,checkpoint;
      if(existing){
        if(run.fingerprint!==datasetFingerprint(db)||run.solverVersion!==SEARCH_VERSION)throw Error('This search uses another dataset or engine version. Its HTML report remains available.');
        run=await archives.claim(run.id,crypto.randomUUID(),run.sequence);
        checkpoint=await archives.checkpoint(run.id);if(!checkpoint)throw Error('No checkpoint has been saved for this search.');
      }else{
        run={id:crypto.randomUUID(),owner:crypto.randomUUID(),query:structuredClone(query),createdAt:Date.now(),updatedAt:Date.now(),fingerprint:datasetFingerprint(db),solverVersion:SEARCH_VERSION,status:'running',resultCount:0,sequence:0};
        await archives.create(run,archiveCatalog(db));
      }
      setCurrent(run);setStorageError('');const id=++generation.current;
      latest.current.onStart(query,checkpoint);
      const w=new Worker(new URL('../engine/worker.js',import.meta.url),{type:'module'});worker.current=w;
      let markReady;
      ready.current=new Promise(resolve=>{markReady=resolve;});
      w.onerror=e=>{markReady();if(worker.current!==w)return;latest.current.onError(e.message||'engineError');rejectRequests(Error(e.message));w.terminate();worker.current=null;};
      w.onmessage=({data})=>{
        if(id!==generation.current||worker.current!==w)return;
        if(data.type==='ready'){w.postMessage({type:'search',query,runId:id,archive:true,checkpoint,sequence:run.sequence});markReady();return;}
        if(data.runId!==id)return;
        if(data.type==='progress')latest.current.onProgress(data);
        if(data.type==='paused'){if(data.exhausted)latest.current.onDone();else latest.current.onPaused(data.reason||'');}
        if(data.type==='done')latest.current.onDone();
        if(data.type==='checkpoint')commit(data,w);
        if(data.type==='error'){markReady();latest.current.onError(data.error);rejectRequests(Error(data.error));w.terminate();worker.current=null;}
      };
      w.postMessage({type:'init',db:Object.fromEntries(['skills','armor','weapons','decorations','charms','randomCharms','charmGroups','items','monsters','artian','meta'].map(k=>[k,db[k]]))});
      // The Worker emits an initial checkpoint before exploring its first batch.
    }catch(error){latest.current.onError(error.message);throw error;}finally{setBusy(false);}
  }
  function pause(){ready.current.then(()=>worker.current?.postMessage({type:'pause'}));}
  async function resume(){if(failed.current)await savePoint();latest.current.onResume();worker.current?.postMessage({type:'resume'});}
  async function exportReport(id,lang){
    setExportProgress({done:0,total:0});
    try{
      const snapshot=id===current.current?.id?await savePoint():await archives.get(id);
      if(!snapshot?.sequence)throw Error('No saved checkpoint is available yet.');
      const blob=await createReportBlob(archives,snapshot,{language:lang,onProgress:(done,total)=>setExportProgress({done,total})});
      downloadBlob(blob,`wilds-forge-${new Date(snapshot.createdAt).toISOString().replace(/[:.]/g,'-')}.html`);
    }finally{setExportProgress(null);}
  }
  async function remove(id){if(current.current?.id===id)throw Error('Close this search before deleting it.');await archives.remove(id);await refresh();}
  return {worker,runs,active,busy,exportProgress,storageError,launch,pause,resume,savePoint,detach,exportReport,remove,refresh};
}
