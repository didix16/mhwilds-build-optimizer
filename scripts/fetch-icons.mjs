import {readFile,writeFile,mkdir} from 'node:fs/promises';
const db=JSON.parse(await readFile('public/data/database.json','utf8'));
await mkdir('public/icons/skills',{recursive:true});
const queue=[...db.skills];let downloaded=0;
await Promise.all(Array.from({length:6},async()=>{while(queue.length){const s=queue.shift();const name=s.name.en.replaceAll('/','_');const r=await fetch(`https://raw.githubusercontent.com/ni-null/MHWilds-Charm-Odds-Calculator/90e1d852c0fa20ce3e38f36dbc679c0d105fe6dd/public/image/skills/${encodeURIComponent(name)}.png`);if(r.ok){await writeFile(`public/icons/skills/${s.id}.png`,Buffer.from(await r.arrayBuffer()));s.icon=`icons/skills/${s.id}.png`;downloaded++;}}}));
await writeFile('public/data/database.json',JSON.stringify(db));
await writeFile('public/data/icon-manifest.json',JSON.stringify(Object.fromEntries(db.skills.filter(s=>s.icon).map(s=>[s.id,s.icon])),null,2));
console.log(`${downloaded} game skill icons downloaded; remaining skills use category icons.`);
