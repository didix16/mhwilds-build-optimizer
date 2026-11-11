import { ARMOR_KINDS,add,armorVariant,slotsFor,tally,satisfies,hasAttribute } from './equipment.js';
import { GOGMA_SETS,GOGMA_GROUPS,optimizeArtian } from './artian.js';
import { charmCandidates,placeDecorations } from './decorations.js';
import { statistics } from './damage.js';
import { verifyBuild } from './verify.js';
import { SEARCH_VERSION,datasetFingerprint,buildKey } from './search-record.js';

class Heap {
  values=[];
  push(value){let i=this.values.push(value)-1;while(i>0){const p=(i-1)>>1;if(this.values[p].score>=value.score)break;this.values[i]=this.values[p];i=p;}this.values[i]=value;}
  pop(){const top=this.values[0],last=this.values.pop();if(this.values.length){let i=0;while(true){let c=i*2+1;if(c>=this.values.length)break;if(c+1<this.values.length&&this.values[c+1].score>this.values[c].score)c++;if(this.values[c].score<=last.score)break;this.values[i]=this.values[c];i=c;}this.values[i]=last;}return top;}
  get length(){return this.values.length;}
}
class FairHeap {
  heaps=new Map();position=0;
  constructor(lists){this.lists=lists;}
  push(value){const type=this.lists[0][value.index[0]].kind;if(!this.heaps.has(type))this.heaps.set(type,new Heap());this.heaps.get(type).push(value);}
  pop(){const keys=[...this.heaps.keys()];for(let i=0;i<keys.length;i++){const h=this.heaps.get(keys[this.position++%keys.length]);if(h.length)return h.pop();}}
  get length(){return [...this.heaps.values()].reduce((n,h)=>n+h.length,0);}
}
export function compareBuilds(a,b,priority) {
  if(priority==='damage')return b.stats.damage-a.stats.damage||b.stats.defense-a.stats.defense||b.rarity-a.rarity;
  return b.stats.defense-a.stats.defense||b.rarity-a.rarity||b.stats.damage-a.stats.damage;
}
function bonusFeasible(db,lists,requirements,ids){
  if(!ids.length)return true;
  const targets=ids.map(id=>db.skillMap.get(+id).ranks.find(r=>r.level===requirements[id]).points);
  let states=new Map([[ids.map(()=>0).join(','),ids.map(()=>0)]]);
  for(const list of lists){
    const vectors=[...new Map(list.map(e=>{const v=ids.map(id=>e.bonuses[id]||0);return [v.join(','),v];})).values()];
    const next=new Map();
    for(const state of states.values())for(const v of vectors){const sum=state.map((n,i)=>Math.min(targets[i],n+v[i]));next.set(sum.join(','),sum);if(next.size>20000)return true;}
    states=next;
  }
  return states.has(targets.join(','));
}
function weaponCandidates(db,query) {
  const candidates=[];
  const sets=db.skills.filter(s=>GOGMA_SETS.includes(s.name.en)),groups=db.skills.filter(s=>GOGMA_GROUPS.includes(s.name.en));
  for(const w of db.weapons){
    if(query.weaponTypes?.length&&!query.weaponTypes.includes(w.kind)||query.families?.length&&!query.families.includes(w.family)||query.weaponId&&query.weaponId!==w.id)continue;
    if(w.family==='crafted'&&!hasAttribute(w,query.attribute))continue;
    if(w.family!=='crafted'&&w.kind.includes('bowgun')&&query.attribute!=='any'&&query.attribute!=='none'&&!hasAttribute(w,query.attribute))continue;
    if(w.family==='gogma') {
      for(const s of sets)for(const g of groups)candidates.push({...w,setSkill:s.id,groupSkill:g.id,bonuses:{[s.id]:1,[g.id]:1},searchId:`${w.id}:${s.id}:${g.id}`});
    }else candidates.push({...w,searchId:w.id});
  }
  return candidates;
}
function scoreEquipment(db,e,query){
  let value=0;
  for(const [id,level] of Object.entries(query.requirements)) {
    const skill=db.skillMap.get(+id);
    if(['set','group'].includes(skill.kind))value+=(e.bonuses[id]||0)*55;
    else value+=Math.min(e.skills[id]||0,level)*25;
  }
  const slotSum=(e.currentSlots||e.slots).reduce((n,s)=>n+(s.level||s),0);
  value+=slotSum*2+(e.currentDefense||0)*.05+e.rarity*.03;
  if(e.attack)value+=e.attack*.01+e.affinity*.005;
  if(query.priority==='damage')for(const [id,l] of Object.entries(e.skills)){
    const name=db.skillMap.get(+id)?.name.en;
    if(['Attack Boost','Critical Eye','Critical Boost','Weakness Exploit','Handicraft'].includes(name))value+=l*2;
  }
  return value;
}
function optionalDecorations(db,build,query,targets=[]){
  const used=new Set(build.decorations.map(p=>p.slot));
  const free=slotsFor(build.weapon,build.armor,build.charm).filter(s=>!used.has(s.key));
  const allowed=new Set((query.priority==='defense'?['Defense Boost','Fire Resistance','Water Resistance','Thunder Resistance','Ice Resistance','Dragon Resistance']:['Attack Boost','Critical Eye','Critical Boost','Weakness Exploit','Handicraft','Fire Attack','Water Attack','Thunder Attack','Ice Attack','Dragon Attack']).map(name=>db.skills.find(s=>s.name.en===name)?.id));
  targets.forEach(id=>allowed.add(+id));
  const decos=db.decorations.filter(d=>Object.keys(d.skills).some(id=>allowed.has(+id)));
  for(const slot of free.sort((a,b)=>a.level-b.level)) {
    let best=null;const current=tally(db,build.weapon,build.armor,build.charm,build.decorations);
    const currentStats=statistics(db,build.weapon,build.armor,current.levels,query.scenario);
    const valueOf=(levels,stats)=>targets.reduce((n,id)=>n*32+(levels[id]||0),0)*1e9+(query.priority==='defense'?stats.defense:stats.damage);
    let bestValue=valueOf(current.levels,currentStats);
    for(const d of decos)if(d.kind===slot.kind&&d.slot<=slot.level){
      const next=[...build.decorations,{slot:slot.key,decoration:d.id}];
      const totals=tally(db,build.weapon,build.armor,build.charm,next),stats=statistics(db,build.weapon,build.armor,totals.levels,query.scenario);
      const value=valueOf(totals.levels,stats);
      if(value>bestValue+1e-8){bestValue=value;best=d;}
    }
    if(best)build.decorations.push({slot:slot.key,decoration:best.id});
  }
}

