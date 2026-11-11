import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {indexData} from '../src/engine/equipment.js';
import {verifyBuild} from '../src/engine/verify.js';

const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const dataset=option('--data','public/data/database.json');
const {createSearch}=await import(pathToFileURL(resolve(option('--engine','src/engine/solver.js'))));
const db=indexData(JSON.parse(await readFile(dataset,'utf8')));
const levels={'Antivirus':3,'Critical Boost':3,'Flayer':2,'Shock Absorber':1,'Ballistics':3,'Weakness Exploit':5,'Earplugs':2,'Piercing Shots':1,'Burst':1,'Evade Extender':2,"Gore Magala's Tyranny":1,'Divine Blessing':3,'Opening Shot':3,'Agitator':5};
if(args.includes('--conflict'))levels['Rapid Fire Up']=1;
const query={requirements:Object.fromEntries(Object.entries(levels).map(([name,n])=>[db.skills.find(s=>s.name.en===name).id,n])),weaponTypes:['light-bowgun'],families:['artian','gogma'],weaponId:db.weapons.find(w=>w.kind==='light-bowgun'&&w.family==='gogma'&&w.focus==='affinity').id,attribute:'any',rank:'all',transcended:true,priority:'defense',limit:20,scenario:{}};
const started=performance.now();let firstResultMs=null,firstBuild=null;
const search=createSearch(db,query,{onBuild(build){if(firstResultMs===null){firstResultMs=performance.now()-started;firstBuild=build;}}});
const initializationMs=performance.now()-started,deadline=+(option('--seconds','30'))*1000;
let state;
do{state=search.step(130);}while(firstResultMs===null&&!state.exhausted&&performance.now()-started<deadline);
if(firstBuild&&!verifyBuild(db,firstBuild,query).valid)throw Error('Benchmark emitted an invalid build');
if(firstBuild&&option('--build-out',null)){await mkdir('artifacts',{recursive:true});await writeFile(option('--build-out'),JSON.stringify({schema:1,dataset:db.meta.targetVersion,query,build:firstBuild},null,2));}
const report={case:args.includes('--conflict')?'pierce-and-rapid-conflict':'video-02:38-pierce',dataset,weapon:query.weaponId,requirements:levels,initializationMs,firstResultMs,totalMs:performance.now()-started,counts:state.counts,candidateCounts:state.candidateCounts,exhausted:state.exhausted,reason:state.reason||null,firstBuild:firstBuild?{weapon:firstBuild.weapon.name.en,armor:firstBuild.armor.map(a=>a.name.en),charm:firstBuild.charm,decorations:firstBuild.decorations,levels:firstBuild.levels}:null};
if(option('--out',null)){await mkdir('artifacts',{recursive:true});await writeFile(option('--out'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
