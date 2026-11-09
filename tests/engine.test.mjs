import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexData,tally,armorVariant,slotsFor,collectMaterials,WEAPON_TYPES} from '../src/engine/equipment.js';
import {placeDecorations,charmCandidates} from '../src/engine/decorations.js';
import {configureArtian,optimizeArtian} from '../src/engine/artian.js';
import {statistics,extendedSharpness,attacksFor,attackCompatible} from '../src/engine/damage.js';
import {createSearch,compareBuilds} from '../src/engine/solver.js';
import {verifyBuild} from '../src/engine/verify.js';
const db=indexData(JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8')));
const id=name=>db.skills.find(s=>s.name.en===name).id;
const basicQuery=(overrides={})=>({requirements:{[id('Attack Boost')]:5,[id('Critical Boost')]:3,[id('Weakness Exploit')]:3},weaponTypes:['great-sword'],families:['crafted','artian','gogma'],attribute:'any',rank:'all',transcended:true,priority:'defense',limit:20,scenario:{},...overrides});
function firstBuild(query){const search=createSearch(db,query);let state;for(let i=0;i<60;i++){state=search.step(1);if(state.results.length)return {build:state.results[0],search};if(state.exhausted)break;}throw Error('No build found within test budget');}

test('typed decoration placement rejects an armor jewel in a weapon slot',()=>{
  const fake=indexData({skills:[{id:1,kind:'armor',max:3}],decorations:[{id:'d1',kind:'armor',slot:1,skills:{1:1}}],armor:[],weapons:[],charms:[],items:[]});
  assert.equal(placeDecorations(fake,{1:1},{},[{key:'weapon:0',kind:'weapon',level:3}]),null);
});
test('combination jewel can satisfy two skills in a single slot',()=>{
  const fake=indexData({skills:[{id:1,kind:'weapon',max:3},{id:2,kind:'weapon',max:3}],decorations:[{id:'combo',kind:'weapon',slot:3,skills:{1:2,2:1}}],armor:[],weapons:[],charms:[],items:[]});
  assert.deepEqual(placeDecorations(fake,{1:2,2:1},{},[{key:'w:0',kind:'weapon',level:3}]),[{slot:'w:0',decoration:'combo'}]);
});
test('exact jewel search agrees with an independent exhaustive oracle on 150 randomized cases',()=>{
  let seed=92417;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let iteration=0;iteration<150;iteration++){
    const decorations=Array.from({length:5},(_,i)=>({id:'d'+i,kind:random(2)?'weapon':'armor',slot:1+random(3),skills:{1:random(3),2:random(3)}}));
    const slots=Array.from({length:1+random(4)},(_,i)=>({key:'s'+i,kind:random(2)?'weapon':'armor',level:1+random(3)}));
    const requirements={1:1+random(4),2:1+random(4)};
    const fake=indexData({skills:[{id:1,kind:'weapon',max:5},{id:2,kind:'armor',max:5}],decorations,armor:[],weapons:[],charms:[],items:[]});
    function oracle(i,levels){if(levels[1]>=requirements[1]&&levels[2]>=requirements[2])return true;if(i===slots.length)return false;if(oracle(i+1,levels))return true;return decorations.some(d=>d.kind===slots[i].kind&&d.slot<=slots[i].level&&oracle(i+1,{1:levels[1]+d.skills[1],2:levels[2]+d.skills[2]}));}
    assert.equal(placeDecorations(fake,requirements,{},slots)!==null,oracle(0,{1:0,2:0}),`iteration ${iteration}`);
  }
});
test('group and set skills activate only after the documented piece threshold',()=>{
  const s=db.skills.find(s=>s.name.en==='Gogmapocalypse'),piece={skills:{},bonuses:{[s.id]:1}};
  assert.equal(tally(db,piece,[],null).levels[s.id],0);
  assert.equal(tally(db,piece,[piece],null).levels[s.id],1);
  assert.equal(tally(db,piece,[piece,piece,piece],null).levels[s.id],2);
});
test('transcendence uses documented defense and typed armor slots',()=>{
  const a=db.armor.find(a=>a.rank==='high'&&a.rarity===5&&a.transcendedSlots?.length);
  const enhanced=armorVariant(a,true),standard=armorVariant(a,false);
  assert.equal(enhanced.currentDefense,a.defense.transcended);assert.deepEqual(enhanced.currentSlots,a.transcendedSlots);
  assert.equal(standard.currentDefense,a.defense.max);assert.deepEqual(standard.currentSlots,a.slots);
});
test('charm generation respects group membership, distinct rolls and slot templates',()=>{
  const candidates=charmCandidates(db,{[id('Attack Boost')]:5,[id('Critical Boost')]:5},'damage');
  assert.ok(candidates.some(c=>c.random&&c.rarity===8));
  for(const c of candidates.filter(c=>c.random)){
    const template=db.randomCharms.find(t=>t.id===c.template);assert.equal(new Set(c.rolls.map(s=>s.id)).size,c.rolls.length);
    c.rolls.forEach((s,i)=>assert.ok(db.charmGroups.find(g=>g.id===template.groups[i]).skills.some(x=>x.id===s.id&&x.level===s.level)));
    assert.deepEqual(c.slots,template.slots[c.slotVariant]);
  }
});
test('Gogma construction rejects illegal skill pairs and reinforcement counts',()=>{
  const base=db.weapons.find(w=>w.family==='gogma'&&w.kind==='great-sword');
  const good={attribute:'dragon',infusionAttack:3,reinforcements:{attack:2,affinity:1,element:2,sharpness:0},setSkill:id('Gogmapocalypse'),groupSkill:id("Lord's Favor")};
  const weapon=configureArtian(db,base,good);
  assert.equal(weapon.attack,base.attack+15+24);assert.equal(weapon.bonuses[id('Gogmapocalypse')],1);
  assert.throws(()=>configureArtian(db,base,{...good,setSkill:id('Attack Boost')}));
  assert.throws(()=>configureArtian(db,base,{...good,reinforcements:{attack:5,affinity:1,element:0,sharpness:0}}));
  assert.throws(()=>configureArtian(db,base,{...good,attribute:'none'}));
  assert.throws(()=>configureArtian(db,base,{...good,reinforcements:{attack:5}}));
});
test('Handicraft segment units extend the right sharpness colors',()=>{
  assert.deepEqual(extendedSharpness([10,0,0,0,10,0,0],[1,4],20),[10,0,0,0,20,10,0]);
  assert.deepEqual(extendedSharpness([10,0,0,0,10,0,0],[0,5],20),[10,0,0,0,10,20,0]);
});
test('critical boost, negative affinity, and conditional skills affect expected damage correctly',()=>{
  const base=db.weapons.find(w=>w.kind==='great-sword'&&w.family==='crafted');
  const w={...base,attack:100,affinity:100,sharpness:[0,0,100,0,0,0,0],specials:[]};
  const scenario={hitzones:{slash:1,blunt:1,pierce:1,fire:0,water:0,thunder:0,ice:0,dragon:0}};
  const normal=statistics(db,w,[],{},scenario),boost=statistics(db,w,[],{[id('Critical Boost')]:5},scenario);
  assert.equal(normal.damage,101.3);assert.equal(boost.damage,113.4);
  const negative=statistics(db,{...w,affinity:-100},[],{},scenario);assert.equal(negative.damage,60.8);
  const levels={[id('Agitator')]:5};
  assert.equal(statistics(db,w,[],levels,scenario).attack,100);
  assert.equal(statistics(db,w,[],levels,{...scenario,activeSkills:[id('Agitator')]}).attack,120);
});
test('all fourteen weapon models calculate finite statistics',()=>{
  for(const kind of Object.keys(WEAPON_TYPES)){
    const w=db.weapons.find(w=>w.kind===kind&&w.rarity===8&&w.family==='crafted');
    assert.ok(attacksFor(kind).length>0);const stats=statistics(db,w,[],{},{});
    assert.ok(Number.isFinite(stats.damage)&&Number.isFinite(stats.attack)&&Number.isFinite(stats.affinity),kind);
  }
});
test('unavailable ammunition and shelling do not add fictional damage',()=>{
  const w=db.weapons.find(w=>w.kind==='light-bowgun'&&w.family==='crafted');
  const moves=attacksFor(w.kind),index=moves.findIndex(a=>!attackCompatible(w,a));assert.ok(index>=0);
  const stats=statistics(db,w,[],{},{combos:{[w.kind]:[{index,count:1}]}});
  assert.equal(stats.damage,0);assert.equal(stats.incompatible.length,1);
});
test('rarity 8 charms provide a usable weapon decoration slot',()=>{
  const c=charmCandidates(db,{[id('Attack Boost')]:3},'damage').find(c=>c.random&&c.rarity===8);
  assert.ok(c.slots.some(s=>s.kind==='weapon'&&s.level===1));
});
test('fair equipment traversal reaches all fourteen weapon types',()=>{
  const q=basicQuery({requirements:{[id('Attack Boost')]:1},weaponTypes:[],families:['crafted'],limit:50});
  const search=createSearch(db,q),types=new Set();
  for(let i=0;i<35&&types.size<14;i++){const state=search.step(1);for(const b of state.results)types.add(b.weapon.kind);}
  assert.equal(types.size,14);
});
test('progressive search returns an independently verified build; tampering is rejected',()=>{
  const q=basicQuery(),{build}=firstBuild(q);assert.equal(verifyBuild(db,build,q).valid,true);
  assert.equal(build.armor.length,5);assert.ok(Object.entries(q.requirements).every(([id,n])=>build.levels[id]>=n));
  const duplicate=structuredClone(build);duplicate.armor[1]=duplicate.armor[0];assert.equal(verifyBuild(db,duplicate,q).valid,false);
  const slot=structuredClone(build);slot.decorations.push({...slot.decorations[0]});assert.equal(verifyBuild(db,slot,q).valid,false);
  const unknown=structuredClone(build);unknown.weapon.id='unknown';assert.equal(verifyBuild(db,unknown,q).valid,false);
});
test('Gogma search can use its set contribution to satisfy a four-piece bonus',()=>{
  const w=db.weapons.find(w=>w.family==='gogma'&&w.kind==='great-sword');
  const q=basicQuery({requirements:{[id('Gogmapocalypse')]:2,[id('Attack Boost')]:3},families:['gogma'],weaponId:w.id,attribute:'dragon'});
  const {build}=firstBuild(q);assert.ok(build.weapon.config);assert.equal(build.points[id('Gogmapocalypse')]>=4,true);assert.equal(verifyBuild(db,build,q).valid,true);
});
test('an impossible group requirement exhausts a restricted equipment dataset',()=>{
  const a=db.armor.find(a=>a.kind==='head');
  const fixture=indexData({...db,armor:['head','chest','arms','waist','legs'].map((kind,i)=>({...a,id:'test'+i,kind,skills:{},bonuses:{}})),weapons:[{...db.weapons.find(w=>w.kind==='great-sword'&&w.family==='crafted'),skills:{},bonuses:{}}]});
  const search=createSearch(fixture,basicQuery({requirements:{[id('Gogmapocalypse')]:2},families:['crafted']}));
  const state=search.step(100);assert.equal(state.exhausted,true);assert.equal(state.results.length,0);
});
test('ranking puts requirements ahead of preference and respects tie-break order',()=>{
  const a={stats:{defense:500,damage:90},rarity:50},b={stats:{defense:499,damage:200},rarity:60};
  assert.ok(compareBuilds(a,b,'defense')<0);assert.ok(compareBuilds(a,b,'damage')>0);
});
test('material aggregation includes prerequisite weapons and transcendence without losing quantities',()=>{
  const q=basicQuery(),{build}=firstBuild(q),materials=collectMaterials(db,build);
  assert.ok(materials.items.length>0);assert.ok(materials.zenny>0);assert.ok(materials.items.every(m=>Number.isInteger(m.quantity)&&m.quantity>0));
  assert.ok(materials.unresolved.includes('armor-spheres'));
});
