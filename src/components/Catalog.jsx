import React,{useMemo,useState} from 'react';
import {InputText} from 'primereact/inputtext';
import {Button} from 'primereact/button';
import {Dialog} from 'primereact/dialog';
import {localized,partName} from '../i18n.js';
import {Badge,EquipmentIcon,SkillIcon,SkillRow,Sharpness,WeaponType,fmt} from './common.jsx';
import WeaponProperties from './WeaponProperties.jsx';
const fold=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export default function Catalog({db,lang,t}){
  const [kind,setKind]=useState('skills'),[term,setTerm]=useState(''),[count,setCount]=useState(30),[selected,setSelected]=useState(null);
  const list=useMemo(()=>{const q=fold(term);return db[kind].filter(e=>fold(localized(e.name,lang)+' '+localized(e.description,lang)+' '+localized(e.name,lang==='es'?'en':'es')).includes(q));},[db,kind,term,lang]);
  return <section className="catalog-page"><div className="page-heading"><div><span className="eyebrow">{t.eyebrow}</span><h1>{t.catalog}</h1></div><span className="search-input"><i className="pi pi-search"/><InputText value={term} onChange={e=>{setTerm(e.target.value);setCount(30);}} placeholder={t.searchCatalog}/></span></div>
    <div className="catalog-tabs" role="tablist">{['skills','armor','weapons','decorations','charms','items','monsters'].map(k=><button role="tab" aria-selected={kind===k} className={kind===k?'active':''} key={k} onClick={()=>{setKind(k);setCount(30);setSelected(null);}}>{t[k]} <small>{db[k].length}</small></button>)}</div>
    <p className="helper">{fmt(list.length,lang)} {t.matches}</p><div className="catalog-grid">{list.slice(0,count).map(e=><button className="catalog-card" key={e.id} onClick={()=>setSelected(e)}><div className="catalog-icon">{kind==='skills'?<SkillIcon skill={e}/>:['weapons','armor'].includes(kind)?<EquipmentIcon kind={e.kind}/>:<i className={`pi ${kind==='items'?'pi-box':kind==='charms'?'pi-bookmark':kind==='monsters'?'pi-globe':'pi-circle-fill'}`}/>}</div><div><div className="catalog-card-title">{localized(e.name,lang)}</div><p>{localized(e.description,lang)||t[e.kind]||''}</p><div className="tag-row">{e.rarity&&<Badge>R{e.rarity}</Badge>}{e.max&&<Badge>{t.level} {e.max}</Badge>}{e.attack&&<Badge tone="cyan">{t.attack} {e.attack}</Badge>}{e.defense&&<Badge tone="cyan"><i className="pi pi-shield"/> {e.defense.transcended||e.defense.max}</Badge>}</div></div><i className="pi pi-arrow-up-right"/></button>)}</div>
    {list.length>count&&<div className="load-more"><Button outlined label={`${t.more} (${list.length-count})`} onClick={()=>setCount(count+60)}/></div>}
    <Dialog visible={!!selected} onHide={()=>setSelected(null)} header={selected&&localized(selected.name,lang)} style={{width:'640px',maxWidth:'95vw'}} draggable={false} modal>{selected&&<><p className="catalog-description">{localized(selected.description,lang)}</p>{kind==='skills'?<div className="skill-level-descriptions">{selected.ranks.map(r=><div key={r.level}><Badge tone="cyan">{t.level} {r.level}</Badge><div><b>{localized(r.name,lang)}</b><p>{localized(r.description,lang)}</p>{r.points&&<small>{r.points} {t.points}</small>}</div></div>)}</div>:<>
      {selected.kind&&WEAPON_TYPES_SAFE(selected.kind)&&<h3><WeaponType kind={selected.kind} lang={lang}/></h3>}
      {selected.attack&&<p>{t.attack}: <b>{selected.attack}</b> · {t.affinity}: <b>{selected.affinity}%</b></p>}
      {selected.defense&&<p>{t.defense}: {t.base} <b>{selected.defense.base}</b> · {t.max} <b>{selected.defense.max}</b> · {t.enhanced} <b>{selected.defense.transcended??'—'}</b></p>}
      <Sharpness values={selected.sharpness} label={t.sharpness}/>
      {kind==='weapons'&&<WeaponProperties weapon={selected} lang={lang}/>}
      <div className="skills-list">{Object.entries(selected.skills||{}).map(([id,n])=><SkillRow key={id} skill={db.skillMap.get(+id)} level={n} lang={lang}/>)}</div>
      {selected.parts&&<div className="tag-row">{selected.parts.map(p=><Badge key={p.id}>{partName(p,lang)}</Badge>)}</div>}
      {selected.materials?.length>0&&<><h3>{t.materials}</h3><div className="materials-list">{selected.materials.map((m,i)=><div key={i}><span>{localized(db.itemMap.get(m.item)?.name||m.name,lang)}</span><b>× {m.quantity}</b></div>)}</div></>}
    </>}</>}</Dialog>
  </section>;
}
function WEAPON_TYPES_SAFE(kind){return ['bow','great-sword','long-sword','sword-shield','dual-blades','hammer','hunting-horn','lance','gunlance','switch-axe','charge-blade','insect-glaive','light-bowgun','heavy-bowgun'].includes(kind);}
