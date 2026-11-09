import { ARMOR_KINDS, armorVariant, slotsFor, tally, satisfies,hasAttribute } from './equipment.js';
import { configureArtian } from './artian.js';
export function verifyBuild(db,build,query) {
  try {
    const errors=[];
    const base=db.weaponMap.get(build.weapon.baseId||build.weapon.id);
    if(!base)return {valid:false,errors:['Unknown weapon']};
    const weapon=base.family==='crafted'?base:configureArtian(db,base,build.weapon.config);
    const armor=build.armor.map(a=>db.armorMap.get(a.id)).filter(Boolean).map(a=>armorVariant(a,query.transcended));
    if(armor.length!==5||new Set(armor.map(a=>a.kind)).size!==5||!ARMOR_KINDS.every(k=>armor.some(a=>a.kind===k))) errors.push('Five distinct armor slots are required');
    if(query.weaponTypes?.length&&!query.weaponTypes.includes(weapon.kind))errors.push('Weapon type filter');
    if(query.weaponId&&query.weaponId!==base.id)errors.push('Fixed weapon filter');
    if(query.rank&&query.rank!=='all'&&armor.some(a=>a.rank!==query.rank))errors.push('Armor rank filter');
    if(query.families?.length&&!query.families.includes(weapon.family))errors.push('Weapon family filter');
    if(!hasAttribute(weapon,query.attribute))errors.push('Weapon attribute filter');
    let charm;
    if(build.charm?.random){
      const c=build.charm,template=db.randomCharms.find(x=>x.id===c.template),groups=new Map(db.charmGroups.map(g=>[g.id,g.skills]));
      if(!template||c.rolls.length!==template.groups.length||new Set(c.rolls.map(s=>s.id)).size!==c.rolls.length)errors.push('Invalid random charm');
      else {
        c.rolls.forEach((roll,i)=>{if(!groups.get(template.groups[i])?.some(s=>s.id===roll.id&&s.level===roll.level))errors.push('Illegal charm skill roll');});
        const slots=template.slots[c.slotVariant];if(!slots)errors.push('Illegal charm slots');
        charm={...c,skills:Object.fromEntries(c.rolls.map(s=>[s.id,s.level])),slots:slots||[],bonuses:{},rarity:template.rarity};
      }
    }else charm=db.charmMap.get(build.charm?.id);
    if(!charm)errors.push('Unknown charm');
    const slots=new Map(slotsFor(weapon,armor,charm).map(s=>[s.key,s])),used=new Set();
    for(const p of build.decorations){
      const d=db.decoMap.get(p.decoration),s=slots.get(p.slot);
      if(!d||!s||used.has(p.slot)||s.kind!==d.kind||s.level<d.slot)errors.push('Invalid decoration placement');
      used.add(p.slot);
    }
    const totals=tally(db,weapon,armor,charm,build.decorations);
    if(!satisfies(totals.levels,query.requirements))errors.push('Required skill levels are not satisfied');
    return {valid:!errors.length,errors,levels:totals.levels,points:totals.points,weapon,armor,charm};
  }catch(error){return {valid:false,errors:[error.message]};}
}
