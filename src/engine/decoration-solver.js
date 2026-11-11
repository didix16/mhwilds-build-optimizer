// Query-local compilation: typed-slot capacities and jewel vectors are built once.
// Memoized plans use bucket numbers, so equivalent slots can reuse a witness even
// when their armor owners differ. Every returned placement is still verified.
export function createDecorationSolver(db,requirements,{cacheLimit=30000}={}) {
  const ids=Object.keys(requirements).filter(id=>!['set','group'].includes(db.skillMap.get(+id)?.kind));
  const targets=ids.map(id=>requirements[id]);
  const bucket=(kind,level)=>(kind==='weapon'?0:4)+level-1;
  const unique=new Map();
  for(const d of db.decorations){
    const gain=ids.map((id,i)=>Math.min(targets[i],d.skills[id]||0));
    if(!gain.some(Boolean))continue;
    const key=`${d.kind}:${d.slot}:${gain}`;
    if(!unique.has(key))unique.set(key,{id:d.id,kind:d.kind,slot:d.slot,gain});
  }
  const jewels=[...unique.values()];
  const compatible=Array.from({length:8},(_,b)=>jewels.filter(d=>bucket(d.kind,d.slot)<=b&&(d.kind==='weapon'?b<4:b>=4)));
  const capacity=Array.from({length:8},(_,b)=>ids.map((_,i)=>Math.max(0,...compatible[b].map(d=>d.gain[i]))));
  const minCost=ids.map((_,i)=>Math.min(...jewels.filter(d=>d.gain[i]).map(d=>d.slot/d.gain[i])));
  const masks=new Map();
  const mask=indices=>{if(indices.length)masks.set(indices.join(','),indices);};
  mask(ids.map((_,i)=>i));
  for(const kind of ['weapon','armor'])for(const min of [1,2,3,4])mask(ids.map((_,i)=>i).filter(i=>{
    const grants=jewels.filter(d=>d.gain[i]);return grants.length&&grants.every(d=>d.kind===kind&&d.slot>=min);
  }));
  const groups=[...masks.values()].map(indices=>({indices,capacity:compatible.map(ds=>Math.max(0,...ds.map(d=>indices.reduce((n,i)=>n+d.gain[i],0))))}));
  const memo=new Map();
  const gapsFor=levels=>ids.map((id,i)=>Math.max(0,targets[i]-(levels[id]||0)));
  const countsFor=slots=>{const counts=Array(8).fill(0);for(const s of slots)counts[bucket(s.kind,s.level)]++;return counts;};
  function canFit(gaps,counts){
    for(let i=0;i<ids.length;i++)if(gaps[i]>0&&gaps[i]>counts.reduce((n,c,b)=>n+c*capacity[b][i],0))return false;
    for(const group of groups)if(group.indices.reduce((n,i)=>n+gaps[i],0)>counts.reduce((n,c,b)=>n+c*group.capacity[b],0))return false;
    return true;
  }
  function remember(key,value){if(memo.size>=cacheLimit)memo.delete(memo.keys().next().value);memo.set(key,value);return value;}
  function visit(gaps,counts){
    if(!gaps.some(Boolean))return [];
    const key=`${gaps}|${counts}`;
    if(memo.has(key))return memo.get(key);
    if(!canFit(gaps,counts))return remember(key,null);
    let options;
    for(let i=0;i<ids.length;i++)if(gaps[i]>0){
      const available=[];
      for(const d of jewels)if(d.gain[i]){
        let b=bucket(d.kind,d.slot),end=d.kind==='weapon'?4:8;
        while(b<end&&!counts[b])b++;
        if(b<end)available.push({d,b,gain:d.gain.reduce((n,v,j)=>n+Math.min(gaps[j],v),0)});
      }
      if(!available.length)return remember(key,null);
      if(!options||available.length<options.length)options=available;
    }
    options.sort((a,b)=>b.gain-a.gain||a.d.slot-b.d.slot);
    const seen=new Set();
    for(const {d,b} of options){
      const next=gaps.map((n,i)=>Math.max(0,n-d.gain[i])),signature=`${b}:${next}`;
      if(seen.has(signature))continue;seen.add(signature);
      counts[b]--;const rest=visit(next,counts);counts[b]++;
      if(rest)return remember(key,[{bucket:b,decoration:d.id},...rest]);
    }
    return remember(key,null);
  }
  return {ids,targets,groups,capacity,minCost,bucket,gapsFor,countsFor,canFit,
    place(levels,slots){
      const plan=visit(gapsFor(levels),countsFor(slots));if(!plan)return null;
      const free=Array.from({length:8},()=>[]);for(const s of slots)free[bucket(s.kind,s.level)].push(s.key);
      return plan.map(p=>({slot:free[p.bucket].shift(),decoration:p.decoration}));
    },
  };
}
