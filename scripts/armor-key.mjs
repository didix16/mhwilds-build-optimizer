// Keep variant letters: stripping them merged alpha, beta and gamma records.
export const armorKey=name=>name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function indexArmorPieces(sets){
  const result=new Map();
  for(const set of sets)for(const piece of set.Pieces){const key=armorKey(piece.Name);if(result.has(key))throw Error(`Ambiguous armor source name: ${piece.Name}`);result.set(key,piece);}
  return result;
}
