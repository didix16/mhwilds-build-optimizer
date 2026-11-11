import { indexData,WEAPON_TYPES } from '../engine/equipment.js';
import { reportRecord } from '../archive/records.js';
import { filterReport } from './filter.js';
import { reportClient } from './client.js';

export const safeJSON=value=>JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const css=`:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0b111b;color:#e7edf5}*{box-sizing:border-box}body{margin:0}#report{max-width:1600px;margin:auto;padding:24px}header{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:16px 0}header h1{width:100%;margin:0}header small{color:#67e8f9;letter-spacing:.2em}header p{flex:1}h2{font-size:1.15rem}h3{margin-top:0}h4{margin-bottom:10px}p{line-height:1.6;overflow-wrap:anywhere}.panel{background:#131c29;border:1px solid #2a394b;border-radius:12px;padding:20px;margin-bottom:16px}.muted{color:#a1afc1;font-size:.88rem}.layout{display:grid;grid-template-columns:300px minmax(0,1fr);gap:22px}.filters{align-self:start}.field{display:flex;flex-direction:column;gap:6px;margin:12px 0;font-size:.88rem}.field>span{color:#bbc8d8}input,select,button{font:inherit;max-width:100%;border:1px solid #3d4e65;border-radius:7px;padding:9px;background:#0c1522;color:#eef5ff}select[multiple]{min-height:110px}input[type=checkbox]{align-self:start;width:20px;height:20px;accent-color:#22d3ee}button{cursor:pointer;border-color:#219cb3;color:#8ae8f6}button:hover{background:#173448}button:disabled{opacity:.4;cursor:default}summary{cursor:pointer;line-height:1.6;padding:8px 0}details>details{margin-left:10px}.skill-picker{display:flex;gap:5px;flex-wrap:wrap}.skill-picker select{width:100%}.skill-picker input{width:70px}.chip{display:flex;align-items:center;justify-content:space-between;font-size:.85rem;padding:6px 0;gap:5px}.chip button{padding:2px 8px}.toolbar,.stats{display:flex;align-items:center;flex-wrap:wrap;gap:14px}.toolbar{margin-bottom:18px}.toolbar .field{margin:0}.toolbar h2{margin-right:auto}.stats span{padding:6px 9px;background:#0a1421;border-radius:6px;font-size:.9rem}.build-details{border-top:1px solid #293b4f;margin-top:15px;padding-top:5px}.gear{padding:12px 0;border-bottom:1px solid #283547}.gear strong{display:block;font-size:.93rem}.gear small{display:block;color:#a1b7cb;margin-top:6px}.skill-list{margin:18px 0}.skill-list details{border-bottom:1px solid #283547}.sharpness{display:flex;max-width:500px;height:22px;border:1px solid #718096}.sharpness span{font-size:11px;text-align:center;color:#080d13;min-width:1px;overflow:hidden}@media(max-width:850px){#report{padding:14px}.layout{grid-template-columns:1fr}.panel{padding:16px}.toolbar{gap:10px}.toolbar h2{width:100%}header .field{width:100%}}@media print{.filters,.toolbar button{display:none}.layout{display:block}.panel{break-inside:avoid}}`;
export async function createReportBlob(store,run,{language='en',onProgress=()=>{}}={}) {
  const catalog=await store.catalog(run.fingerprint);
  if(!catalog)throw Error('The archived dataset is missing.');
  const db=indexData(catalog),chunks=[`<!doctype html><html lang="${language==='es'?'es':'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wilds Forge</title><style>${css}</style></head><body><main id="report"></main><noscript>Enable JavaScript to filter this local report. Activa JavaScript para filtrar este informe local.</noscript><script type="application/json" id="report-data">{"builds":[`];
  let count=0;
  for await(const rows of store.records(run.id,run.sequence)){
    chunks.push((count?',':'')+rows.map(row=>safeJSON(reportRecord(db,row,run.query))).join(','));count+=rows.length;onProgress(count,run.resultCount);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(count!==run.resultCount)throw Error('The report snapshot is incomplete.');
  // Exclude combat configuration from the exported metadata entirely.
  const {scenario,...query}=run.query;
  chunks.push(`],"catalog":${safeJSON(catalog)},"types":${safeJSON(WEAPON_TYPES)},"meta":${safeJSON({...run,query,language,exportedAt:Date.now()})}}</script><script>(${reportClient.toString()})(JSON.parse(document.getElementById('report-data').textContent),${filterReport.toString()});</script></body></html>`);
  return new Blob(chunks,{type:'text/html;charset=utf-8'});
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