export function createSearch(db,query,{checkpoint,onBuild}={}) {
  if(checkpoint&&(checkpoint.version!==SEARCH_VERSION||checkpoint.fingerprint!==datasetFingerprint(db)||JSON.stringify(checkpoint.query)!==JSON.stringify(query)))throw Error('This checkpoint is incompatible with the installed dataset or search engine.');
  if(!Object.keys(query.requirements).length)throw Error('Select at least one required skill');
  for(const [id,level] of Object.entries(query.requirements))if(!db.skillMap.has(+id)||!Number.isInteger(level)||level<1||level>db.skillMap.get(+id).max)throw Error('Invalid skill requirement');
  const requirements=query.requirements,requiredBonus=Object.keys(requirements).filter(id=>['set','group'].includes(db.skillMap.get(+id).kind));
  const lists=[weaponCandidates(db,query),...ARMOR_KINDS.map(k=>db.armor.filter(a=>a.kind===k&&(!query.rank||query.rank==='all'||a.rank===query.rank)).map(a=>armorVariant(a,query.transcended)))];
  const scores=lists.map(list=>{list.sort((a,b)=>scoreEquipment(db,b,query)-scoreEquipment(db,a,query));return list.map(e=>scoreEquipment(db,e,query));});
  const charms=charmCandidates(db,requirements,query.priority,query.scenario);
  const charmMax={};for(const c of charms)for(const [id,l] of Object.entries(c.skills))charmMax[id]=Math.max(charmMax[id]||0,l);
  const heap=new FairHeap(lists),visited=new Set(checkpoint?.visited||[]),results=checkpoint?.results||[],charmCache=new Map(),artianCache=new Map();
  const counts=checkpoint?.counts?{...checkpoint.counts}:{examined:0,feasible:0,invalid:0,started:Date.now(),elapsed:0};
  function enqueue(index){const key=index.join(',');if(visited.has(key))return;visited.add(key);heap.push({index,score:index.reduce((n,i,j)=>n+scores[j][i],0)});}
  if(checkpoint){heap.position=checkpoint.position;for(const [kind,values] of checkpoint.heaps){const h=new Heap();h.values=values;heap.heaps.set(kind,h);}}
  else if(lists.every(x=>x.length)&&bonusFeasible(db,lists,requirements,requiredBonus)){const seeded=new Set();lists[0].forEach((w,i)=>{if(!seeded.has(w.kind)){seeded.add(w.kind);enqueue([i,0,0,0,0,0]);}});}
  function complete(weapon,armor){
    const initial=tally(db,weapon,armor,null);
    if(requiredBonus.some(id=>(initial.levels[id]||0)<requirements[id]))return null;
    const baseSlots=slotsFor(weapon,armor,null);
    const normalIds=Object.keys(requirements).filter(id=>!requiredBonus.includes(id));
    // Optimistic single-skill bounds only reject provably impossible skeletons.
    for(const id of normalIds){
      const maxPerSlot=Math.max(0,...db.decorations.map(d=>d.skills[id]||0));
      if((initial.levels[id]||0)+(charmMax[id]||0)+(baseSlots.length+3)*maxPerSlot<requirements[id])return null;
    }
    const signature=normalIds.map(id=>Math.max(0,requirements[id]-(initial.levels[id]||0))).join(',')+'|'+baseSlots.map(s=>`${s.kind}:${s.level}`).sort().join(',');
    let witness=charmCache.get(signature);
    if(witness===false)return null;
    const options=witness?[witness]:charms;
    let charm,placements;
    for(const c of options){
      const levels={...initial.levels};add(levels,c.skills);
      const slots=slotsFor(weapon,armor,c);
      let impossible=false;
      for(const id of normalIds){const gap=requirements[id]-(levels[id]||0);if(gap<=0)continue;const capacity=slots.reduce((n,s)=>n+Math.max(0,...db.decorations.filter(d=>d.kind===s.kind&&d.slot<=s.level).map(d=>d.skills[id]||0)),0);if(gap>capacity){impossible=true;break;}}
      if(impossible)continue;
      const placed=placeDecorations(db,requirements,levels,slots);
      if(placed){charm=c;placements=placed;break;}
    }
    if(!charm){charmCache.set(signature,false);return null;}
    charmCache.set(signature,charm);
    const build={weapon,armor,charm,decorations:placements};
    let totals=tally(db,weapon,armor,charm,placements);
    if(weapon.family!=='crafted'){
      const cacheKey=weapon.searchId+'|'+Object.entries(totals.levels).sort().map(x=>x.join(':')).join(',');
      let optimized=artianCache.get(cacheKey);
      if(!optimized){optimized=optimizeArtian(db,weapon,armor,totals.levels,query.scenario,query.attribute);artianCache.set(cacheKey,optimized);}
      if(!optimized)return null;build.weapon=optimized;
    }
    const builds=[],keys=new Set(),base=structuredClone(build);
    const targets=(query.optionalSkills||[]).filter(id=>db.skillMap.has(+id)&&!['set','group'].includes(db.skillMap.get(+id).kind)).slice(0,5);
    const profiles=[[]];
    if(query.optionalVariants){for(let i=0;i<targets.length;i++)profiles.push([...targets.slice(i),...targets.slice(0,i)]);profiles.push(null,[...targets].reverse());}
    for(const profile of profiles.slice(0,Math.max(1,Math.min(8,query.variantLimit||8)))){
      const variant=structuredClone(base);
      if(profile)optionalDecorations(db,variant,query,profile);
      totals=tally(db,variant.weapon,armor,charm,variant.decorations);
      variant.levels=totals.levels;variant.points=totals.points;
      variant.stats=statistics(db,variant.weapon,armor,variant.levels,query.scenario);
      variant.rarity=armor.reduce((n,a)=>n+a.rarity,weapon.rarity+charm.rarity);
      const check=verifyBuild(db,variant,query);
      if(!check.valid){counts.invalid++;throw Error(`Result verification failed: ${check.errors.join('; ')}`);}
      variant.verified=true;variant.key=buildKey(variant);
      if(!keys.has(variant.key)){keys.add(variant.key);builds.push(variant);}
    }
    return builds;
  }
  return {
    step(milliseconds=100){
      const began=performance.now(),until=began+milliseconds;
      while(heap.length&&performance.now()<until){
        const {index}=heap.pop();counts.examined++;
        for(let axis=0;axis<index.length;axis++)if(index[axis]+1<lists[axis].length){const next=[...index];next[axis]++;enqueue(next);}
        const equipment=index.map((i,j)=>lists[j][i]);
        const builds=complete(equipment[0],equipment.slice(1));
        for(const build of builds||[]){
          counts.feasible++;onBuild?.(build);results.push(build);results.sort((a,b)=>compareBuilds(a,b,query.priority));if(results.length>query.limit)results.pop();
        }
      }
      counts.elapsed+=performance.now()-began;
      return {results:[...results],counts:{...counts,queued:heap.length},exhausted:!heap.length,candidateCounts:lists.map(x=>x.length)};
    },
    checkpoint(){return {version:SEARCH_VERSION,fingerprint:datasetFingerprint(db),query,counts:{...counts},results:[...results],visited:[...visited],position:heap.position,heaps:[...heap.heaps].map(([kind,h])=>[kind,h.values])};},
  };
}
