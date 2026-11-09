import {readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {serviceWorkerSource} from './offline-worker.mjs';
const files=[];
async function walk(dir){for(const file of await readdir(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())await walk(full);else if(file.name!=='sw.js')files.push(full.replaceAll('\\','/').replace(/^dist\//,''));}}
await walk('dist');
const hash=createHash('sha256');for(const file of files.sort())hash.update(await readFile(`dist/${file}`));
const version=hash.digest('hex').slice(0,16);
const script=serviceWorkerSource(files,version);
await writeFile('dist/sw.js',script);
console.log(`Offline cache ${version}: ${files.length} local files.`);
