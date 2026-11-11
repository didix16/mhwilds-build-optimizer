import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import 'fake-indexeddb/auto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexData,ARMOR_KINDS} from '../src/engine/equipment.js';
import {createSearch} from '../src/engine/solver.js';
import {verifyBuild} from '../src/engine/verify.js';
import {compactBuild,buildKey,datasetFingerprint,SEARCH_VERSION} from '../src/engine/search-record.js';
import {createArchiveStore} from '../src/archive/store.js';
import {archiveCatalog,reportRecord} from '../src/archive/records.js';
import {filterReport} from '../src/report/filter.js';
import {createReportBlob} from '../src/report/export.js';

const raw=JSON.parse(await readFile(new URL('../public/data/database.json',import.meta.url),'utf8'));
const db=indexData({...raw,weapons:raw.weapons.filter(w=>w.kind==='great-sword'&&w.family==='crafted').slice(0,2),armor:ARMOR_KINDS.flatMap(kind=>raw.armor.filter(a=>a.kind===kind&&a.rank==='high').slice(0,2))});
const skill=name=>db.skills.find(s=>s.name.en===name).id;
const query={requirements:{[skill('Attack Boost')]:1},weaponTypes:['great-sword'],families:['crafted'],attribute:'any',rank:'high',transcended:true,priority:'defense',limit:2,scenario:{},optionalVariants:true,optionalSkills:[skill('Critical Eye'),skill('Divine Blessing')],variantLimit:8};
function finish(search){let state;do{state=search.step(10);}while(!state.exhausted);return state;}
const emitted=[];
const final=finish(createSearch(db,query,{onBuild:b=>emitted.push(b)}));

test('checkpoint survives JSON serialization and resumes the exact exploration and all results',()=>{
  const before=[],first=createSearch(db,query,{onBuild:b=>before.push(b.key)});
  let initial;do{initial=first.step(1);}while(!initial.counts.examined);const point=JSON.parse(JSON.stringify(first.checkpoint()));
  assert.ok(point.counts.examined>0&&point.counts.examined<64);
  const after=[],last=finish(createSearch(db,query,{checkpoint:point,onBuild:b=>after.push(b.key)}));
  assert.deepEqual([...before,...after],emitted.map(b=>b.key));
  assert.equal(last.counts.examined,64);assert.equal(last.counts.feasible,final.counts.feasible);assert.deepEqual(last.results,final.results);
  assert.ok(last.counts.elapsed<point.counts.elapsed+10000,'closed/paused wall time is not counted as search time');
  assert.throws(()=>createSearch(indexData({...db,meta:{...db.meta,changed:true}}),query,{checkpoint:point}),/incompatible/);
  assert.throws(()=>createSearch(db,{...query,priority:'damage'},{checkpoint:point}),/incompatible/);
  assert.throws(()=>createSearch(db,query,{checkpoint:{...point,version:999}}),/incompatible/);
});

test('all emitted optional variants pass verification and remain distinct beyond the visible top',()=>{
  assert.ok(emitted.length>final.results.length);assert.equal(new Set(emitted.map(b=>b.key)).size,emitted.length);
  assert.ok(emitted.length>64,'targeted optional fills produce additional variants');
  for(const b of emitted)assert.equal(verifyBuild(db,b,query).valid,true);
  const b=emitted[0];assert.equal(buildKey(b),buildKey({...b,decorations:[...b.decorations].reverse()}));
});

test('archive commits results and checkpoint atomically, deduplicates, pages snapshots and protects another tab',async()=>{
  const store=createArchiveStore(`archive-test-${crypto.randomUUID()}`),id='run';
  try{
    await store.create({id,owner:'a',fingerprint:datasetFingerprint(db),query,createdAt:1,updatedAt:1},archiveCatalog(db));
    const record=compactBuild(emitted[0]),second=compactBuild(emitted[1]);
    const payload={sequence:1,owner:'a',records:[record,record],checkpoint:{counts:{examined:1,feasible:1}},status:'paused'};
    const one=await store.save(id,payload);assert.equal(one.resultCount,1);assert.equal(one.sequence,1);
    const repeat=await store.save(id,payload);assert.equal(repeat.resultCount,1);
    await assert.rejects(store.save(id,{...payload,sequence:3}),/sequence mismatch/);
    await assert.rejects(store.save(id,{...payload,sequence:2,records:[second,{bad:true}]}));
    assert.equal((await store.get(id)).sequence,1);assert.deepEqual(await store.checkpoint(id),payload.checkpoint);
    const records=[];for await(const page of store.records(id,1,1))records.push(...page);assert.equal(records.length,1);
    await store.save(id,{...payload,sequence:2,records:[second]});
    const old=[];for await(const page of store.records(id,1,1))old.push(...page);assert.equal(old.length,1,'snapshot excludes later rows');
    const both=[];for await(const page of store.records(id,2,1))both.push(...page);assert.equal(both.length,2);
    await store.claim(id,'b',2);await assert.rejects(store.save(id,{...payload,sequence:3}),/another tab/);
    await store.remove(id);assert.equal((await store.list()).length,0);
    const removed=[];for await(const page of store.records(id,99))removed.push(...page);assert.equal(removed.length,0);
  }finally{await store.close();}
});

