import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {indexData,ARMOR_KINDS,armorVariant,slotsFor,tally,satisfies} from '../src/engine/equipment.js';
import {createDecorationSolver} from '../src/engine/decoration-solver.js';
import {createTraversal} from '../src/engine/traversal.js';
import {charmCandidates,placeDecorations} from '../src/engine/decorations.js';
import {createSearch} from '../src/engine/solver.js';
import {verifyBuild} from '../src/engine/verify.js';
import {armorKey,indexArmorPieces} from '../scripts/armor-key.mjs';
const db=indexData(JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8')));
const id=name=>db.skills.find(s=>s.name.en===name).id;
const query=(requirements,extra={})=>({requirements,weaponTypes:['great-sword'],families:['crafted'],attribute:'any',rank:'all',transcended:true,priority:'defense',limit:20,scenario:{},...extra});

test('compiled jewel solver matches an independent exhaustive oracle in 600 mixed-slot cases',()=>{
  let seed=723221;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let iteration=0;iteration<600;iteration++){
    const decorations=Array.from({length:6},(_,i)=>({id:'d'+i,kind:random(2)?'weapon':'armor',slot:1+random(4),skills:{1:random(3),2:random(3),3:random(2)}}));
    const slots=Array.from({length:random(6)},(_,i)=>({key:'s'+i,kind:random(2)?'weapon':'armor',level:1+random(4)}));
    const requirements={1:1+random(5),2:1+random(5),3:1+random(3)},levels={1:random(3),2:random(3),3:random(2)};
    const fake=indexData({skills:[1,2,3].map(id=>({id,kind:'weapon',max:5})),decorations,armor:[],weapons:[],charms:[],items:[]});
    function oracle(at,have){if(satisfies(have,requirements))return true;if(at===slots.length)return false;if(oracle(at+1,have))return true;return decorations.some(d=>d.kind===slots[at].kind&&d.slot<=slots[at].level&&oracle(at+1,Object.fromEntries([1,2,3].map(id=>[id,have[id]+d.skills[id]]))));}
    const solver=createDecorationSolver(fake,requirements),actual=solver.place(levels,slots),expected=oracle(0,levels);
    assert.equal(actual!==null,expected,`iteration ${iteration}`);
    // Hit the same memo entry using different owners and reversed slot order.
    const renamed=slots.map(s=>({...s,key:'new-'+s.key})).reverse(),again=solver.place(levels,renamed);
    assert.equal(again!==null,expected);
    if(again){const have={...levels},used=new Set();for(const p of again){const s=renamed.find(s=>s.key===p.slot),d=decorations.find(d=>d.id===p.decoration);assert.ok(s&&d&&s.kind===d.kind&&s.level>=d.slot&&!used.has(s.key));used.add(s.key);for(const id of [1,2,3])have[id]+=d.skills[id];}assert.ok(satisfies(have,requirements));}
  }
});

test('prefix pruning keeps every feasible equipment tuple compared with exhaustive enumeration',()=>{
  const names=[['Gore Helm β','Arkvulcan Helm γ'],['Gore Mail β','Dahaad Shardmail γ'],['Gore Vambraces β','Arkvulcan Vambraces γ'],['Gore Coil β','Dahaad Shardcoil γ'],['Gore Greaves β','Dahaad Shardgreaves β']];
  const armor=names.flatMap(names=>names.map(name=>{const a=db.armor.find(a=>a.name.en===name);assert.ok(a,name);return a;}));
  const weapons=db.weapons.filter(w=>w.kind==='great-sword'&&w.family==='crafted'&&w.slots.some(s=>s>=2)).slice(0,2);
  const charms=['Sanity Charm III','Challenger Charm III','Exploiter Charm II'].map(name=>db.charms.find(c=>c.name.en===name)).filter(Boolean);assert.equal(charms.length,3);
  const fixture=indexData({...db,armor,weapons,charms,randomCharms:[]});
  const q=query({[id('Weakness Exploit')]:5,[id('Agitator')]:5,[id('Flayer')]:2,[id('Antivirus')]:3,[id("Gore Magala's Tyranny")]:1,[id('Critical Boost')]:2});
  const pools=ARMOR_KINDS.map(kind=>armor.filter(a=>a.kind===kind).map(a=>armorVariant(a,true))),expected=new Set();
  function enumerate(w,pieces){if(pieces.length<5){for(const a of pools[pieces.length])enumerate(w,[...pieces,a]);return;}for(const c of charms){const totals=tally(fixture,w,pieces,c);if((totals.levels[id("Gore Magala's Tyranny")]||0)<1)continue;if(placeDecorations(fixture,q.requirements,totals.levels,slotsFor(w,pieces,c))){expected.add([w.id,...pieces.map(a=>a.id)].join('|'));break;}}}
  for(const w of weapons)enumerate(w,[]);
  assert.ok(expected.size>0&&expected.size<64);
  const actual=[],search=createSearch(fixture,q,{onBuild:b=>{assert.equal(verifyBuild(fixture,b,q).valid,true);actual.push([b.weapon.id,...b.armor.map(a=>a.id)].join('|'));}});let state;
  do{state=search.step(10);}while(!state.exhausted);
  assert.deepEqual(new Set(actual),expected);assert.equal(actual.length,expected.size);assert.ok(state.counts.pruned>0);
});

