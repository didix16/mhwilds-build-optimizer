import React,{useEffect,useMemo,useRef,useState} from 'react';
import {Button} from 'primereact/button';
import {Dropdown} from 'primereact/dropdown';
import {MultiSelect} from 'primereact/multiselect';
import {InputSwitch} from 'primereact/inputswitch';
import {InputNumber} from 'primereact/inputnumber';
import {Toast} from 'primereact/toast';
import {messages,localized} from './i18n.js';
import {WEAPON_TYPES,indexData,armorVariant,tally} from './engine/equipment.js';
import {statistics} from './engine/damage.js';
import {configureArtian,ATTRIBUTES} from './engine/artian.js';
import {verifyBuild} from './engine/verify.js';
import {Badge,EquipmentIcon,SkillIcon,SectionTitle,WeaponType,fmt} from './components/common.jsx';
import BuildDetail from './components/BuildDetail.jsx';
import ScenarioDialog from './components/ScenarioDialog.jsx';
import Catalog from './components/Catalog.jsx';
import Sources from './components/Sources.jsx';
import SearchArchive from './components/SearchArchive.jsx';
import {useSearchArchive} from './archive/useSearchArchive.js';
import {archiveMessages} from './archive/messages.js';

const initialScenario={hitzones:{slash:.45,blunt:.45,pierce:.45,fire:.2,water:.2,thunder:.2,ice:.2,dragon:.2},activeSkills:[],buffs:{},combos:{}};
const initialOptions={weaponTypes:Object.keys(WEAPON_TYPES),families:['crafted','artian','gogma'],attribute:'any',rank:'all',transcended:true,priority:'defense',limit:20,weaponId:null,optionalVariants:false,optionalSkills:[],variantLimit:8};
function stored(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function downloadJson(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export default function App(){
  const [lang,setLang]=useState(()=>stored('wilds-language',navigator.language?.startsWith('es')?'es':'en'));
  const t={...(messages[lang]||messages.en),...(archiveMessages[lang]||archiveMessages.en)};
  const [db,setDb]=useState(null),[error,setError]=useState(''),[page,setPage]=useState('forge');
  const [requirements,setRequirements]=useState({}),[options,setOptions]=useState(initialOptions),[scenario,setScenario]=useState(initialScenario);
  const [scenarioOpen,setScenarioOpen]=useState(false),[phase,setPhase]=useState('idle'),[reason,setReason]=useState('');
  const [results,setResults]=useState([]),[counts,setCounts]=useState(null),[activeKey,setActiveKey]=useState(null),[searchQuery,setSearchQuery]=useState(null);
  const [saved,setSaved]=useState(()=>stored('wilds-builds',[])),[mobileOpen,setMobileOpen]=useState(false),[cacheStatus,setCacheStatus]=useState('');
  const fileInput=useRef(null),toast=useRef(null);
  const showError=e=>toast.current?.show({severity:'error',summary:String(e.message||e),life:7000});
  const archive=useSearchArchive(db,{
    onStart(next,checkpoint){const {requirements:req,scenario:sc,...opts}=next;setRequirements(req);setOptions({...initialOptions,...opts});setScenario(sc||initialScenario);setResults(checkpoint?.results||[]);setCounts(checkpoint?.counts||null);setActiveKey(null);setSearchQuery(structuredClone(next));setPhase('running');setReason('');setError('');setMobileOpen(false);setPage('forge');},
    onProgress(data){setResults(data.results);setCounts(data.counts);setActiveKey(old=>old||data.results[0]?.key);},
    onDone(){setPhase('exhausted');},onPaused(why){setPhase('paused');setReason(why);},onResume(){setPhase('running');setReason('');},onRecovered(){setReason('');setPhase(old=>old==='exhausted'?'exhausted':'paused');},onError(message){setPhase('error');setError(message);}
  });
  const {worker}=archive;
  useEffect(()=>{document.documentElement.lang=lang;try{localStorage.setItem('wilds-language',JSON.stringify(lang));}catch{}},[lang]);
  useEffect(()=>{const controller=new AbortController();fetch(`${import.meta.env.BASE_URL}data/database.json`,{signal:controller.signal}).then(r=>{if(!r.ok)throw Error('Database');return r.json();}).then(data=>setDb(indexData(data))).catch(e=>{if(e.name!=='AbortError')setError('loadError');});return()=>{controller.abort();worker.current?.terminate();};},[]);
  useEffect(()=>{if(import.meta.env.PROD&&'serviceWorker' in navigator){navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(()=>navigator.serviceWorker.ready).then(()=>setCacheStatus('offlineReady')).catch(()=>setCacheStatus('cacheError'));}},[]);
  const query=useMemo(()=>({...options,requirements,scenario}),[options,requirements,scenario]);
  const dirty=searchQuery&&JSON.stringify(query)!==JSON.stringify(searchQuery);
  const changeOptions=patch=>setOptions(o=>({...o,...patch}));
  const skillOptions=useMemo(()=>db?db.skills.map(s=>({label:localized(s.name,lang),search:`${s.name.en} ${s.name.es}`,value:s.id,skill:s})).filter(s=>!requirements[s.value]).sort((a,b)=>a.label.localeCompare(b.label,lang)):[],[db,lang,requirements]);
  const selectedBuild=results.find(b=>b.key===activeKey)||results[0];
  async function start(overrides={}){
    const next={...initialOptions,...query,...overrides};
    if(!Object.keys(next.requirements).length)return;
    if(!next.weaponTypes.length||!next.families.length){toast.current?.show({severity:'warn',summary:t.noType});return;}
    try{await archive.launch(next);}catch(e){showError(e);}
  }
  function useExample(){const req=Object.fromEntries(['Attack Boost','Critical Boost','Weakness Exploit'].map((name,i)=>[db.skills.find(s=>s.name.en===name).id,[5,3,3][i]]));setRequirements(req);start({requirements:req});}
  function save(build){const entry={schema:1,createdAt:new Date().toISOString(),query:searchQuery,build};const next=[entry,...saved.filter(e=>e.build.key!==build.key)].slice(0,30);try{localStorage.setItem('wilds-builds',JSON.stringify(next));setSaved(next);toast.current.show({severity:'success',summary:t.savedToast,life:2200});}catch(e){toast.current.show({severity:'error',summary:String(e)});}}
  function exportBuild(build){downloadJson({schema:1,dataset:db.meta.targetVersion,query:searchQuery,build},'wilds-forge-build.json');}
  async function restore(entry){
    if(entry.schema!==1||!entry.query||!entry.build)throw Error('Invalid schema');
    const checked=verifyBuild(db,entry.build,entry.query);if(!checked.valid)throw Error(checked.errors.join('; '));
    const {weapon,armor,charm}=checked;
    const build={...entry.build,weapon,armor,charm,levels:checked.levels,points:checked.points,verified:true};
    build.stats=statistics(db,weapon,armor,build.levels,entry.query.scenario);
    await archive.detach();
    const {requirements:req,scenario:sc,...opts}=entry.query;setRequirements(req);setOptions({...initialOptions,...opts});setScenario(sc||initialScenario);setSearchQuery({...initialOptions,...entry.query,scenario:sc||initialScenario});setResults([build]);setActiveKey(build.key);setPhase('imported');setCounts(null);setReason('');setPage('forge');
  }
  async function importFile(event){try{const file=event.target.files[0];if(!file)return;if(file.size>5_000_000)throw Error('File too large');await restore(JSON.parse(await file.text()));}catch{toast.current.show({severity:'error',summary:t.importError});}event.target.value='';}
  async function clearSearch(){try{await archive.detach();setResults([]);setSearchQuery(null);setCounts(null);setPhase('idle');setReason('');setError('');}catch(e){showError(e);}}
  const langOptions=[{label:'English',value:'en'},{label:'Español',value:'es'}];
  return <div className="app-shell">
    <Toast ref={toast}/><input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={importFile}/>
    <header className="site-header"><a className="brand" href="#" onClick={e=>{e.preventDefault();setPage('forge');}} aria-label="Wilds Forge"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt=""/><div><strong>WILDS<span>FORGE</span></strong><small>BUILD OPTIMIZER</small></div></a>
      <nav aria-label={lang==='es'?'Navegación principal':'Main navigation'}>{[['forge','pi-sliders-h'],['searches','pi-history'],['catalog','pi-database'],['saved','pi-bookmark'],['sources','pi-info-circle']].map(([id,icon])=><button key={id} className={page===id?'active':''} onClick={()=>setPage(id)}><i className={`pi ${icon}`}/><span>{t[id]}</span>{id==='saved'&&saved.length>0&&<b>{saved.length}</b>}</button>)}</nav>
      <div className="header-actions"><Dropdown aria-label={t.language} value={lang} options={langOptions} onChange={e=>setLang(e.value)} className="language-picker"/><Button icon="pi pi-upload" outlined label={t.import} className="import-button" size="small" disabled={!db} onClick={()=>fileInput.current.click()}/></div>
    </header>
    {!db?<main className="loading-screen"><i className={`pi ${error?'pi-exclamation-triangle':'pi-spin pi-spinner'}`}/><p>{t[error]||t.loading}</p></main>:<main>
      {page==='forge'&&<>
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="cyan-line"/>{t.eyebrow} <span className="eyebrow-divider">/</span> {t.forge}</div><h1>{t.title}</h1><p>{t.intro}</p><div className="hero-tags"><span><i className="pi pi-check-circle"/> {t.legalCharms}</span><span><i className="pi pi-circle-fill"/> {t.infiniteJewels}</span><span><i className="pi pi-desktop"/> {t.local}</span></div></div><div className="data-counts">{[['armor','pi-shield'],['weapons','pi-bolt'],['skills','pi-star']].map(([k,icon])=><div key={k}><i className={`pi ${icon}`}/><strong>{fmt(db[k].length,lang)}</strong><span>{t[k]}</span></div>)}</div></section>
        <div className="mobile-filter-bar"><Button label={t.mobileFilters} icon="pi pi-sliders-h" outlined onClick={()=>setMobileOpen(!mobileOpen)}/>{Object.keys(requirements).length>0&&<Badge tone="cyan">{Object.keys(requirements).length} {t.skills.toLowerCase()}</Badge>}</div>
        <div className="builder-layout">
          <aside className={`builder-sidebar ${mobileOpen?'open':''}`}>
            <section className="panel requirements-panel"><SectionTitle icon="pi-list-check" aside={<Badge tone="cyan">{Object.keys(requirements).length}</Badge>}>{t.requirements}</SectionTitle><p className="helper">{t.requiredHint}</p>
              <Dropdown value={null} options={skillOptions} optionLabel="label" optionValue="value" filter filterBy="search" filterPlaceholder={t.searchCatalog} placeholder={t.addSkill} className="w-full skill-picker" aria-label={t.addSkill} onChange={e=>setRequirements(r=>({...r,[e.value]:1}))} itemTemplate={o=><div className="skill-option"><SkillIcon skill={o.skill}/><span>{o.label}</span><small>{o.skill.max}</small></div>}/>
              <div className="required-list">{Object.keys(requirements).length?Object.entries(requirements).map(([id,level])=>{const s=db.skillMap.get(+id);return <div key={id} className="required-skill"><SkillIcon skill={s}/><div className="required-skill-info"><span title={localized(s.description,lang)}>{localized(s.name,lang)}</span><small>{t[({armor:'skill',weapon:'weapon',set:'series',group:'group'})[s.kind]]}</small></div><Dropdown aria-label={`${localized(s.name,lang)} ${t.level}`} value={level} options={Array.from({length:s.max},(_,i)=>({label:`${i+1}`,value:i+1}))} onChange={e=>setRequirements(r=>({...r,[id]:e.value}))} className="level-select"/><Button icon="pi pi-times" text rounded aria-label={`${t.remove}: ${localized(s.name,lang)}`} onClick={()=>setRequirements(r=>{const next={...r};delete next[id];return next;})}/></div>;}):<div className="required-empty"><i className="pi pi-plus-circle"/><p>{t.noSkills}</p></div>}</div>
              <div className="priority-block"><label className="tiny-label">{t.priority}</label><div className="priority-options" role="radiogroup" aria-label={t.priority}>{[['defense','pi-shield','defenseFirst'],['damage','pi-bolt','damageFirst']].map(([value,icon,label])=><button key={value} role="radio" aria-checked={options.priority===value} className={options.priority===value?'selected':''} onClick={()=>changeOptions({priority:value})}><i className={`pi ${icon}`}/><span>{t[label]}</span><i className={`pi ${options.priority===value?'pi-check-circle':'pi-circle'}`}/></button>)}</div></div>
              <Button label={phase==='running'?t.searching:t.search} icon={phase==='running'?'pi pi-spin pi-spinner':'pi pi-sparkles'} className="generate-button" disabled={!Object.keys(requirements).length||phase==='running'||archive.busy} onClick={()=>start()}/>
              {dirty&&<p className="helper amber"><i className="pi pi-info-circle"/> {t.dirty}</p>}
            </section>
            <section className="panel filters-panel"><SectionTitle icon="pi-filter">{t.filters}</SectionTitle><div className="field"><label htmlFor="weapon-types">{t.weaponTypes}</label><MultiSelect inputId="weapon-types" value={options.weaponTypes} options={Object.entries(WEAPON_TYPES).map(([value,n])=>({label:n[lang==='es'?1:0],value}))} onChange={e=>changeOptions({weaponTypes:e.value,weaponId:null})} filter filterPlaceholder={t.searchCatalog} maxSelectedLabels={1} selectedItemsLabel={options.weaponTypes.length===14?t.allWeapons:`${options.weaponTypes.length} ${t.weaponTypes.toLowerCase()}`} placeholder={t.choose} className="w-full"/></div>
              <div className="field"><label htmlFor="families">{t.families}</label><MultiSelect inputId="families" value={options.families} options={['crafted','artian','gogma'].map(value=>({label:t[value],value}))} onChange={e=>changeOptions({families:e.value,weaponId:null})} display="chip" className="w-full"/></div>
              <div className="field"><label htmlFor="fixed-weapon">{t.fixedWeapon}</label><Dropdown inputId="fixed-weapon" value={options.weaponId} options={[{label:t.anyWeapon,value:null},...db.weapons.filter(w=>options.weaponTypes.includes(w.kind)&&options.families.includes(w.family)).map(w=>({label:`${localized(w.name,lang)} · R${w.rarity}${w.focus?` · ${t[w.focus]||w.focus}`:''}`,value:w.id}))]} filter filterPlaceholder={t.searchCatalog} onChange={e=>changeOptions({weaponId:e.value})} className="w-full"/></div>
              <div className="field-row"><div className="field"><label htmlFor="attribute">{t.attribute}</label><Dropdown inputId="attribute" value={options.attribute} options={['any',...ATTRIBUTES].map(value=>({label:t[value],value}))} onChange={e=>changeOptions({attribute:e.value})}/></div><div className="field"><label htmlFor="rank">{t.rank}</label><Dropdown inputId="rank" value={options.rank} options={['all','high','low'].map(value=>({label:value==='all'?t.allRanks:t[value],value}))} onChange={e=>changeOptions({rank:e.value})}/></div></div>
              <div className="switch-row"><div><label htmlFor="transcended">{t.transcended}</label><p className="helper">{t.transcendHint}</p></div><InputSwitch inputId="transcended" checked={options.transcended} onChange={e=>changeOptions({transcended:e.value})}/></div>
              <div className="field limit-field"><label htmlFor="limit">{t.topLimit}</label><Dropdown inputId="limit" value={options.limit} options={[20,50]} onChange={e=>changeOptions({limit:e.value})}/></div>
              <div className="switch-row"><label htmlFor="optional-variants">{t.optionalVariants}</label><InputSwitch inputId="optional-variants" checked={!!options.optionalVariants} onChange={e=>changeOptions({optionalVariants:e.value})}/></div>
              {options.optionalVariants&&<><p className="helper">{t.variantHint}</p><div className="field"><label htmlFor="optional-skills">{t.optionalTargets}</label><MultiSelect inputId="optional-skills" value={options.optionalSkills||[]} options={db.skills.filter(s=>!['set','group'].includes(s.kind)).map(s=>({label:localized(s.name,lang),value:s.id}))} filter selectionLimit={5} display="chip" onChange={e=>changeOptions({optionalSkills:e.value})}/></div><div className="field"><label htmlFor="variant-limit">{t.variantLimit}</label><Dropdown inputId="variant-limit" value={options.variantLimit||8} options={[2,4,8]} onChange={e=>changeOptions({variantLimit:e.value})}/></div></>}
            </section>
            <section className="panel scenario-panel"><div className="scenario-icon"><i className="pi pi-crosshairs"/></div><h3>{t.scenario}</h3><p>{t.scenarioHint}</p><Button label={t.editScenario} icon="pi pi-sliders-h" outlined size="small" onClick={()=>setScenarioOpen(true)}/></section>
          </aside>
          <section className="results-area" aria-label={t.results}>
            <div className="results-toolbar"><div><span className={`status-dot ${phase==='running'?'running':''}`}/><span>{t[({idle:'ready',running:'running',paused:'paused',exhausted:'exhausted',imported:'verified',error:'engineError'})[phase]]}</span></div><div>{phase==='running'&&<Button text size="small" icon="pi pi-pause" label={t.pause} onClick={archive.pause}/>} {phase==='paused'&&<Button text size="small" icon="pi pi-play" label={t.resume} onClick={()=>archive.resume().catch(showError)}/>}{phase!=='idle'&&<Button text rounded size="small" icon="pi pi-refresh" aria-label={t.newSearch} tooltip={t.newSearch} disabled={archive.busy} onClick={clearSearch}/>}</div></div>
            {error&&<div role="alert" className="notice error"><i className="pi pi-exclamation-triangle"/> {t[error]||error}</div>}
            {counts&&<div className="search-progress"><span><b>{fmt(counts.examined,lang)}</b> {t.checked}</span><span><b>{fmt(counts.feasible,lang)}</b> {t.found}</span><span className="elapsed"><i className="pi pi-clock"/> {fmt(counts.elapsed/1000,lang,1)} s</span>{phase==='running'&&<div className="progress-track"><span/></div>}</div>}
            {archive.active&&<div className="panel archive-status"><div><strong><i className="pi pi-save"/> {fmt(archive.active.resultCount,lang)} {t.storedResults}</strong><p className="helper">{t.archiveHint}</p><small>{archive.active.sequence?`${t.savedAt}: ${new Date(archive.active.updatedAt).toLocaleTimeString(lang)}`:t.noCheckpoint}</small></div><div className="archive-actions"><Button label={archive.storageError?t.retrySave:t.savePoint} icon="pi pi-save" outlined size="small" disabled={archive.busy} onClick={()=>archive.savePoint().then(()=>toast.current?.show({severity:'success',summary:t.savedPoint,life:2000})).catch(showError)}/><Button label={t.report} icon="pi pi-download" outlined size="small" disabled={!!archive.exportProgress||archive.busy} onClick={()=>archive.exportReport(archive.active.id,lang).catch(showError)}/></div>{archive.exportProgress&&<p role="status">{t.exporting} {archive.exportProgress.done} / {archive.exportProgress.total}</p>}</div>}
            {archive.storageError&&<div role="alert" className="notice error"><div>{t.storageError}<small>{archive.storageError}</small></div></div>}
            {phase==='idle'&&archive.runs.length>0&&<div className="notice recovery-notice"><i className="pi pi-history"/><div><p>{t.recoveryHint}</p><Button label={t.searches} text icon="pi pi-arrow-right" iconPos="right" onClick={()=>setPage('searches')}/></div></div>}
            {phase==='idle'?<div className="empty-state"><div className="forge-illustration" aria-hidden="true"><div className="orbit one"/><div className="orbit two"/><img src={`${import.meta.env.BASE_URL}icons/great-sword.svg`} alt=""/><span className="orbit-node node-a"><i className="pi pi-star-fill"/></span><span className="orbit-node node-b"><i className="pi pi-shield"/></span><span className="orbit-node node-c"><i className="pi pi-circle-fill"/></span></div><span className="eyebrow">SKILLS → EQUIPMENT → BUILD</span><h2>{t.emptyTitle}</h2><p>{t.emptyText}</p><Button label={t.example} icon="pi pi-arrow-right" iconPos="right" outlined onClick={useExample}/><div className="empty-footer"><i className="pi pi-desktop"/> {t.allLocal}</div></div>:<>
              <p className="search-caveat"><i className="pi pi-info-circle"/> {reason?t[reason]:phase==='exhausted'?t.exhaustedHint:t.partial}</p>
              {results.length?<><div className="results-title"><h2>{t.results} <span>{results.length}</span></h2><small>{t.bestFound}</small></div><div className="results-content"><div className="results-list">{results.map((b,i)=><button key={b.key} onClick={()=>setActiveKey(b.key)} className={`result-card ${selectedBuild?.key===b.key?'selected':''}`}><span className="result-rank">{String(i+1).padStart(2,'0')}</span><div className="result-title"><EquipmentIcon kind={b.weapon.kind}/><div><h3>{localized(b.weapon.name,lang)}</h3><small><WeaponType kind={b.weapon.kind} lang={lang}/></small></div><i className="pi pi-chevron-right"/></div><div className="result-stats"><span><i className="pi pi-shield"/> <b>{fmt(b.stats.defense,lang)}</b></span><span><i className="pi pi-bolt"/> <b>{fmt(b.stats.damage,lang,1)}</b></span><span><i className="pi pi-percentage"/> {b.stats.affinity}</span></div><div className="result-bottom"><span><i className="pi pi-check"/> {Object.keys(searchQuery.requirements).length}/{Object.keys(searchQuery.requirements).length} {t.skills.toLowerCase()}</span><small>{t[b.weapon.family]}</small></div></button>)}</div>{selectedBuild&&<BuildDetail key={selectedBuild.key} build={selectedBuild} query={searchQuery} {...{db,lang,t}} onSave={save} onExport={exportBuild}/>}</div></>:<div className="empty-state searching-empty"><i className={`pi ${phase==='running'?'pi-spin pi-spinner':'pi-search'}`}/><h2>{t.noResults}</h2><p>{t.noResultsHint}</p></div>}
            </>}
          </section>
        </div>
      </>}
      {page==='catalog'&&<Catalog {...{db,lang,t}}/>}
      {page==='sources'&&<Sources {...{db,lang,t}}/>}
      {page==='searches'&&<SearchArchive {...{archive,db,lang,t}} onResume={run=>archive.launch(run.query,run)} onClose={clearSearch} onError={showError}/>}
      {page==='saved'&&<section className="saved-page"><div className="page-heading"><div><span className="eyebrow">WILDS FORGE</span><h1>{t.saved}</h1><p>{t.emptySaved}</p></div><Button outlined icon="pi pi-upload" label={t.import} onClick={()=>fileInput.current.click()}/></div>{!saved.length?<div className="empty-state"><i className="pi pi-bookmark"/><h2>{t.noSaved}</h2><Button label={t.back} onClick={()=>setPage('forge')}/></div>:<div className="saved-grid">{saved.map((e,i)=><article key={`${e.build.key}:${i}`} className="saved-card"><EquipmentIcon kind={e.build.weapon.kind}/><div><h3>{localized(e.build.weapon.name,lang)}</h3><p>{t.defense} {e.build.stats.defense} · {t.damage} {fmt(e.build.stats.damage,lang,1)}</p><small>{new Date(e.createdAt).toLocaleDateString(lang)}</small></div><div><Button label={t.view} size="small" outlined onClick={()=>restore(e).catch(showError)}/><Button icon="pi pi-trash" text severity="secondary" aria-label={t.delete} onClick={()=>{const next=saved.filter((_,j)=>i!==j);setSaved(next);try{localStorage.setItem('wilds-builds',JSON.stringify(next));}catch{}}}/></div></article>)}</div>}</section>}
      <ScenarioDialog visible={scenarioOpen} onHide={()=>setScenarioOpen(false)} {...{db,lang,t,scenario,setScenario}}/>
    </main>}
    <footer className="site-footer"><span>WILDS FORGE <span className="footer-divider">/</span> <i className="pi pi-desktop"/> {t.noExternal}</span><button onClick={()=>setPage('sources')}>{t.targetVersion} {db?.meta.targetVersion||'…'} <span className="footer-divider">·</span> {t.unverified} <i className="pi pi-arrow-up-right"/></button>{cacheStatus&&<span className="cache-status">{t[cacheStatus]}</span>}</footer>
  </div>;
}
