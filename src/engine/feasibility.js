import {createDecorationSolver} from './decoration-solver.js';

export function prepareCharms(db,lists,requirements,charms,solver){
  const ids=solver.ids;
  const plans=charms.map(charm=>{
    const slots=charm.slots.map((s,i)=>({key:`charm:${i}`,...(typeof s==='number'?{kind:'armor',level:s}:s)}));
    return {charm,slots,counts:solver.countsFor(slots),levels:ids.map(id=>charm.skills[id]||0)};
  });
  // An armor's native skills are included optimistically. This remains safe if
  // future equipment gains native weapon skills. Cross-kind jewels fall back to
  // the complete solver instead of being rejected by this preliminary test.
  const weaponIds=ids.filter(id=>db.skillMap.get(+id)?.kind==='weapon'&&!db.decorations.some(d=>d.kind==='armor'&&d.skills[id]));
  if(!weaponIds.length)return {plans,forWeapon:()=>plans,hasWeaponRequirements:false};
  const req=Object.fromEntries(weaponIds.map(id=>[id,requirements[id]])),weaponSolver=createDecorationSolver(db,req);
  const armorUpper=Object.fromEntries(weaponIds.map(id=>[id,lists.slice(1).reduce((sum,list)=>sum+Math.max(0,...list.map(a=>a.skills[id]||0)),0)]));
  const signature=plan=>weaponIds.map(id=>plan.charm.skills[id]||0).join(',')+'|'+plan.counts.slice(0,4).join(',');
  const groups=new Map();for(const p of plans){p.weaponSignature=signature(p);if(!groups.has(p.weaponSignature))groups.set(p.weaponSignature,p);}
  const cache=new Map();
  function forWeapon(w){
    const key=weaponIds.map(id=>w.skills[id]||0).join(',')+'|'+w.slots.join(',');
    if(cache.has(key))return cache.get(key);
    const slots=w.slots.map((level,i)=>({key:`weapon:${i}`,level,kind:'weapon'})),allowed=new Set();
    for(const [sig,plan] of groups){
      const levels=Object.fromEntries(weaponIds.map(id=>[id,(w.skills[id]||0)+(armorUpper[id]||0)+(plan.charm.skills[id]||0)]));
      if(weaponSolver.place(levels,[...slots,...plan.slots.filter(s=>s.kind==='weapon')]))allowed.add(sig);
    }
    const compatible=plans.filter(p=>allowed.has(p.weaponSignature));cache.set(key,compatible);return compatible;
  }
  return {plans,forWeapon,hasWeaponRequirements:true};
}
