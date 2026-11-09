import { mkdir, writeFile, readFile } from 'node:fs/promises';
const root = 'https://raw.githubusercontent.com/chanleyou/mhwilds-calculator/bf5f6cf78386e374ee5d15c8d9193ff31532e8b1/';
const files = ['src/model/index.ts', 'src/types.ts', 'src/data/index.ts', 'src/data/skills.ts', ...['index','ammo','bow','chargeBlade','dualBlades','greatSword','gunlance','hammer','heavyBowgun','huntingHorn','insectGlaive','lance','lightBowgun','longSword','switchAxe','swordAndShield'].map(n=>`src/data/attacks/${n}.ts`)];
await mkdir('src/vendor/calculator/attacks', {recursive:true});
await mkdir('public/icons', {recursive:true});
for (const file of files) {
  const response = await fetch(root + file);
  if (!response.ok) throw Error(`${response.status}: ${file}`);
  const target = file === 'src/model/index.ts' ? 'model.ts' : file === 'src/data/index.ts' ? 'data.ts' : file.replace(/^src\/(data\/)?/, '');
  const prefix = target.startsWith('attacks/') ? '../' : './';
  const content = (await response.text()).replaceAll('"@/types"', `"${prefix}types"`).replaceAll('"@/data"', `"${prefix}data"`).replaceAll('"@/model"', `"${prefix}model"`);
  await writeFile(`src/vendor/calculator/${target}`, '// MIT · chanleyou/mhwilds-calculator · revision bf5f6cf\n' + content);
}
await writeFile('src/vendor/calculator/LICENSE.md', await readFile('.cache/sources/calculator-LICENSE.md'));
for (const name of ['arms','body','bow','charge-blade','dual-blades','great-sword','gunlance','hammer','heavy-bowgun','helm','hunting-horn','insect-glaive','lance','legs','light-bowgun','long-sword','switch-axe','sword-and-shield','waist']) {
  const r = await fetch(root + `public/${name}.svg`);
  if (!r.ok) throw Error(`icon ${name}: ${r.status}`);
  await writeFile(`public/icons/${name}.svg`, await r.text());
}
console.log('Combat reference and equipment icons downloaded.');
