import React,{useMemo,useState} from 'react';
import {Button} from 'primereact/button';
import {Accordion,AccordionTab} from 'primereact/accordion';
import {localized} from '../i18n.js';
import {slotsFor,collectMaterials} from '../engine/equipment.js';
import {Badge,EquipmentIcon,Sharpness,SkillRow,Stat,WeaponType,fmt} from './common.jsx';
import WeaponProperties from './WeaponProperties.jsx';

function EquipmentRow({item,owner,build,db,lang,t}){
  const slots=slotsFor(build.weapon,build.armor,build.charm).filter(s=>s.owner===owner);
  const skillList=Object.entries(item.skills||{}).map(([id,n])=>`${localized(db.skillMap.get(+id)?.name,lang)} ${n}`).join(' · ');
  return <div className="equipment-row"><div className={`equip-tile rarity-${item.rarity}`}>
    {owner==='charm'?<i className="pi pi-bookmark"/>:<EquipmentIcon kind={owner==='weapon'?item.kind:owner}/>}</div>
    <div className="equipment-body"><div className="equipment-top"><div><span className="equip-kind">{t[owner]}</span><h4>{localized(item.name,lang)}</h4></div><span className="rarity">R{item.rarity}</span></div>
    <p className="equip-skill-summary">{skillList||((item.family==='gogma'||item.random)?t.theoretical:'—')}</p>
    {Object.entries(item.bonuses||{}).length>0&&<p className="equip-bonuses">{Object.keys(item.bonuses).map(id=>localized(db.skillMap.get(+id)?.name,lang)).join(' · ')}</p>}
    {slots.length>0?<div className="slots-row">{slots.map(s=>{const placement=build.decorations.find(p=>p.slot===s.key),deco=db.decoMap.get(placement?.decoration);return <div key={s.key} className={`slot-cell ${s.kind} ${deco?'occupied':''}`} title={`${s.kind==='weapon'?t.weaponSlot:t.armorSlot} ${s.level}: ${deco?localized(deco.name,lang):t.freeSlot}`}><span className="slot-diamond"><b>{s.level}</b></span><span>{deco?localized(deco.name,lang):t.freeSlot}</span></div>;})}</div>:<span className="no-slots">{t.noSlots}</span>}
    {item.defense&&!item.upgradeCoverage&&<small className="coverage-warning">{t.unknownUpgrade}</small>}
    {item.defense&&<span className="equipment-defense"><i className="pi pi-shield"/> {item.currentDefense} <small>{item.upgraded?t.enhanced:t.max}</small></span>}
  </div></div>;
}
export default function BuildDetail({build,query,db,lang,t,onSave,onExport}){
  const [showAll,setShowAll]=useState(false);
  const materials=useMemo(()=>collectMaterials(db,build),[build,db]);
  const entries=Object.entries(build.levels).filter(([,n])=>n>0).sort(([a],[b])=>Number(!!query.requirements[b])-Number(!!query.requirements[a])||localized(db.skillMap.get(+a)?.name,lang).localeCompare(localized(db.skillMap.get(+b)?.name,lang),lang));
  const w=build.weapon,stats=build.stats;
  return <article className="build-detail" aria-label={t.details}>
    <div className="detail-heading"><div><div className="eyebrow"><WeaponType kind={w.kind} lang={lang}/></div><h2>{localized(w.name,lang)}</h2><Badge tone="success"><i className="pi pi-check-circle"/> {t.verified}</Badge></div><div className="detail-actions"><Button icon="pi pi-bookmark" rounded text aria-label={t.save} tooltip={t.save} onClick={()=>onSave(build)}/><Button icon="pi pi-download" rounded text aria-label={t.export} tooltip={t.export} onClick={()=>onExport(build)}/></div></div>
    <div className="stats-grid"><Stat label={t.attack} value={fmt(stats.attack,lang,1)} sub={`${t.displayAttack}: ${fmt(stats.displayAttack,lang)}`}/><Stat label={t.affinity} value={fmt(stats.affinity,lang)} unit="%"/><Stat label={t.defense} value={fmt(stats.defense,lang)} icon="pi-shield"/><Stat label={t.damage} value={fmt(stats.damage,lang,2)} accent sub={t.combo}/></div>
    <div className="weapon-extra"><div><span className="tiny-label">{stats.sharpness?t.sharpness:t.ranged}</span><Sharpness values={stats.sharpness} label={t.sharpness}/></div>{stats.element&&<Badge tone="cyan">{t[stats.element.type.toLowerCase()]} {fmt(stats.element.value,lang)}</Badge>}{stats.status&&<Badge>{t[stats.status.type.toLowerCase()]} {fmt(stats.status.value,lang)}</Badge>}</div>
    <WeaponProperties weapon={w} lang={lang}/>
    {stats.incompatible?.length>0&&<p className="notice amber">{lang==='es'?'Movimientos incompatibles con este equipo, excluidos del daño: ':'Attacks incompatible with this weapon, excluded from damage: '}{stats.incompatible.join(' · ')}</p>}
    <div className="detail-section-label"><span>01</span> {t.equipment}</div>
    <EquipmentRow item={w} owner="weapon" {...{build,db,lang,t}}/>
    {build.armor.map(a=><EquipmentRow key={a.id} item={a} owner={a.kind} {...{build,db,lang,t}}/>)}
    <EquipmentRow item={build.charm} owner="charm" {...{build,db,lang,t}}/>
    <div className="detail-section-label"><span>02</span> {t.allSkills}<Badge tone="cyan">{entries.length}</Badge></div>
    <div className="skills-list">{entries.slice(0,showAll?undefined:9).map(([id,n])=><SkillRow key={id} skill={db.skillMap.get(+id)} level={n} required={query.requirements[id]||0} points={build.points[id]} lang={lang}/>)}</div>
    {entries.length>9&&<Button className="show-more" text size="small" label={showAll?t.showLess:`${t.more} (${entries.length-9})`} onClick={()=>setShowAll(!showAll)}/>}
    <Accordion multiple className="details-accordion">
      <AccordionTab header={<span><i className="pi pi-chart-bar"/> {t.combo}</span>}><div className="overflow-x-auto"><table className="damage-table"><thead><tr><th>{t.referenceMove}</th><th>×</th><th>{t.hit}</th><th>{t.crit}</th><th>{t.average}</th></tr></thead><tbody>{stats.breakdown.map((a,i)=><tr key={i}><td>{a.name}</td><td>{a.count}</td><td>{fmt(a.hit,lang,1)}</td><td>{fmt(a.crit,lang,1)}</td><td>{fmt(a.average,lang,2)}</td></tr>)}</tbody></table></div><p className="helper">{t.scenarioHint}</p><p className="helper">{t.referenceNotice}</p>{stats.unmodeled.length>0&&<details className="model-gaps"><summary>{t.unmodeled} ({stats.unmodeled.length})</summary><p>{stats.unmodeled.map(id=>localized(db.skillMap.get(id)?.name,lang)).join(' · ')}</p></details>}</AccordionTab>
      {w.config&&<AccordionTab header={<span><i className="pi pi-sliders-h"/> {t.configuration}</span>}><div className="config-grid"><div><span>{t.attribute}</span><b>{t[w.config.attribute]}</b></div>{w.focus&&<div><span>{t.focus}</span><b>{t[w.focus]||w.focus}</b></div>}<div><span>{t.attackInfusion}</span><b>× {w.config.infusionAttack}</b></div><div><span>{t.affinityInfusion}</span><b>× {3-w.config.infusionAttack}</b></div></div><p className="tiny-label">{t.reinforcements}</p><div className="tag-row">{Object.entries(w.config.reinforcements).filter(([,n])=>n).map(([k,n])=><Badge key={k}>{t[k]||t.sharpAmmo} × {n}{w.family==='gogma'?` (${Math.min(2,n)} EX${n>2?`, ${Math.min(2,n-2)} III/II`:''})`:' I'}</Badge>)}</div><p className="helper">{w.config.parts.join(' + ')} · {t.theoretical}</p></AccordionTab>}
      <AccordionTab header={<span><i className="pi pi-box"/> {t.materials} <small>{materials.items.length}</small></span>}><p className="helper">{t.materialHint}</p><div className="materials-list">{materials.items.map((m,i)=><div key={i}><span>{localized(db.itemMap.get(m.item)?.name||m.name,lang)}</span><strong>× {m.quantity}</strong></div>)}</div><div className="zenny-row"><span>{t.zenny}</span><b>{fmt(materials.zenny,lang)} z</b></div>{(w.config||build.charm.random)&&<p className="helper amber">{t.randomCost}</p>}</AccordionTab>
      <AccordionTab header={<span><i className="pi pi-shield"/> {t.resistances}</span>}><div className="resistance-grid">{Object.entries(stats.resistances).map(([k,n])=><div key={k}><span>{t[k]}</span><b className={n<0?'negative':''}>{n>0?'+':''}{n}</b></div>)}</div></AccordionTab>
    </Accordion>
  </article>;
}
