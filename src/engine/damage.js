import * as Ref from './combat-reference.mjs';
import { WEAPON_TYPES, capitalize } from './equipment.js';

export const attacksFor = kind => Ref.Attacks[WEAPON_TYPES[kind]?.[0]]||[];
export const referenceBuffs = Ref.CombinedBuffs;
export function attackCompatible(weapon,attack) {
  if(attack.ammo&&weapon.properties?.ammo){const ammo=weapon.properties.ammo.find(a=>a.kind===attack.ammo.type.toLowerCase()&&a.level===attack.ammo.level);if(!ammo||attack.rapidFire&&!ammo.rapid)return false;}
  if(attack.shelling?.type&&weapon.properties?.shell!==attack.shelling.type.toLowerCase())return false;
  if(attack.shelling?.level&&weapon.properties?.shellLevel!==attack.shelling.level)return false;
  return true;
}
export function skillDefinition(skill,kind) {
  const all={...Ref.WeaponArmorSkills,...Ref.SeriesSkillsCombined,...Ref.GroupSkillsCombined};
  const def=all[skill.name.en];
  return def?.groups ? {...def,...def.groups.find(g=>g.weapons.includes(WEAPON_TYPES[kind]?.[0]))} : def;
}
export function buffsFor(db,levels,weapon,scenario={}) {
  const buffs={},unmodeled=[];
  for(const [id,level] of Object.entries(levels)) {
    if(!level)continue;const skill=db.skillMap.get(+id);if(!skill)continue;
    const definition=skillDefinition(skill,weapon.kind);
    const threshold=['set','group'].includes(skill.kind)?skill.ranks.find(r=>r.level===level)?.points:level;
    const effect=definition?.levels?.[threshold];
    if(!effect || !Object.keys(effect).some(k=>k!=='name')) {unmodeled.push(+id);continue;}
    if((definition.uptime||definition.toggle)&&!scenario.activeSkills?.includes(+id)) continue;
    buffs[skill.name.en]=effect;
  }
  for(const [id,level] of Object.entries(scenario.buffs||{})) {
    const def=Ref.CombinedBuffs[id];if(!def||!level)continue;
    if(def.weapons&&!def.weapons.includes(WEAPON_TYPES[weapon.kind]?.[0]))continue;
    const effect=def.levels[level-1];if(effect)buffs[id]=effect;
  }
  if(scenario.extraAttack)buffs.ManualAttack={attack:scenario.extraAttack};
  return {buffs,unmodeled};
}
function toReference(w) {
  const elemental=w.specials.find(x=>x.kind==='element');
  const status=w.specials.find(x=>x.kind==='status');
  return {type:WEAPON_TYPES[w.kind][0],attack:w.attack,affinity:w.affinity,sharpness:w.sharpness||undefined,handicraft:w.handicraft,element:elemental?{type:capitalize(elemental.element),value:elemental.damage.display}:undefined,status:status?{type:capitalize(status.status),value:status.damage.display}:undefined,phial:capitalize(typeof w.properties?.phial==='string'?w.properties.phial:w.properties?.phial?.kind),shelling:w.properties?.shell?{type:capitalize(w.properties.shell),level:w.properties.shellLevel}:undefined};
}
export function extendedSharpness(sharpness,handicraft,points) {
  if(!sharpness)return null;
  const result=[...sharpness];let i=result.findLastIndex(v=>v>0);
  for(const segment of handicraft||[]) {
    if(i>=7||points<=0)break;
    const capacity=segment*10;
    if(capacity===0){i++;continue;}
    const extra=Math.min(points,capacity);result[i]+=extra;points-=extra;i++;
  }
  return result;
}
export function statistics(db,weapon,armor,levels,scenario={}) {
  const {buffs,unmodeled}=buffsFor(db,levels,weapon,scenario);
  let w=toReference(weapon);
  const handicraft=db.skills.find(s=>s.name.en==='Handicraft');
  if(w.sharpness)w={...w,sharpness:extendedSharpness(w.sharpness,w.handicraft,(levels[handicraft?.id]||0)*10)};
  const hz=scenario.hitzones||{slash:.45,blunt:.45,pierce:.45,fire:.2,water:.2,ice:.2,thunder:.2,dragon:.2};
  const target={Slash:hz.slash*100,Blunt:hz.blunt*100,Shot:hz.pierce*100,Fire:hz.fire*100,Water:hz.water*100,Ice:hz.ice*100,Thunder:hz.thunder*100,Dragon:hz.dragon*100,wound:!!scenario.wound};
  const attacks=attacksFor(weapon.kind);
  const selected=scenario.combos?.[weapon.kind]||[{index:Math.max(0,attacks.findIndex(a=>attackCompatible(weapon,a))),count:1}];
  let damage=0,hit=0,crit=0;const breakdown=[],incompatible=[];
  for(const entry of selected) {
    const attack=attacks[entry.index];if(!attack)continue;
    if(!attackCompatible(weapon,attack)){incompatible.push(attack.name);continue;}
    const rawType=attack.rawType||'Slash';
    const affinity=Ref.calculateAffinity({affinity:w.affinity,buffs,target,rawType});
    const critMulti=attack.cantCrit?1:(affinity<0?.75:(buffs['Critical Boost']?.criticalBoost||1.25));
    const eleCrit=attack.cantCrit||affinity<0?1:(buffs['Critical Element']?.criticalElement||1);
    const noncrit=Ref.calculateHit(w,buffs,attack,target),critical=Ref.calculateCrit(w,buffs,attack,target,critMulti,eleCrit);
    const count=(attack.hits||1)*entry.count;
    const average=noncrit+(critical-noncrit)*Math.abs(affinity)/100;
    damage+=average*count;hit+=noncrit*count;crit+=critical*count;
    breakdown.push({name:attack.name,index:entry.index,count,hit:noncrit,crit:critical,average});
  }
  let defense=weapon.defenseBonus+armor.reduce((n,a)=>n+(a.currentDefense??a.defense.max),0);
  const levelOf=name=>levels[db.skills.find(s=>s.name.en===name)?.id]||0;
  const dl=levelOf('Defense Boost');
  const defMul=[1,1,1,1.05,1.05,1.08,1.08,1.1][dl]||1;
  defense=Math.floor(defense*defMul+[0,5,10,10,20,20,35,35][dl]);
  const resistances={fire:0,water:0,thunder:0,ice:0,dragon:0};
  for(const a of armor)for(const key of Object.keys(resistances))resistances[key]+=a.resistances[key]||0;
  for(const [key,value] of Object.entries(resistances)) {
    const l=levelOf(`${capitalize(key)} Resistance`);resistances[key]=value+[0,6,12,20][l]+(dl>=4?([0,0,0,0,3,3,5,5][dl]||0):0);if(l===3)defense+=10;
  }
  const attack=Ref.calculateAttack(w.attack,buffs),affinity=Ref.calculateAffinity({affinity:w.affinity,buffs,target,rawType:attacks[selected[0]?.index]?.rawType||'Slash'});
  return {attack,displayAttack:Math.floor(attack*weapon.displayFactor),affinity,defense,resistances,sharpness:w.sharpness,element:w.element?{type:w.element.type,value:Ref.calculateElement(w.element.value,w.element.type,buffs)}:null,status:w.status?{type:w.status.type,value:Ref.calculateStatus(w.status.value,w.status.type,buffs)}:null,damage:Math.round(damage*100)/100,hit,crit,breakdown,unmodeled,incompatible};
}
