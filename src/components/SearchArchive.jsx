import React from 'react';
import {Button} from 'primereact/button';
import {localized} from '../i18n.js';
import {SEARCH_VERSION,datasetFingerprint} from '../engine/search-record.js';

export default function SearchArchive({archive,db,lang,t,onResume,onClose,onError}){
  const {runs,active,busy,exportProgress}=archive;
  const act=promise=>promise.catch(onError);
  return <section className="saved-page archive-page"><div className="page-heading"><div><span className="eyebrow">WILDS FORGE</span><h1>{t.searches}</h1><p>{t.archiveIntro}</p></div></div>
    <div className="notice"><i className="pi pi-save"/><div><p>{t.recoveryHint}</p><p>{t.reportHint}</p><p>{t.archiveSize}</p></div></div>
    {archive.storageError&&<div role="alert" className="notice error">{t.storageError} <span>{archive.storageError}</span></div>}
    {exportProgress&&<p role="status">{t.exporting} {exportProgress.done} / {exportProgress.total}</p>}
    {!runs.length?<div className="empty-state"><i className="pi pi-history"/><h2>{t.noSearches}</h2></div>:<div className="archive-grid">{runs.map(run=>{
      const compatible=run.fingerprint===datasetFingerprint(db)&&run.solverVersion===SEARCH_VERSION;
      const isActive=run.id===active?.id;
      return <article className="panel archive-card" key={run.id}><div className="archive-card-heading"><h2>{new Date(run.createdAt).toLocaleString(lang)}</h2><span className="badge">{isActive?t.activeArchive:run.status==='exhausted'?t.exhausted:t.paused}</span></div>
        <p>{Object.entries(run.query.requirements).map(([id,level])=>`${localized(db.skillMap.get(+id)?.name,lang)||id} ${level}`).join(' · ')}</p>
        <strong>{run.resultCount.toLocaleString(lang)} {t.storedResults}</strong><p className="helper">{run.sequence?`${t.savedAt}: ${new Date(run.updatedAt).toLocaleString(lang)}`:t.noCheckpoint}</p>
        {!compatible&&<><p className="helper amber">{t.incompatible}</p><Button label={t.restartSearch} icon="pi pi-refresh" outlined disabled={busy||!!exportProgress} onClick={()=>act(onResume(run,true))}/></>}
        <div className="archive-actions">{run.status!=='exhausted'&&<Button label={t.resumeSearch} icon="pi pi-play" outlined disabled={!compatible||!run.sequence||busy||!!exportProgress} onClick={()=>act(onResume(run))}/>}
          <Button label={t.report} icon="pi pi-download" outlined disabled={!run.sequence||!!exportProgress||busy} onClick={()=>act(archive.exportReport(run.id,lang))}/>
          {isActive?<Button label={t.closeSearch} text onClick={()=>act(onClose())}/>:<Button icon="pi pi-trash" aria-label={t.archiveDelete} title={t.archiveDelete} text severity="secondary" disabled={busy||!!exportProgress} onClick={()=>{if(window.confirm(t.archiveDeleteConfirm))act(archive.remove(run.id));}}/>}</div>
      </article>;
    })}</div>}
  </section>;
}
