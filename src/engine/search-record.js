import { unconditionalStatistics } from './damage.js';
// These versions describe resumable solver state, not the game's patch version.
export const SEARCH_VERSION = 2;
const fingerprints = new WeakMap();
export function datasetFingerprint(db) {
  if (fingerprints.has(db)) return fingerprints.get(db);
  const raw = JSON.stringify([db.meta, db.skills, db.weapons, db.armor, db.decorations, db.charms, db.randomCharms, db.charmGroups, db.artian]);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < raw.length; i++) { a = Math.imul(a ^ raw.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ raw.charCodeAt(i); }
  const key = `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
  fingerprints.set(db, key);
  return key;
}
export function equipmentKey(build) {
  return JSON.stringify([build.weapon.baseId || build.weapon.id, build.weapon.config || null, build.armor.map(a => [a.id, !!a.upgraded])]);
}
export function buildKey(build) {
  const c = build.charm;
  return JSON.stringify([equipmentKey(build), c.random ? [c.template, c.slotVariant, c.rolls] : c.id,
    [...build.decorations].sort((a, b) => a.slot.localeCompare(b.slot)).map(p => [p.slot, p.decoration])]);
}
export function compactBuild(build,db) {
  return { key: build.key, equipment: equipmentKey(build), weapon: build.weapon.baseId || build.weapon.id,
    config: build.weapon.config || null, armor: build.armor.map(a => a.id), charm: build.charm,
    decorations: build.decorations, levels: build.levels, rarity: build.rarity,
    ...(db?{stats:unconditionalStatistics(db,build.weapon,build.armor,build.levels)}:{}) };
}
