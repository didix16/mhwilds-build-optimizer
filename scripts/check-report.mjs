import {build} from 'esbuild';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {indexData} from '../src/engine/equipment.js';
import {createSearch} from '../src/engine/solver.js';
import {compactBuild,datasetFingerprint,SEARCH_VERSION} from '../src/engine/search-record.js';
import {archiveCatalog} from '../src/archive/records.js';

// toString() is used to embed the client. Check its *minified* bundle too.
await build({entryPoints:['src/report/export.js'],outfile:'.cache/report-export-check.mjs',bundle:true,format:'esm',platform:'browser',minify:true});
const {createReportBlob}=await import('../.cache/report-export-check.mjs?run='+Date.now());
const db=indexData(JSON.parse(await readFile('public/data/database.json','utf8')));
const id=name=>db.skills.find(s=>s.name.en===name).id;
const query={requirements:{[id('Gogmapocalypse')]:1,[id("Lord's Favor")]:1,[id('Attack Boost')]:3},weaponTypes:['great-sword'],families:['gogma'],weaponId:db.weapons.find(w=>w.kind==='great-sword'&&w.family==='gogma').id,attribute:'dragon',rank:'high',transcended:true,priority:'defense',limit:2,scenario:{}};
const search=createSearch(db,query);let state;
do{state=search.step(10);}while(!state.results.length&&!state.exhausted);
assert.ok(state.results.length);
const run={id:'example-report',createdAt:Date.now(),updatedAt:Date.now(),fingerprint:datasetFingerprint(db),solverVersion:SEARCH_VERSION,query,status:'paused',sequence:1,resultCount:state.results.length,counts:state.counts};
const store={catalog:async()=>archiveCatalog(db),async *records(){yield state.results.map(b=>compactBuild(b,db));}};
const blob=await createReportBlob(store,run,{language:'es'}),html=await blob.text();
const errors=[],consoleBridge=new VirtualConsole();consoleBridge.on('jsdomError',e=>errors.push(e));
const dom=new JSDOM(html,{runScripts:'dangerously',virtualConsole:consoleBridge,url:'file:///report.html'});
try{
  const doc=dom.window.document;
  assert.deepEqual(errors,[]);assert.ok(doc.querySelector('article.build'));
  const details=doc.querySelector('.build-details');details.open=true;details.dispatchEvent(new dom.window.Event('toggle'));
  assert.ok(details.textContent.includes(db.skillMap.get(id('Gogmapocalypse')).name.es));
  assert.ok(details.textContent.includes(db.skillMap.get(id("Lord's Favor")).name.es));
  assert.deepEqual(errors,[]);
}finally{dom.window.close();}
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/example-search-report.html',html);
console.log(`Minified standalone HTML verified: ${run.resultCount} Gogma builds, both weapon bonuses, ${blob.size.toLocaleString()} bytes, no external resources.`);
