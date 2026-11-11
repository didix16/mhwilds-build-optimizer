import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PrimeReactProvider} from 'primereact/api';
import {messages} from '../src/i18n.js';
import {indexData} from '../src/engine/equipment.js';
import {createSearch} from '../src/engine/solver.js';
import BuildDetail from '../src/components/BuildDetail.jsx';
import Catalog from '../src/components/Catalog.jsx';
import Sources from '../src/components/Sources.jsx';
import SearchArchive from '../src/components/SearchArchive.jsx';
import {archiveMessages} from '../src/archive/messages.js';
import {datasetFingerprint,SEARCH_VERSION} from '../src/engine/search-record.js';
const db=indexData(JSON.parse(await readFile('public/data/database.json','utf8')));
const query={requirements:{72:3,57:2},weaponTypes:['great-sword'],families:['crafted'],attribute:'any',rank:'high',transcended:true,priority:'defense',limit:20,scenario:{}};
const result=createSearch(db,query).step(1).results[0];assert.ok(result);
for(const lang of ['en','es']){
  const t={...messages[lang],...archiveMessages[lang]};
  const archive={runs:[{id:'render-check',createdAt:Date.now(),updatedAt:Date.now(),sequence:1,resultCount:123,query,status:'paused',fingerprint:datasetFingerprint(db),solverVersion:SEARCH_VERSION}],active:null};
  const markup=renderToStaticMarkup(<PrimeReactProvider><BuildDetail build={result} query={query} {...{db,lang,t}} onSave={()=>{}} onExport={()=>{}}/><Catalog {...{db,lang,t}}/><Sources {...{db,lang,t}}/><SearchArchive {...{db,lang,t,archive}}/></PrimeReactProvider>);
  assert.ok(markup.includes(result.weapon.name[lang]));assert.ok(markup.includes(t.verified));assert.ok(markup.includes(t.requirements)||markup.includes(t.allSkills));assert.ok(markup.includes('1.042.00.03'));
  assert.ok(!markup.includes('src="undefined'));assert.ok(!markup.includes('>NaN<'));
  assert.ok(markup.includes(t.searches)&&markup.includes(t.report)&&markup.includes(t.resumeSearch));
  console.log(`${lang}: build, catalog, source and archive components rendered (${markup.length.toLocaleString()} characters).`);
}
