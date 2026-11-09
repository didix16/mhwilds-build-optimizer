import React from 'react';
import {localized} from '../i18n.js';
import {WEAPON_TYPES,COLORS} from '../engine/equipment.js';
export const fmt=(n,lang,digits=0)=>Number(n||0).toLocaleString(lang,{maximumFractionDigits:digits});
const iconName={head:'helm',chest:'body',arms:'arms',waist:'waist',legs:'legs','sword-shield':'sword-and-shield'};
export function EquipmentIcon({kind,className=''}){return <img className={`equipment-icon ${className}`} src={`${import.meta.env.BASE_URL}icons/${iconName[kind]||kind}.svg`} alt=""/>;}
export function SkillIcon({skill}){return skill?.icon?<img className="skill-icon" src={import.meta.env.BASE_URL+skill.icon} alt=""/>:<span className={`skill-icon generic ${skill?.kind||''}`}><i className={`pi ${skill?.kind==='set'?'pi-sparkles':skill?.kind==='group'?'pi-th-large':'pi-star-fill'}`}/></span>;}
export function Sharpness({values,label}){return values?<div className="sharpness-wrap"><div className="sharpness-bar" role="img" aria-label={label}>{values.map((n,i)=>n>0?<span key={i} style={{flex:n,background:`var(--sharp-${COLORS[i]})`}} title={`${COLORS[i]}: ${n}`}/>:null)}</div></div>:null;}
export function SectionTitle({icon,children,aside}){return <div className="section-title"><h2>{icon&&<i className={`pi ${icon}`}/>} {children}</h2>{aside}</div>;}
export function Stat({label,value,unit,accent,icon,sub}){return <div className={`stat ${accent?'accent':''}`}><span className="stat-label">{icon&&<i className={`pi ${icon}`}/>} {label}</span><strong>{value}<small>{unit}</small></strong>{sub&&<span className="stat-sub">{sub}</span>}</div>;}
export function Badge({children,tone='neutral'}){return <span className={`badge ${tone}`}>{children}</span>;}
export function WeaponType({kind,lang}){return WEAPON_TYPES[kind]?.[lang==='es'?1:0]||kind;}
export function SkillRow({skill,level,lang,required=0,points}){return <div className="skill-line" title={localized(skill?.ranks?.find(r=>r.level===level)?.description,lang)||localized(skill?.description,lang)}><SkillIcon skill={skill}/><span className="skill-line-name">{localized(skill?.name,lang)}{points>0&&<small>{points} / {skill.ranks.find(r=>r.level===level)?.points||0}</small>}</span><div className="skill-pips">{Array.from({length:skill?.max||1},(_,i)=><span key={i} className={i<level?(i<required?'required':'filled'):''}/>)}</div><b className={level>=required&&required?'cyan':''}>{level}<span>/{skill?.max}</span></b></div>;}
