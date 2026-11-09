import React from 'react';
import {Badge} from './common.jsx';
const labels={en:{ammo:'Ammunition',capacity:'Capacity',rapid:'Rapid fire',phial:'Phial',shell:'Shelling',coatings:'Coatings',kinsect:'Kinsect level',melody:'Melodies',bubble:'Echo bubble',wave:'Echo wave'},es:{ammo:'Munición',capacity:'Capacidad',rapid:'Disparo rápido',phial:'Vial',shell:'Bombardeo',coatings:'Revestimientos',kinsect:'Nivel de kinsecto',melody:'Melodías',bubble:'Burbuja eco',wave:'Onda eco'}};
const translate={en:{},es:{normal:'Normal',pierce:'Perforante',spread:'Dispersa',sticky:'Adhesiva',cluster:'Racimo',flaming:'Fuego',water:'Agua',freeze:'Hielo',thunder:'Rayo',dragon:'Draco',slicing:'Cortante',wyvern:'Wyvern',poison:'Veneno',paralysis:'Parálisis',sleep:'Sueño',exhaust:'Exhaustiva',recover:'Recuperación',demon:'Demonio',armor:'Armadura',tranq:'Tranquilizante',power:'Potencia',element:'Elemento',impact:'Impacto',long:'Largo',wide:'Ancho',blast:'Nitro','close-range':'Corta distancia'}};
export default function WeaponProperties({weapon,lang}){
  const p=weapon.properties||{},l=labels[lang],tx=k=>translate[lang]?.[k]||k?.replace(/^./,s=>s.toUpperCase()),local=weapon.localizedProperties?.[lang]||{};
  return <div className="weapon-properties">
    {p.ammo?.length>0&&<><p className="tiny-label">{l.ammo}</p><div className="ammo-table">{p.ammo.map((a,i)=><div key={i}><span>{tx(a.kind)} {a.level}</span><b>{l.capacity} {a.capacity}{a.rapid?' · '+l.rapid:''}</b></div>)}</div></>}
    <div className="tag-row">{p.phial&&<Badge>{l.phial}: {tx(typeof p.phial==='string'?p.phial:p.phial.kind)}</Badge>}{p.shell&&<Badge>{l.shell}: {tx(p.shell)} {p.shellLevel}</Badge>}{p.kinsectLevel&&<Badge>{l.kinsect}: {p.kinsectLevel}</Badge>}{p.coatings?.map(c=><Badge key={c}>{l.coatings}: {tx(c)}</Badge>)}</div>
    {local.melody?.songs?.length>0&&<><p className="tiny-label">{l.melody}</p><div className="tag-row">{local.melody.songs.map((s,i)=><Badge key={i}>{s.name}</Badge>)}</div></>}
    {local.echoBubble&&<p className="helper">{l.bubble}: {local.echoBubble.name}</p>}{local.echoWave&&<p className="helper">{l.wave}: {local.echoWave.name}</p>}
  </div>;
}
