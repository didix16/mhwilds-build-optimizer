// An initial beam supplies promising complete candidates. The subsequent prefix
// traversal is exhaustive within the modeled pools: only proven-impossible
// branches are removed, and no armor is dropped for being lower-ranked.
export function createTraversal(lists,query,solver,bonusTargets,charms,checkpoint) {
  const bonusIds=Object.keys(bonusTargets),targets=bonusIds.map(id=>bonusTargets[id]);
  const n=solver.ids.length;
  function row(e,axis){
    const slots=Array(8).fill(0);for(const s of e.currentSlots||e.slots)slots[solver.bucket(axis===0?'weapon':'armor',s.level||s)]++;
    return {normal:solver.ids.map((id,i)=>Math.min(solver.targets[i],e.skills[id]||0)),bonus:bonusIds.map(id=>e.bonuses[id]||0),slots,defense:e.currentDefense||0};
  }
  const rows=lists.map((list,axis)=>list.map(e=>row(e,axis)));
  const empty=()=>({normal:Array(n).fill(0),bonus:targets.map(()=>0),slots:Array(8).fill(0),defense:0});
  const grow=(a,b)=>({normal:a.normal.map((v,i)=>Math.min(solver.targets[i],v+b.normal[i])),bonus:a.bonus.map((v,i)=>Math.min(targets[i],v+b.bonus[i])),slots:a.slots.map((v,i)=>v+b.slots[i]),defense:a.defense+b.defense});
  const maxCharm=Array(n).fill(0),maxCharmSlots=Array(8).fill(0),maxCharmGroup=solver.groups.map(()=>0);
  for(const c of charms){
    const normal=solver.ids.map((id,i)=>Math.min(solver.targets[i],c.skills[id]||0)),slots=solver.countsFor(c.slots.map(s=>typeof s==='number'?{kind:'armor',level:s}:s));
    normal.forEach((v,i)=>{maxCharm[i]=Math.max(maxCharm[i],v);});slots.forEach((v,i)=>{maxCharmSlots[i]=Math.max(maxCharmSlots[i],v);});
    solver.groups.forEach((g,i)=>{maxCharmGroup[i]=Math.max(maxCharmGroup[i],g.indices.reduce((sum,j)=>sum+normal[j],0));});
  }
  const suffixNormal=Array.from({length:7},()=>Array(n).fill(0));
  const suffixBonus=Array.from({length:7},()=>targets.map(()=>0));
  const suffixSlots=Array.from({length:7},()=>Array(8).fill(0));
  const suffixGroup=Array.from({length:7},()=>solver.groups.map(()=>0));
  for(let axis=5;axis>=1;axis--){
    for(let i=0;i<n;i++)suffixNormal[axis][i]=suffixNormal[axis+1][i]+Math.max(0,...rows[axis].map(r=>r.normal[i]));
    for(let i=0;i<targets.length;i++)suffixBonus[axis][i]=suffixBonus[axis+1][i]+Math.max(0,...rows[axis].map(r=>r.bonus[i]));
    for(let i=0;i<8;i++)suffixSlots[axis][i]=suffixSlots[axis+1][i]+Math.max(0,...rows[axis].map(r=>r.slots[i]));
    solver.groups.forEach((g,i)=>{suffixGroup[axis][i]=suffixGroup[axis+1][i]+Math.max(0,...rows[axis].map(r=>g.indices.reduce((sum,j)=>sum+r.normal[j],0)));});
  }
  function canReach(state,axis){
    if(state.bonus.some((v,i)=>v+suffixBonus[axis][i]<targets[i]))return false;
    const slots=state.slots.map((v,b)=>v+suffixSlots[axis][b]+maxCharmSlots[b]);
    const gaps=state.normal.map((v,i)=>Math.max(0,solver.targets[i]-v-suffixNormal[axis][i]-maxCharm[i]));
    if(!solver.canFit(gaps,slots))return false;
    for(let g=0;g<solver.groups.length;g++){
      const group=solver.groups[g],needed=group.indices.reduce((sum,i)=>sum+Math.max(0,solver.targets[i]-state.normal[i]),0);
      const available=suffixGroup[axis][g]+maxCharmGroup[g]+slots.reduce((sum,c,b)=>sum+c*group.capacity[b],0);
      if(needed>available)return false;
    }
    return true;
  }
  const weight=solver.minCost.map(v=>Number.isFinite(v)?v:8);
  const merit=state=>state.normal.reduce((sum,v,i)=>sum+v*weight[i],0)+state.bonus.reduce((sum,v)=>sum+v*8,0)+state.slots.reduce((sum,c,b)=>sum+c*(b%4+1)*.35,0)+state.defense*.0001;
  const byType=new Map();lists[0].forEach((w,i)=>{if(!byType.has(w.kind))byType.set(w.kind,[]);byType.get(w.kind).push(i);});
  const cursors=[...byType].map(([kind,weapons])=>({kind,weapons,weaponNext:0,stack:[],scouts:[]}));
  let position=0,scoutPosition=0,expanded=0,pruned=0;
  const scouted=new Set(checkpoint?.scouted||[]);
  if(checkpoint){
    if(JSON.stringify(cursors.map(c=>c.weapons))!==JSON.stringify(checkpoint.cursors.map(c=>c.weapons)))throw Error('Checkpoint candidate pools changed');
    checkpoint.cursors.forEach((c,i)=>{cursors[i]={...c};});
    position=checkpoint.position;scoutPosition=checkpoint.scoutPosition;expanded=checkpoint.expanded;pruned=checkpoint.pruned;
  }else if(n+bonusIds.length>=4&&lists.every(list=>list.length)){
    for(const cursor of cursors){
      const signatures=new Set();
      for(const wi of cursor.weapons){
        const initial=rows[0][wi],signature=`${initial.normal}|${initial.bonus}|${initial.slots}`;
        if(signatures.has(signature))continue;signatures.add(signature);
        let beam=canReach(initial,1)?[{index:[wi],state:initial}]:[];
        for(let axis=1;axis<=5&&beam.length;axis++){
          const unique=new Map();
          for(const entry of beam)for(let i=0;i<rows[axis].length;i++){
            const state=grow(entry.state,rows[axis][i]);if(!canReach(state,axis+1))continue;
            const key=`${state.normal}|${state.bonus}|${state.slots}`,score=merit(state),old=unique.get(key);
            if(!old||old.score<score)unique.set(key,{index:[...entry.index,i],state,score});
          }
          beam=[...unique.values()].sort((a,b)=>b.score-a.score).slice(0,32);
        }
        for(const entry of beam){const key=entry.index.join(',');if(!scouted.has(key)){scouted.add(key);cursor.scouts.push(entry.index);}}
        // This bounds only the initial scouting work, not the exhaustive search.
        if(signatures.size>=2)break;
      }
    }
  }
  let scoutRemaining=cursors.reduce((sum,c)=>sum+c.scouts.length,0);
  const active=c=>c.stack.length>0||c.weaponNext<c.weapons.length;
  return {
    get active(){return scoutRemaining>0||cursors.some(active);},
    get queued(){return cursors.reduce((sum,c)=>sum+c.scouts.length+(c.weapons.length-c.weaponNext)+c.stack.reduce((n,f)=>n+lists[f.index.length].length-f.next,0),0);},
    get counts(){return {expanded,pruned};},
    next(){
      if(scoutRemaining)for(let i=0;i<cursors.length;i++){const c=cursors[scoutPosition++%cursors.length];if(c.scouts.length){scoutRemaining--;return c.scouts.shift();}}
      let cursor;for(let i=0;i<cursors.length;i++){const c=cursors[position++%cursors.length];if(active(c)){cursor=c;break;}}
      if(!cursor)return;
      if(!cursor.stack.length){
        const wi=cursor.weapons[cursor.weaponNext++],state=rows[0][wi];expanded++;
        if(canReach(state,1))cursor.stack.push({index:[wi],state,next:0});else pruned++;
        return;
      }
      const frame=cursor.stack.at(-1),axis=frame.index.length;
      if(frame.next>=lists[axis].length){cursor.stack.pop();return;}
      const i=frame.next++,index=[...frame.index,i],state=grow(frame.state,rows[axis][i]);expanded++;
      if(!canReach(state,axis+1)){pruned++;return;}
      if(index.length===6){const key=index.join(',');if(scouted.delete(key))return;return index;}
      cursor.stack.push({index,state,next:0});
    },
    snapshot(){return structuredClone({cursors,position,scoutPosition,expanded,pruned,scouted:[...scouted]});},
  };
}
