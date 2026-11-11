import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {armorKey,indexArmorPieces} from './armor-key.mjs';
const load = async name => JSON.parse((await readFile(`.cache/sources/${name}.json`, 'utf8')).replace(/^\uFEFF/, ''));
const clean = s => (s || '').replace(/<[^>]+>/g, '').replace(/\r?\n/g, ' ').trim();
const key = s => s.toLowerCase().replace(/[^a-z0-9]/g,'');
const en = {}, es = {};
for (const kind of ['skills','armor','weapons','decorations','charms','items','monsters']) {
  en[kind] = await load(`en-${kind}`); es[kind] = await load(`es-${kind}`);
  if (en[kind].length !== es[kind].length) throw Error(`Language mismatch: ${kind}`);
}
const translations = kind => new Map(es[kind].map(x=>[x.id,x]));
const bilingual = (a,b,field='name') => ({en:clean(a?.[field]),es:clean(b?.[field]) || clean(a?.[field])});
const skillNames = new Map(en.skills.map(s=>[key(s.name),s.id]));
const skillId = name => skillNames.get(key(name));
const skills = en.skills.map(s=>{
  const t=translations('skills').get(s.id);
  if(t.gameId!==s.gameId) throw Error(`Skill ID mismatch: ${s.id}`);
  return {id:s.id,gameId:s.gameId,kind:s.kind,name:bilingual(s,t),description:bilingual(s,t,'description'),max:Math.max(...s.ranks.map(r=>r.level)),iconKind:s.icon?.kind,ranks:s.ranks.map((r,i)=>({level:r.level,points:r.setPiecesRequired,name:bilingual(r,t.ranks[i]),description:bilingual(r,t.ranks[i],'description')}))};
});
const sm=new Map(skills.map(s=>[s.id,s]));
try {const icons=JSON.parse(await readFile('public/data/icon-manifest.json','utf8'));for(const s of skills)if(icons[s.id])s.icon=icons[s.id];}catch{}
const ordinary = input => Object.fromEntries(input.filter(s=>!['set','group'].includes(sm.get(s.skill.id)?.kind)).map(s=>[s.skill.id,s.level]));
const bonuses = input => Object.fromEntries(input.filter(s=>['set','group'].includes(sm.get(s.skill.id)?.kind)).map(s=>[s.skill.id,1]));
const items = en.items.map(x=>({id:x.id,gameId:x.gameId,name:bilingual(x,translations('items').get(x.id)),description:bilingual(x,translations('items').get(x.id),'description'),icon:x.icon,rarity:x.rarity}));
const itemNames=new Map(items.map(x=>[key(x.name.en),x.id]));
const costs=xs=>(xs||[]).map(x=>({item:x.item.id,quantity:x.quantity}));
const wikiCosts=xs=>(xs||[]).map(x=>({item:itemNames.get(key(x.Name)),quantity:Number(x.Quantity),...(!itemNames.has(key(x.Name))?{name:{en:x.Name,es:x.Name}}:{})}));
const wikiArmor=await load('wiki-armor');
const wikiPieces=indexArmorPieces(wikiArmor);
function wikiSlots(p,prefix='Decos') {return [4,3,2,1].flatMap(n=>Array(Number(p[`${prefix}${n}`])||0).fill(n));}
let armorMatched=0;
const armor=en.armor.map(a=>{
  const p=wikiPieces.get(armorKey(a.name)); if(p) armorMatched++;
  return {id:`a${a.id}`,sourceId:a.id,name:bilingual(a,translations('armor').get(a.id)),description:bilingual(a,translations('armor').get(a.id),'description'),kind:a.kind,rank:a.rank,rarity:a.rarity,defense:{base:a.defense.base,max:p?Number(p.MaxDefense):a.defense.max,transcended:p?Number(p.MaxDefenseTranscend):null},slots:a.slots,transcendedSlots:p?wikiSlots(p,'TranscendDecos'):null,skills:ordinary(a.skills),bonuses:bonuses(a.skills),resistances:a.resistances,materials:costs(a.crafting?.materials),zenny:a.crafting?.zennyCost||0,transcendMaterials:wikiCosts(p?.TranscendMaterials),transcendZenny:Number(p?.TranscendCost)||0,upgradeCoverage:!!p};
});
const decorations=en.decorations.map(d=>({id:`d${d.id}`,name:bilingual(d,translations('decorations').get(d.id)),description:bilingual(d,translations('decorations').get(d.id),'description'),kind:d.kind,slot:d.slot,rarity:d.rarity,skills:ordinary(d.skills),color:d.icon?.color}));
const charmTranslations=new Map(es.charms.flatMap(c=>c.ranks.map(r=>[r.id,r])));
const charms=en.charms.filter(c=>!c.random).flatMap(c=>c.ranks.map(r=>({id:`c${r.id}`,name:bilingual(r,charmTranslations.get(r.id)),description:bilingual(r,charmTranslations.get(r.id),'description'),rarity:r.rarity,skills:ordinary(r.skills),bonuses:{},slots:[],materials:costs(r.crafting?.materials),zenny:r.crafting?.zennyCost||0,previous:r.level>1?`c${c.ranks.find(x=>x.level===r.level-1)?.id}`:null})));
const groups=(await load('wiki-groups')).map(g=>({id:g.GroupNum,skills:g.Skills.map(s=>({id:skillId(s.SkillName),level:s.MaxLvl})).filter(x=>x.id)}));
const randomCharms=(await load('wiki-rng')).map((c,i)=>({id:`rng${i}`,name:bilingual(en.charms.find(x=>x.random&&x.ranks[0].rarity===c.Rarity)?.ranks[0],es.charms.find(x=>x.random&&x.ranks[0].rarity===c.Rarity)?.ranks[0]),rarity:c.Rarity,groups:c.SkillGroups.sort((a,b)=>a.SkillOrder-b.SkillOrder).map(g=>g.GroupNum),slots:c.PossibleSlotCombos.map(s=>s.map(x=>({level:x.SlotLevel,kind:x.DecoType==='Sword'?'weapon':x.DecoType.toLowerCase()})))}));
const weaponTranslations=translations('weapons');
const weapons=en.weapons.map(w=>({
  id:`w${w.id}`,sourceId:w.id,gameId:w.gameId,name:bilingual(w,weaponTranslations.get(w.id)),description:bilingual(w,weaponTranslations.get(w.id),'description'),kind:w.kind,rarity:w.rarity,attack:w.damage.raw,displayFactor:w.damage.display/w.damage.raw,affinity:w.affinity,defenseBonus:w.defenseBonus,slots:w.slots,skills:ordinary(w.skills),bonuses:bonuses(w.skills),specials:w.specials,sharpness:w.sharpness?['red','orange','yellow','green','blue','white','purple'].map(k=>w.sharpness[k]):null,handicraft:w.handicraft||[],family:w.series?'crafted':'artian',series:w.series?.name,materials:costs(w.crafting?.craftable?w.crafting?.craftingMaterials:w.crafting?.upgradeMaterials),zenny:w.crafting?.craftable?w.crafting?.craftingZennyCost:w.crafting?.upgradeZennyCost,previous:!w.crafting?.craftable&&w.crafting?.previous?`w${w.crafting.previous.id}`:null,properties:Object.fromEntries(['coatings','phial','shell','shellLevel','melody','echoBubble','echoWave','ammo','kinsectLevel','specialAmmo'].filter(k=>w[k]!=null).map(k=>[k,w[k]])),localizedProperties:{en:{melody:w.melody,echoBubble:w.echoBubble,echoWave:w.echoWave},es:{melody:weaponTranslations.get(w.id)?.melody,echoBubble:weaponTranslations.get(w.id)?.echoBubble,echoWave:weaponTranslations.get(w.id)?.echoWave}}
}));
// MHDB provides three Gogma focus bases per weapon type, following the three ordinary Artian bases.
const byType=Object.groupBy(weapons.filter(w=>w.family==='artian'),w=>w.kind);
for(const ws of Object.values(byType)) for(let i=0;i<ws.length;i++) {ws[i].family=i>=3?'gogma':'artian';ws[i].focus=i>=3?['attack','affinity','element'][i-3]:null;}
const monsters=en.monsters.map(m=>{
  const t=translations('monsters').get(m.id);
  return {id:m.id,name:bilingual(m,t),description:bilingual(m,t,'description'),parts:m.parts.map((p,i)=>({id:p.id,kind:p.kind,name:{en:p.name,es:t.parts.find(x=>x.id===p.id)?.name||p.name},hitzones:p.multipliers})),rewards:m.rewards.map(r=>({item:r.item.id,conditions:r.conditions.map(c=>({kind:c.kind,rank:c.rank,chance:c.chance,quantity:c.quantity,part:c.part}))}))};
});
const artianText=await readFile('.cache/sources/wiki-artian.txt','utf8');
const kinds={'Great Sword':'great-sword','Long Sword':'long-sword','Sword and Shield':'sword-shield','Dual Blades':'dual-blades','Hammer':'hammer','Hunting Horn':'hunting-horn','Lance':'lance','Gunlance':'gunlance','Switch Axe':'switch-axe','Charge Blade':'charge-blade','Insect Glaive':'insect-glaive','Light Bowgun':'light-bowgun','Heavy Bowgun':'heavy-bowgun','Bow':'bow'};
const artian={};
for(const [name,kind] of Object.entries(kinds)) {
  const start=artianText.indexOf(`Text=}}${name}===`),end=artianText.indexOf('\n===',start+1);
  const text=artianText.slice(start,end<0?undefined:end);
  const values=[...text.matchAll(/\|\s*(\d+)\s*\r?\n\|\s*(\d+)\s*\r?\n\|(?:rowspan=\d+\|\s*\+(\d+) Element)?/g)].map(m=>[+m[1],+m[2],+(m[3]||0)]);
  artian[kind]={element:values[0]||null,poison:values[1]||null,paralysis:values[2]||null};
}
artian.bow={element:[180,210,20],poison:null,paralysis:null};
const sourceManifest=await load('manifest');
const supplemental=[];
for(const file of ['wiki-armor.json','wiki-weapons.json','wiki-groups.json','wiki-rng.json','wiki-artian.txt','wiki-gogma.txt']) {
  const b=await readFile(`.cache/sources/${file}`); supplemental.push({file,sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length});
}
const db={skills,armor,weapons,decorations,charms,randomCharms,charmGroups:groups,items,monsters,artian,
  meta:{schema:1,normalizationRevision:2,targetVersion:'1.042.00.03',contentCoverage:'1.041 content present; 1.042 patch parity not certified',downloadedAt:sourceManifest.downloadedAt,counts:{skills:skills.length,armor:armor.length,weapons:weapons.length,decorations:decorations.length,charms:charms.length,monsters:monsters.length},armorUpgradeMatched:armorMatched,sources:sourceManifest.records,supplemental,notes:['MHDB en/es snapshot; static local data.','Wiki overlay supplies documented armor transcendence and legal random-charm tables.','Motion values and combat formulas use MIT reference bf5f6cf; patch parity is not certified.','Artian/Gogma configurations are theoretical; acquisition and reroll RNG costs are not guaranteed.']}};
await mkdir('public/data',{recursive:true});
await writeFile('public/data/database.json',JSON.stringify(db));
await writeFile('public/data/manifest.json',JSON.stringify(db.meta,null,2));
console.log(JSON.stringify({...db.meta.counts,armorUpgradeMatched:armorMatched},null,2));
