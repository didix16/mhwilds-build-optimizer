// Kept self-contained so the exact same function runs in the exported HTML.
export function filterReport(builds, catalog, filters) {
  const weapons=new Map(catalog.weapons.map(w=>[w.id,w])),armor=new Map(catalog.armor.map(a=>[a.id,a])),decos=new Map(catalog.decorations.map(d=>[d.id,d])),skills=new Map(catalog.skills.map(s=>[s.id,s]));
  const words=(filters.text||'').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const names=e=>`${e?.name?.en||''} ${e?.name?.es||''}`;
  return builds.filter(b=>{
    const w=weapons.get(b.weapon);
    if(filters.types?.length&&!filters.types.includes(w.kind))return false;
    if(filters.weapons?.length&&!filters.weapons.includes(b.weapon))return false;
    if(Object.entries(filters.armor||{}).some(([kind,ids])=>ids.length&&!b.armor.some(id=>armor.get(id)?.kind===kind&&ids.includes(id))))return false;
    if(Object.entries(filters.skills||{}).some(([id,level])=>(b.levels[id]||0)<level))return false;
    if(filters.excluded?.some(id=>(b.levels[id]||0)>0))return false;
    if(b.stats.attack<(filters.attack||0)||b.stats.defense<(filters.defense||0)||b.stats.affinity<(filters.affinity??-100))return false;
    if(filters.element&&filters.element!=='any'){
      const elements=b.config?[b.config.attribute]:w.specials.map(s=>s.element||s.status);
      if(filters.element==='none'?elements.some(e=>e&&e!=='none'):!elements.includes(filters.element))return false;
    }
    if(words.length){const text=[names(w),...b.armor.map(id=>names(armor.get(id))),names(b.charm),...b.decorations.map(p=>names(decos.get(p.decoration))),...Object.entries(b.levels).filter(([,level])=>level>0).map(([id])=>names(skills.get(+id)))].join(' ').toLocaleLowerCase();if(!words.every(word=>text.includes(word)))return false;}
    return true;
  });
}
