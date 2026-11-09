import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const html=await readFile('dist/index.html','utf8');
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await access(`dist/${match[1].slice(2)}`);
assert.equal(hash(await readFile('dist/data/database.json')),hash(await readFile('public/data/database.json')),'Bundled database is stale');
const sw=await readFile('dist/sw.js','utf8');
const files=JSON.parse(sw.match(/const FILES=(\[[^\n]+\]);/)[1]);
assert.ok(files.includes('./index.html')&&files.includes('./data/database.json'));
assert.ok(files.some(f=>/worker-.*\.js$/.test(f)));
for(const file of files){assert.ok(file.startsWith('./')&&!file.includes('..'));await access(`dist/${file.slice(2)}`);}
const db=JSON.parse(await readFile('dist/data/database.json','utf8'));
for(const s of db.skills)if(s.icon)assert.ok(files.includes('./'+s.icon));
console.log(`Static build verified: ${files.length} precached files, current database, local skill icons and Worker.`);
