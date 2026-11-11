import { ARMOR_KINDS,add,armorVariant,slotsFor,tally,hasAttribute } from './equipment.js';
import { GOGMA_SETS,GOGMA_GROUPS,optimizeArtian } from './artian.js';
import { charmCandidates } from './decorations.js';
import { statistics } from './damage.js';
import { verifyBuild } from './verify.js';
import { SEARCH_VERSION,datasetFingerprint,buildKey } from './search-record.js';
import {createDecorationSolver} from './decoration-solver.js';
import {prepareCharms} from './feasibility.js';
import {createTraversal} from './traversal.js';

export function compareBuilds(a,b,priority) {
  if(priority==='damage')return b.stats.damage-a.stats.damage||b.stats.defense-a.stats.defense||b.rarity-a.rarity;
  return b.stats.defense-a.stats.defense||b.rarity-a.rarity||b.stats.damage-a.stats.damage;
}
function bonusFeasible(db,lists,requirements,ids){
  if(!ids.length)return true;
  const targets=ids.map(id=>db.skillMap.get(+id).ranks.find(r=>r.level===requirements[id]).points);
  for(const kind of ['set','group']){
    const indices=ids.map((_,i)=>i).filter(i=>db.skillMap.get(+ids[i]).kind===kind);
    const needed=indices.reduce((sum,i)=>sum+targets[i],0);
    const possible=lists.reduce((sum,list)=>sum+Math.max(0,...list.map(e=>indices.reduce((n,i)=>n+(e.bonuses[ids[i]]||0),0))),0);
    if(needed>possible)return false;
  }
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
  for(const list of lists)list.sort((a,b)=>scoreEquipment(db,b,query)-scoreEquipment(db,a,query));
  const charms=charmCandidates(db,requirements,query.priority,query.scenario);
  const decoSolver=createDecorationSolver(db,requirements),charmPlans=prepareCharms(db,lists,requirements,charms,decoSolver);
  const originalWeapons=lists[0].length;
  lists[0]=lists[0].filter(w=>charmPlans.forWeapon(w).length);
  const hasPools=lists.every(x=>x.length),bonusPossible=hasPools&&bonusFeasible(db,lists,requirements,requiredBonus);
  const reason=originalWeapons&&!lists[0].length&&charmPlans.hasWeaponRequirements?'weaponSkillConflict':hasPools&&!bonusPossible?'bonusSkillConflict':null;
  const globallyFeasible=hasPools&&bonusPossible;
  const bonusTargets=Object.fromEntries(requiredBonus.map(id=>[id,db.skillMap.get(+id).ranks.find(r=>r.level===requirements[id]).points]));
  const traversal=createTraversal([globallyFeasible?lists[0]:[],...lists.slice(1)],query,decoSolver,bonusTargets,charms,checkpoint?.traversal);
  const results=checkpoint?.results||[],charmCache=new Map(),artianCache=new Map();
  const counts=checkpoint?.counts?{...checkpoint.counts}:{examined:0,feasible:0,invalid:0,charmChecks:0,decorationChecks:0,started:Date.now(),elapsed:0};
  const cachePut=(map,key,value)=>{if(map.size>=10000)map.delete(map.keys().next().value);map.set(key,value);};
  function complete(weapon,armor){
    const initial=tally(db,weapon,armor,null);
    if(requiredBonus.some(id=>(initial.levels[id]||0)<requirements[id]))return null;
    const baseSlots=slotsFor(weapon,armor,null);
    const gaps=decoSolver.gapsFor(initial.levels),slotCounts=decoSolver.countsFor(baseSlots);
    const signature=gaps.join(',')+'|'+slotCounts.join(',');
    let witness=charmCache.get(signature);
    if(witness===false)return null;
    const options=witness?[witness]:charmPlans.forWeapon(weapon);
    let charm,placements;
    for(const plan of options){
      counts.charmChecks++;
      const nextGaps=gaps.map((v,i)=>Math.max(0,v-plan.levels[i])),available=slotCounts.map((v,b)=>v+plan.counts[b]);
      if(!decoSolver.canFit(nextGaps,available))continue;
      const levels={...initial.levels};add(levels,plan.charm.skills);
      counts.decorationChecks++;
      const placed=decoSolver.place(levels,[...baseSlots,...plan.slots]);
      if(placed){charm=plan.charm;placements=placed;witness=plan;break;}
    }
    if(!charm){cachePut(charmCache,signature,false);return null;}
    cachePut(charmCache,signature,witness);
    const build={weapon,armor,charm,decorations:placements};
    let totals=tally(db,weapon,armor,charm,placements);
    if(weapon.family!=='crafted'){
      const cacheKey=weapon.searchId+'|'+Object.entries(totals.levels).sort().map(x=>x.join(':')).join(',');
      let optimized=artianCache.get(cacheKey);
      if(!optimized){optimized=optimizeArtian(db,weapon,armor,totals.levels,query.scenario,query.attribute);cachePut(artianCache,cacheKey,optimized);}
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
      while(traversal.active&&performance.now()<until){
        const index=traversal.next();if(!index)continue;
        counts.examined++;
        const equipment=index.map((i,j)=>lists[j][i]);
        const builds=complete(equipment[0],equipment.slice(1));
        for(const build of builds||[]){
          counts.feasible++;onBuild?.(build);results.push(build);results.sort((a,b)=>compareBuilds(a,b,query.priority));if(results.length>query.limit)results.pop();
        }
      }
      counts.elapsed+=performance.now()-began;
      return {results:[...results],counts:{...counts,...traversal.counts,queued:traversal.queued},exhausted:!traversal.active,candidateCounts:lists.map(x=>x.length),reason};
    },
    checkpoint(){return {version:SEARCH_VERSION,fingerprint:datasetFingerprint(db),query,counts:{...counts,...traversal.counts},results:[...results],traversal:traversal.snapshot()};},
  };
}
