import { indexData } from './equipment.js';
import { createSearch } from './solver.js';
import { compactBuild } from './search-record.js';
let db, search, running = false, timer, runId, archive = false, pending = [], sequence = 0, lastSaved = 0, awaiting = false, requests = [], exhausted = false;

function checkpoint(requestId) {
  if (!archive || !search) return;
  if (awaiting) { if (requestId) requests.push(requestId); return; }
  awaiting = ++sequence;
  lastSaved = Date.now();
  postMessage({ type: 'checkpoint', runId, requestId, sequence,
    records: pending.splice(0), checkpoint: search.checkpoint(), status: exhausted ? 'exhausted' : running ? 'running' : 'paused' });
}

function tick() {
  if (!running) return;
  try {
    const state = search.step(130);
    postMessage({ type: 'progress', runId, ...state });
    if (state.exhausted) {
      running = false;
      exhausted = true;
      checkpoint('final');
      postMessage({ type: 'done', runId });
    } else {
      if (Date.now() - lastSaved >= 5000) checkpoint();
      // Yield between batches so manual pause messages can be processed.
      // A batch boundary does not pause or limit the overall search.
      timer = setTimeout(tick, 0);
    }
  } catch (error) {
    running = false;
    search = null;
    postMessage({ type: 'error', runId, error: error.message });
  }
}

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      db = indexData(data.db);
      postMessage({ type: 'ready' });
    }
    if (data.type === 'search') {
      clearTimeout(timer);
      running = false;
      search = null;
      runId = data.runId;
      archive = !!data.archive;
      pending = []; sequence = data.sequence || 0; awaiting = false; requests = []; exhausted = false; lastSaved = Date.now();
      search = createSearch(db, data.query, { checkpoint: data.checkpoint, onBuild: archive ? build => pending.push(compactBuild(build,db)) : undefined });
      running = true;
      checkpoint('initial');
      tick();
    }
    if (data.type === 'pause' && running) {
      running = false;
      clearTimeout(timer);
      postMessage({ type: 'paused', runId });
      checkpoint('pause');
    }
    if (data.type === 'resume' && search && !running && !exhausted) {
      running = true;
      tick();
    }
    if (data.type === 'checkpoint') checkpoint(data.requestId);
    if (data.type === 'stored' && data.sequence === awaiting) {
      awaiting = false;
      if (requests.length) checkpoint(requests.shift());
    }
    if (data.type === 'storage-error' && data.sequence === awaiting) {
      running = false; clearTimeout(timer);
      postMessage({ type: 'paused', runId, reason: 'storageError', exhausted });
    }
  } catch (error) {
    postMessage({ type: 'error', runId, error: error.message });
  }
};
