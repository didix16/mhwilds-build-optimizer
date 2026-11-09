import { add } from './equipment.js';

// Exact feasibility search: each jewel consumes one compatible slot, including both
// skills of combination jewels. Equivalent empty slots are symmetric and memoized.
export function placeDecorations(db,requirements,levels,slots) {
  const ids=Object.keys(requirements).filter(id=>(levels[id]||0)<requirements[id]&&!['set','group'].includes(db.skillMap.get(+id)?.kind));
  const remaining=ids.map(id=>Math.max(0,requirements[id]-(levels[id]||0)));
  if(!ids.length)return [];
  const relevant=db.decorations.filter(d=>ids.some(id=>d.skills[id]));
  const memo=new Set();
  function visit(gaps,free){
    if(gaps.every(x=>x===0))return [];
    const state=gaps.join(',')+'|'+free.map(s=>s.kind[0]+s.level).sort().join(',');
    if(memo.has(state))return null;
    memo.add(state);
    let choices=null;
    for(let i=0;i<ids.length;i++)if(gaps[i]>0){
      const options=[];
      for(const d of relevant)if(d.skills[ids[i]]){
        const s=free.filter(s=>s.kind===d.kind&&s.level>=d.slot).sort((a,b)=>a.level-b.level)[0];
        if(s)options.push({d,s,gain:ids.reduce((n,id,j)=>n+Math.min(gaps[j],d.skills[id]||0),0)});
      }
      if(!options.length)return null;
      if(!choices||options.length<choices.length)choices=options;
    }
    choices.sort((a,b)=>b.gain-a.gain||a.d.slot-b.d.slot);
    const seen=new Set();
    for(const {d,s} of choices){
      const next=gaps.map((n,j)=>Math.max(0,n-(d.skills[ids[j]]||0)));
      const signature=next.join(',')+':'+s.kind+':'+s.level;if(seen.has(signature))continue;seen.add(signature);
      const tail=visit(next,free.filter(x=>x.key!==s.key));
      if(tail)return [{slot:s.key,decoration:d.id},...tail];
    }
    return null;
  }
  return visit(remaining,slots);
}

export function charmCandidates(db,requirements,priority='defense',scenario={}) {
  const relevant=new Set(Object.keys(requirements).map(Number));
  const extra=priority==='defense'?['Defense Boost', 'Fire Resistance','Water Resistance','Thunder Resistance','Ice Resistance','Dragon Resistance']:['Attack Boost','Critical Eye','Critical Boost','Weakness Exploit','Handicraft',...Object.keys(requirements).map(id=>db.skillMap.get(+id)?.name.en)];
  for(const s of db.skills)if(extra.includes(s.name.en)||scenario.activeSkills?.includes(s.id))relevant.add(s.id);
  const groups=new Map(db.charmGroups.map(g=>[g.id,g.skills]));
  const results=[...db.charms],seen=new Map();
  for(const template of db.randomCharms){
    const pools=template.groups.map(g=>{const pool=groups.get(g)||[];return [...pool.filter(s=>relevant.has(s.id)),...pool.filter(s=>!relevant.has(s.id)).slice(0,3)];});
    function generate(index,selected){
      if(index<pools.length){for(const s of pools[index])if(!selected.some(x=>x.id===s.id))generate(index+1,[...selected,s]);return;}
      const skills=Object.fromEntries(selected.map(s=>[s.id,s.level]));
      for(let si=0;si<template.slots.length;si++){
        const slots=template.slots[si];const signature=Object.keys(skills).filter(k=>relevant.has(+k)).sort((a,b)=>a-b).map(k=>k+':'+skills[k]).join(',')+'|'+slots.map(s=>s.kind+s.level).sort().join(',');
        const previous=seen.get(signature);if(previous&&previous.rarity>=template.rarity)continue;
        const charm={id:`${template.id}:${selected.map(s=>s.id).join('-')}:${si}`,name:template.name,rarity:template.rarity,skills,bonuses:{},slots,random:true,template:template.id,rolls:selected.map(s=>({...s})),slotVariant:si,materials:[]};
        seen.set(signature,charm);
      }
    }
    generate(0,[]);
  }
  results.push(...seen.values());
  const value=c=>Object.entries(c.skills).reduce((n,[id,l])=>n+Math.min(l,requirements[id]||0)*10+(relevant.has(+id)?l*.5:0),0)+c.slots.reduce((n,s)=>n+(s.level||s)*.4,0)+c.rarity*.05;
  return results.sort((a,b)=>value(b)-value(a));
}
