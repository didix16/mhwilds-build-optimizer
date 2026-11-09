import { statistics } from './damage.js';
export const ELEMENTS=['fire','water','thunder','ice','dragon'];
export const ATTRIBUTES=['none',...ELEMENTS,'poison','paralysis','sleep','blast'];
export const GOGMA_SETS=["Arkveld's Hunger","Blangonga's Spirit","Doshaguma's Might","Ebony Odogaron's Power","Fulgur Anjanath's Will","Gogmapocalypse","Gore Magala's Tyranny","Gravios's Protection","Guardian Arkveld's Vitality","Jin Dahaad's Revolt","Leviathan's Fury","Mizutsune's Prowess","Nu Udra's Mutiny","Omega Resonance","Rathalos's Flare","Rey Dau's Voltage","Seregios's Tenacity","Soul of the Dark Knight","Uth Duna's Cover","Xu Wu's Vigor","Zoh Shia's Pulse"];
export const GOGMA_GROUPS=['Alluring Pelt','Buttery Leathercraft','Flexible Leathercraft','Fortifying Pelt',"Guardian's Protection","Guardian's Pulse",'Imparted Wisdom',"Lord's Favor","Lord's Fury","Lord's Soul",'Neopteron Alert','Neopteron Camouflage','Scale Layering','Scaling Prowess'];
const EBOOST={ 'great-sword':[80,90,110],'long-sword':[50,60,90],'sword-shield':[30,50,80],'dual-blades':[20,30,50],hammer:[50,60,90],'hunting-horn':[50,60,90],lance:[50,60,90],gunlance:[50,60,90],'switch-axe':[30,50,80],'charge-blade':[50,60,80],'insect-glaive':[30,50,80],bow:[30,40,60] };
const FOCUS_ELEM={ 'great-sword':[50,-10],'long-sword':[50,-20],'sword-shield':[40,-20],'dual-blades':[30,-20],hammer:[40,-10],'hunting-horn':[80,20],lance:[50,-20],gunlance:[80,30],'switch-axe':[40,-20],'charge-blade':[50,-20],'insect-glaive':[40,-20],bow:[30,-20] };
const PARTS={ 'great-sword':['Blade','Blade','Tube'],'sword-shield':['Blade','Tube','Disc'],'dual-blades':['Blade','Blade','Disc'],'long-sword':['Blade','Tube','Tube'],hammer:['Disc','Disc','Tube'],'hunting-horn':['Disc','Device','Device'],lance:['Blade','Disc','Disc'],gunlance:['Disc','Disc','Device'],'switch-axe':['Blade','Blade','Device'],'charge-blade':['Blade','Disc','Device'],'insect-glaive':['Blade','Tube','Device'],bow:['Tube','Tube','Device'],'heavy-bowgun':['Disc','Tube','Device'],'light-bowgun':['Tube','Device','Device'] };
export function reinforcementProfiles(weapon) {
  const profiles=[],ranged=!weapon.sharpness,bowgun=weapon.kind.includes('bowgun');
  for(let attack=0;attack<=5;attack++)for(let affinity=0;affinity<=5-attack;affinity++)for(let element=0;element<=5-attack-affinity;element++){
    const sharpness=5-attack-affinity-element;
    if(sharpness>2||ranged&&!bowgun&&sharpness||bowgun&&element)continue;
    if(weapon.family==='gogma'&&element>4)continue;
    profiles.push({attack,affinity,element,sharpness});
  }
  return profiles;
}
const highTier=(n,ex,third,second)=>Math.min(n,2)*ex+Math.min(Math.max(n-2,0),2)*third+Math.max(n-4,0)*second;
export function configureArtian(db,base,config) {
  const {attribute,infusionAttack,reinforcements:p}=config;
  if(!ATTRIBUTES.includes(attribute)||!Number.isInteger(infusionAttack)||infusionAttack<0||infusionAttack>3)throw Error('Invalid infusion');
  if(!p||Object.keys(p).sort().join(',')!=='affinity,attack,element,sharpness'||Object.values(p).some(n=>!Number.isInteger(n)||n<0)||Object.values(p).reduce((n,x)=>n+x,0)!==5||p.sharpness>2)throw Error('Invalid reinforcement profile');
  const ranged=!base.sharpness,bowgun=base.kind.includes('bowgun'),gogma=base.family==='gogma';
  if((ranged&&!bowgun&&p.sharpness)||(bowgun&&p.element)||(attribute==='none'&&p.element)||(base.kind==='bow'&&!ELEMENTS.includes(attribute)&&p.element)||(gogma&&p.element>4))throw Error('Incompatible reinforcement');
  if(3-infusionAttack+p.affinity>6)throw Error('Affinity reinforcement limit');
  const valueKey=ELEMENTS.includes(attribute)?'element':(['poison','blast'].includes(attribute)?'poison':'paralysis');
  const values=db.artian[base.kind]?.[valueKey];
  let special=0;
  if(attribute!=='none'&&!bowgun&&values){
    special=values[base.rarity===8?1:0]+(db.artian[base.kind].element?.[2]||0);
    if(gogma)special+=(base.focus==='element'?FOCUS_ELEM[base.kind]?.[0]||0:base.focus==='affinity'?FOCUS_ELEM[base.kind]?.[1]||0:base.kind==='hunting-horn'?30:base.kind==='gunlance'?40:0);
    special+=gogma?highTier(p.element,EBOOST[base.kind]?.[2]||0,EBOOST[base.kind]?.[1]||0,0):p.element*(EBOOST[base.kind]?.[0]||0);
  }
  const sharpness=base.sharpness?[...base.sharpness]:null;
  if(sharpness){const i=sharpness.findLastIndex(v=>v>0);sharpness[i]+=p.sharpness*(gogma?50:base.kind==='insect-glaive'?20:30);}
  const bonuses={};
  if(gogma){
    const set=db.skillMap.get(config.setSkill),group=db.skillMap.get(config.groupSkill);
    if(!set||!group||!GOGMA_SETS.includes(set.name.en)||!GOGMA_GROUPS.includes(group.name.en))throw Error('Invalid Gogma skill pair');
    bonuses[set.id]=1;bonuses[group.id]=1;
  }
  const attack=base.attack+infusionAttack*5+(gogma?highTier(p.attack,12,9,6):p.attack*5);
  const affinity=base.affinity+(3-infusionAttack)*5+(gogma?highTier(p.affinity,10,8,6):p.affinity*5);
  const specials=special>0?[ELEMENTS.includes(attribute)?{kind:'element',element:attribute,damage:{raw:special/10,display:special}}:{kind:'status',status:attribute,damage:{raw:special/10,display:special}}]:[];
  return {...base,baseId:base.baseId||base.id,attack,affinity,sharpness,bonuses,specials,config:{...config,parts:PARTS[base.kind],focus:base.focus}};
}
export function optimizeArtian(db,weapon,armor,levels,scenario,attributeFilter='any') {
  if(weapon.family==='crafted')return weapon;
  let attributes=attributeFilter==='any'?['none',...ELEMENTS]:[attributeFilter];
  if(weapon.kind.includes('bowgun'))attributes=['none'];
  let best=null,bestDamage=-Infinity;
  for(const attribute of attributes)for(let infusionAttack=0;infusionAttack<=3;infusionAttack++)for(const p of reinforcementProfiles(weapon)){
    let candidate;
    try{candidate=configureArtian(db,weapon,{attribute,infusionAttack,reinforcements:p,setSkill:weapon.setSkill,groupSkill:weapon.groupSkill});}catch{continue;}
    const score=statistics(db,candidate,armor,levels,scenario).damage;
    if(score>bestDamage){best=candidate;bestDamage=score;}
  }
  return best;
}