test('a checkpoint resumes the prefix traversal exactly after scouting, with no lost or duplicate tuples',()=>{
  const requirements=Object.fromEntries(['Antivirus','Critical Boost','Weakness Exploit','Agitator'].map(name=>[id(name),1]));
  const w={kind:'great-sword',skills:requirements,bonuses:{},slots:[]},a={skills:{},bonuses:{},slots:[1],currentDefense:1};
  const lists=[[w],...ARMOR_KINDS.map(()=>[a,{...a,currentDefense:2},{...a,currentDefense:3}])];
  const solver=createDecorationSolver(db,requirements),charms=[{skills:{},slots:[]}],q={};
  function collect(traversal){const found=[];while(traversal.active){const next=traversal.next();if(next)found.push(next.join(','));}return found;}
  const whole=collect(createTraversal(lists,q,solver,{},charms));
  const traversal=createTraversal(lists,q,solver,{},charms),before=[];
  while(traversal.counts.expanded<20){const next=traversal.next();if(next)before.push(next.join(','));}
  const point=JSON.parse(JSON.stringify(traversal.snapshot()));assert.ok(point.cursors[0].stack.length);
  const after=collect(createTraversal(lists,q,solver,{},charms,point));
  assert.equal(whole.length,243);assert.equal(new Set(whole).size,243);assert.deepEqual([...before,...after],whole);
});

