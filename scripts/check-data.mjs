import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const db=JSON.parse(await readFile('public/data/database.json','utf8'));
const skillIds=new Set(db.skills.map(x=>x.id)),itemIds=new Set(db.items.map(x=>x.id));
for(const [kind,entries] of Object.entries(db).filter(([,v])=>Array.isArray(v))){
  if(!['skills','armor','weapons','decorations','charms','items','monsters'].includes(kind))continue;
  assert.equal(new Set(entries.map(x=>x.id)).size,entries.length,`duplicate ${kind} IDs`);
  for(const e of entries){
    assert.ok(e.name.en&&e.name.es,`${kind} ${e.id}: missing translation`);
    for(const id of [...Object.keys(e.skills||{}),...Object.keys(e.bonuses||{})])assert.ok(skillIds.has(+id),`unknown skill ${id}`);
    for(const m of [...(e.materials||[]),...(e.transcendMaterials||[])]){assert.ok(itemIds.has(m.item)||m.name?.en,`unknown material ${m.item}`);assert.ok(m.quantity>0);}
    for(const slot of e.slots||[])assert.ok(Number.isInteger(slot)&&slot>=1&&slot<=4);
    if(e.icon&&typeof e.icon==='string')await access('public/'+e.icon);
  }
}
for(const s of db.skills){assert.ok(s.max>0);assert.ok(s.ranks.length);assert.ok(s.ranks.every(r=>r.level>0));}
assert.equal(new Set(db.weapons.map(w=>w.kind)).size,14);
for(const group of db.charmGroups)for(const s of group.skills)assert.ok(skillIds.has(s.id));
for(const c of db.randomCharms)for(const slotList of c.slots)for(const s of slotList)assert.ok(['weapon','armor'].includes(s.kind)&&s.level>=1&&s.level<=3);
assert.ok(db.armor.some(a=>a.name.en.includes('Arkvulcan')&&a.name.en.includes('γ')));
assert.ok(db.armor.some(a=>a.name.en.includes('Gogmazios')));
assert.ok(db.skills.some(s=>s.name.en==='Gogmapocalypse'));
console.log(`Data checks passed: ${db.skills.length} bilingual skills, ${db.armor.length} armor, ${db.weapons.length} weapons (14 types), ${db.decorations.length} decorations, ${db.randomCharms.length} random-charm templates.`);
