import { armorVariant, indexData } from '../engine/equipment.js';
import { configureArtian } from '../engine/artian.js';
import { unconditionalStatistics } from '../engine/damage.js';

export function archiveCatalog(db) {
  return Object.fromEntries(['meta','skills','weapons','armor','decorations','charms','items','artian'].map(key=>[key,db[key]]));
}
export function reportRecord(rawDb,record,query) {
  const {runId,sequence,...build}=record;
  if(record.stats)return build;
  const db=rawDb.skillMap?rawDb:indexData(rawDb);
  const base=db.weaponMap.get(record.weapon);
  const weapon=record.config?configureArtian(db,base,record.config):base;
  const armor=record.armor.map(id=>armorVariant(db.armorMap.get(id),query.transcended));
  // Deliberately exclude target, conditional activations, items and combos.
  return {...build,stats:unconditionalStatistics(db,weapon,armor,record.levels)};
}