const videoSkills={'Antivirus':3,'Critical Boost':3,'Flayer':2,'Shock Absorber':1,'Ballistics':3,'Weakness Exploit':5,'Earplugs':2,'Piercing Shots':1,'Burst':1,'Evade Extender':2,"Gore Magala's Tyranny":1,'Divine Blessing':3,'Opening Shot':3,'Agitator':5};
const videoQuery=()=>query(Object.fromEntries(Object.entries(videoSkills).map(([name,l])=>[id(name),l])),{weaponTypes:['light-bowgun'],families:['artian','gogma'],weaponId:db.weapons.find(w=>w.kind==='light-bowgun'&&w.family==='gogma'&&w.focus==='affinity').id});
test('the 02:38 Pierce LBG request finds verified builds in the first candidate batches',()=>{
  const q=videoQuery(),search=createSearch(db,q);let state;
  do{state=search.step(1);}while(!state.results.length&&!state.exhausted&&state.counts.examined<100);
  assert.ok(state.results.length);assert.ok(state.counts.examined<100);
  for(const b of state.results){assert.equal(verifyBuild(db,b,q).valid,true);assert.equal(b.levels[id('Piercing Shots')],1);assert.equal(b.levels[id('Rapid Fire Up')]||0,0);}
});
test('mutually incompatible weapon requirements are rejected before enumerating any armor tuples',()=>{
  const q=videoQuery();q.requirements[id('Rapid Fire Up')]=1;
  const search=createSearch(db,q),state=search.step(1);
  assert.equal(state.exhausted,true);assert.equal(state.reason,'weaponSkillConflict');assert.equal(state.counts.examined,0);
  const point=JSON.parse(JSON.stringify(search.checkpoint()));assert.equal(createSearch(db,q,{checkpoint:point}).step(1).reason,'weaponSkillConflict');
});
test('set bonus point budgets reject incompatible four-piece sets before armor enumeration',()=>{
  const q=query({[id('Gogmapocalypse')]:2,[id("Gore Magala's Tyranny")]:2},{families:['gogma']});
  const state=createSearch(db,q).step(1);assert.equal(state.exhausted,true);assert.equal(state.reason,'bonusSkillConflict');assert.equal(state.counts.examined,0);
});
test('weapon preflight accounts for armor with native weapon skills',()=>{
  const cb=id('Critical Boost'),weapon=db.weapons.find(w=>w.kind==='great-sword'&&w.family==='crafted');
  const armor=ARMOR_KINDS.map((kind,i)=>({...db.armor.find(a=>a.kind===kind),id:'native-'+i,skills:i?{}:{[cb]:3},bonuses:{},slots:[],transcendedSlots:[]}));
  const fixture=indexData({...db,weapons:[weapon],armor,charms:[db.charms[0]],randomCharms:[]});
  const q=query({[cb]:2}),state=createSearch(fixture,q).step(5);assert.ok(state.results.length);assert.equal(verifyBuild(fixture,state.results[0],q).valid,true);
});
test('armor data matching preserves alpha, beta and gamma and rejects ambiguous source names',()=>{
  assert.equal(new Set(['α','β','γ'].map(s=>armorKey('Arkvulcan Helm '+s))).size,3);
  const pieces=['α','β','γ'].map(Name=>({Name:'Arkvulcan Helm '+Name}));assert.equal(indexArmorPieces([{Pieces:pieces}]).size,3);
  assert.throws(()=>indexArmorPieces([{Pieces:[pieces[0],pieces[0]]}]),/Ambiguous/);
  const a=db.armor.find(a=>a.name.en==='Arkvulcan Helm α'),b=db.armor.find(a=>a.name.en==='Arkvulcan Helm β'),g=db.armor.find(a=>a.name.en==='Arkvulcan Helm γ');
  assert.deepEqual(a.transcendedSlots,[]);assert.deepEqual(b.transcendedSlots,[3,2,1]);assert.deepEqual(g.transcendedSlots,[2,1]);
  assert.equal(a.defense.transcended,92);assert.equal(b.defense.transcended,92);assert.equal(g.defense.transcended,94);
});

test('prefix feasibility bounds agree with full enumeration for 40 randomized equipment and charm pools',()=>{
  let seed=9321;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
  for(let iteration=0;iteration<40;iteration++){
    const skills=[{id:1,kind:'armor',max:5},{id:2,kind:'weapon',max:5},{id:3,kind:'set',max:1,ranks:[{level:1,points:2}]}];
    const decorations=Array.from({length:5},(_,i)=>({id:'d'+i,kind:random(2)?'weapon':'armor',slot:1+random(3),skills:{1:random(3),2:random(3)}}));
    const equipment=kind=>({kind,skills:{1:random(3),2:random(3)},bonuses:{3:random(2)},slots:Array.from({length:random(3)},()=>1+random(3))});
    const lists=[[equipment('great-sword'),equipment('great-sword')],...ARMOR_KINDS.map(kind=>[equipment(kind),equipment(kind)])];
    const charms=Array.from({length:2},()=>({skills:{1:random(3),2:random(3)},bonuses:{},slots:Array.from({length:random(3)},()=>({kind:random(2)?'weapon':'armor',level:1+random(3)}))}));
    const fake=indexData({skills,decorations,weapons:[],armor:[],items:[],charms}),requirements={1:1+random(5),2:1+random(5),3:1};
    const expected=new Set();
    function enumerate(index){if(index.length<6){for(let i=0;i<2;i++)enumerate([...index,i]);return;}const equipment=index.map((i,axis)=>lists[axis][i]);for(const charm of charms){const levels=tally(fake,equipment[0],equipment.slice(1),charm).levels;if((levels[3]||0)<1)continue;if(placeDecorations(fake,requirements,levels,slotsFor(equipment[0],equipment.slice(1),charm))){expected.add(index.join(','));break;}}}
    enumerate([]);
    const traversal=createTraversal(lists,{},createDecorationSolver(fake,requirements),{3:2},charms),visited=[];
    while(traversal.active){const index=traversal.next();if(index)visited.push(index.join(','));}
    // Partial bounds may admit extra leaves, but must retain every feasible leaf.
    const kept=new Set(visited);for(const index of expected)assert.ok(kept.has(index),`iteration ${iteration}: lost ${index}`);
    assert.equal(kept.size,visited.length);
  }
});
