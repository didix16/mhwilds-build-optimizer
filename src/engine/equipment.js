export const ARMOR_KINDS = ['head','chest','arms','waist','legs'];
export const WEAPON_TYPES = {
  'great-sword': ['Great Sword','Gran espada'], 'long-sword':['Long Sword','Espada larga'],
  'sword-shield':['Sword and Shield','Espada y escudo'],'dual-blades':['Dual Blades','Espadas dobles'],
  hammer:['Hammer','Martillo'],'hunting-horn':['Hunting Horn','Cornamusa'],lance:['Lance','Lanza'],
  gunlance:['Gunlance','Lanza pistola'],'switch-axe':['Switch Axe','Hacha espada'],'charge-blade':['Charge Blade','Hacha cargada'],
  'insect-glaive':['Insect Glaive','Glaive insecto'],'light-bowgun':['Light Bowgun','Ballesta ligera'],
  'heavy-bowgun':['Heavy Bowgun','Ballesta pesada'],bow:['Bow','Arco'],
};
export const COLORS=['red','orange','yellow','green','blue','white','purple'];
export const capitalize = s => s ? s[0].toUpperCase()+s.slice(1) : '';
export function hasAttribute(weapon,attribute) {
  if(!attribute||attribute==='any')return true;
  if(attribute==='none')return !weapon.specials.length;
  if(weapon.kind.includes('bowgun'))return weapon.properties?.ammo?.some(a=>a.kind===({fire:'flaming',ice:'freeze'}[attribute]||attribute));
  if(weapon.kind==='bow'&&['poison','paralysis','sleep','blast'].includes(attribute))return weapon.specials.some(s=>s.status===attribute)||weapon.properties?.coatings?.includes(attribute);
  return weapon.specials.some(s=>(s.element||s.status)===attribute);
}
export const add = (target, source={}) => { for(const [k,v] of Object.entries(source)) target[k]=(target[k]||0)+v; return target; };
export function indexData(db) {
  return {...db,skillMap:new Map(db.skills.map(s=>[s.id,s])),armorMap:new Map(db.armor.map(a=>[a.id,a])),weaponMap:new Map(db.weapons.map(w=>[w.id,w])),decoMap:new Map(db.decorations.map(d=>[d.id,d])),charmMap:new Map(db.charms.map(c=>[c.id,c])),itemMap:new Map(db.items.map(i=>[i.id,i]))};
}
export function armorVariant(a,transcended=true) {
  const use=transcended&&a.defense.transcended!=null&&a.rank==='high';
  return {...a,upgraded:use,currentDefense:use?a.defense.transcended:a.defense.max,currentSlots:use?(a.transcendedSlots||a.slots):a.slots};
}
export function slotsFor(weapon,armor,charm) {
  return [
    ...weapon.slots.map((level,i)=>({key:`weapon:${i}`,owner:'weapon',index:i,level,kind:'weapon'})),
    ...armor.flatMap(a=>(a.currentSlots||a.slots).map((level,i)=>({key:`${a.kind}:${i}`,owner:a.kind,index:i,level,kind:'armor'}))),
    ...(charm?.slots||[]).map((s,i)=>({key:`charm:${i}`,owner:'charm',index:i,...(typeof s==='number'?{level:s,kind:'armor'}:s)})),
  ];
}
export function tally(db,weapon,armor,charm,decorations=[]) {
  const ordinary={},points={};
  for(const e of [weapon,...armor,charm].filter(Boolean)) {add(ordinary,e.skills);add(points,e.bonuses);}
  for(const placement of decorations) add(ordinary,(placement.deco||db.decoMap.get(placement.decoration))?.skills);
  const levels={};
  for(const [k,n] of Object.entries(ordinary)) levels[k]=Math.min(n,db.skillMap.get(+k)?.max||n);
  for(const [k,n] of Object.entries(points)) levels[k]=db.skillMap.get(+k)?.ranks.filter(r=>r.points&&n>=r.points).at(-1)?.level||0;
  return {levels,ordinary,points};
}
export function satisfies(levels,requirements) {return Object.entries(requirements).every(([id,level])=>(levels[id]||0)>=level);}

export function collectMaterials(db,build) {
  const quantities=new Map(),unresolved=[],visited=new Set();let zenny=0;
  const put=(m,reason)=>{const id=m.item??`unknown:${m.name?.en}`;const old=quantities.get(id)||{item:m.item,name:m.name,quantity:0,reasons:new Set()};old.quantity+=m.quantity;old.reasons.add(reason);quantities.set(id,old);};
  const visit=(e,label)=>{if(!e)return;if(visited.has(e.id))throw Error('Recipe cycle');visited.add(e.id);for(const m of e.materials||[])put(m,label);zenny+=e.zenny||0;if(e.previous)visit(db.weaponMap.get(e.previous)||db.charmMap.get(e.previous),label);visited.delete(e.id);};
  if(build.weapon.family==='crafted') visit(db.weaponMap.get(build.weapon.id),'weapon');
  else unresolved.push('artian');
  for(const a of build.armor){visit(a,a.kind);if(a.upgraded){for(const m of a.transcendMaterials||[])put(m,a.kind);zenny+=a.transcendZenny||0;}if(a.upgraded&&!a.upgradeCoverage)unresolved.push(a.id);}
  if(build.charm?.random)unresolved.push('random-charm');else visit(build.charm,'charm');
  unresolved.push('armor-spheres');
  return {items:[...quantities.values()].map(x=>({...x,reasons:[...x.reasons]})),zenny,unresolved};
}