test('report filters combine minimum skills, exclusions, slot armor groups, weapons and statistics',()=>{
  const catalog=archiveCatalog(db),builds=emitted.map(b=>reportRecord(db,compactBuild(b),query));
  const b=builds.find(b=>b.levels[skill('Critical Eye')]>0)||builds[0],base={skills:{[skill('Attack Boost')]:1},armor:{head:[b.armor[0]]},weapons:[b.weapon],attack:b.stats.attack,defense:b.stats.defense};
  assert.ok(filterReport(builds,catalog,base).some(x=>x.key===b.key));
  assert.equal(filterReport(builds,catalog,{...base,excluded:[skill('Attack Boost')]}).length,0);
  assert.equal(filterReport(builds,catalog,{skills:{[skill('Attack Boost')]:99}}).length,0);
  assert.ok(filterReport(builds,catalog,{text:db.weaponMap.get(b.weapon).name.es}).length>0);
  assert.equal(filterReport(builds,catalog,{armor:{head:['missing']}}).length,0);
  const ordinary=reportRecord(db,compactBuild(emitted[0]),query),buffed=reportRecord(db,compactBuild(emitted[0]),{...query,scenario:{extraAttack:99999,wound:true}});
  assert.deepEqual(ordinary.stats,buffed.stats);assert.ok(!('damage' in ordinary.stats));
});

test('self-contained report executes offline, filters, paginates, changes language and opens materials',async()=>{
  const store=createArchiveStore(`report-test-${crypto.randomUUID()}`),id='report';
  try{
    const catalog=archiveCatalog(db);
    // Exercise data escaping without executing any source-provided markup.
    catalog.weapons=structuredClone(catalog.weapons);catalog.weapons[0].name.en+=' </script><script>globalThis.injected=true</script>';
    await store.create({id,fingerprint:datasetFingerprint(db),solverVersion:SEARCH_VERSION,query:{...query,scenario:{extraAttack:12345,customSecret:'combat-metadata'}},createdAt:1,updatedAt:1},catalog);
    await store.save(id,{sequence:1,records:emitted.map(b=>compactBuild(b,db)),checkpoint:{counts:final.counts},status:'paused'});
    const run=await store.get(id),blob=await createReportBlob(store,run,{language:'es'}),html=await blob.text();
    assert.ok(!html.includes('combat-metadata'));assert.ok(!html.includes('type="module"'));assert.ok(!/<(?:script|link|img)[^>]+(?:src|href)=/i.test(html));
    const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e));
    const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:console,url:'file:///offline-report.html'});
    try{
      const doc=dom.window.document;
      assert.deepEqual(errors,[]);assert.equal(dom.window.injected,undefined);assert.equal(doc.documentElement.lang,'es');assert.ok(doc.querySelectorAll('article.build').length>0);
      const payload=JSON.parse(doc.getElementById('report-data').textContent);assert.equal(payload.builds.length,emitted.length);assert.equal(payload.meta.resultCount,emitted.length);assert.ok(!('scenario' in payload.meta.query));
      const select=doc.querySelector('header select');select.value='en';select.dispatchEvent(new dom.window.Event('change'));assert.equal(doc.documentElement.lang,'en');assert.ok(doc.querySelector('h1').textContent.includes('Search report'));
      const grouping=doc.querySelector('input[type=checkbox]');grouping.checked=false;grouping.dispatchEvent(new dom.window.Event('change'));assert.equal(doc.querySelectorAll('article.build').length,25);
      const next=[...doc.querySelectorAll('button')].find(b=>b.textContent==='Next');assert.ok(next&&!next.disabled);next.click();assert.equal(doc.querySelectorAll('article.build').length,25);
      const details=doc.querySelector('.build-details');details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));
      assert.ok(details.textContent.includes('Known crafting materials'));const materials=[...details.querySelectorAll('details')].find(d=>d.firstChild.textContent==='Known crafting materials');materials.open=true;materials.dispatchEvent(new dom.window.Event('toggle'));assert.ok(materials.querySelectorAll('li').length>0);
      const min=[...doc.querySelectorAll('.filters label')].find(l=>l.firstChild.textContent==='Defense ≥').querySelector('input');min.value='999999';min.dispatchEvent(new dom.window.Event('change'));assert.equal(doc.querySelectorAll('article.build').length,0);assert.ok(doc.body.textContent.includes('No builds match'));
      assert.deepEqual(errors,[]);
    }finally{dom.window.close();}
  }finally{await store.close();}
});
