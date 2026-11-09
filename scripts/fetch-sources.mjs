import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await mkdir('.cache/sources', { recursive: true });
const records = [];
async function download(name, url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'MHWildsBuildOptimizer/0.1' } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(`.cache/sources/${name}`, buffer);
  records.push({ name, url, sha256: createHash('sha256').update(buffer).digest('hex'), bytes: buffer.length });
  console.log(`${name}: ${buffer.length} bytes`);
}
for (const language of ['en', 'es']) {
  for (const kind of ['skills', 'armor', 'weapons', 'decorations', 'charms', 'items', 'monsters']) {
    await download(`${language}-${kind}.json`, `https://wilds.mhdb.io/${language}/${kind}`);
  }
}
const repos = {
  mhdb: ['LartTyler/mhdb-wilds-data', 'c50a1eb892f4a1ad9bb35c147801658804be2cc2'],
  charms: ['ni-null/MHWilds-Charm-Odds-Calculator', '90e1d852c0fa20ce3e38f36dbc679c0d105fe6dd'],
  calculator: ['chanleyou/mhwilds-calculator', 'bf5f6cf78386e374ee5d15c8d9193ff31532e8b1'],
  sets: ['cecilbowen/mhwilds-set-search', '2cf89ea3baa8f7494b81d68fb00c427eeadc3860'],
};
const files = [
  ['mhdb', 'output/merged/ArmorUpgrade.json'],
  ['mhdb', 'output/merged/Amulet.json'],
  ['charms', 'src/data/Rarity.json'],
  ['charms', 'src/data/SkillGroups.json'],
  ['calculator', 'src/components/ArtianDialog.tsx'],
  ['calculator', 'src/data/attacks/index.ts'],
  ['calculator', 'src/data/skills.ts'],
  ['calculator', 'LICENSE.md'],
  ['sets', 'src/data/compact/defense-levels.json'],
  ['sets', 'src/data/manual/armor.json'],
  ['sets', 'src/data/manual/set-overwrites.json'],
  ['sets', 'src/data/detailed/head.json'],
];
for (const [key, path] of files) {
  const [repo, commit] = repos[key];
  await download(`${key}-${path.split('/').at(-1)}`, `https://raw.githubusercontent.com/${repo}/${commit}/${path}`);
}
for (const [name,path] of [['wiki-armor.json','Module:MHWilds/data/Armor.json'],['wiki-weapons.json','Module:MHWilds/data/Weapons.json'],['wiki-rng.json','Module:MHWilds/data/RngTalismans.json'],['wiki-groups.json','Module:MHWilds/data/TalismanSkillGroups.json'],['wiki-artian.txt','Artian_Weapons_(MHWilds)'],['wiki-gogma.txt','Gogma_Artian_Weapons_(MHWilds)']]) {
  await download(name, `https://monsterhunterwiki.org/wiki/${path}?action=raw`);
}
await writeFile('.cache/sources/manifest.json', JSON.stringify({ downloadedAt: new Date().toISOString(), repos, records }, null, 2));
