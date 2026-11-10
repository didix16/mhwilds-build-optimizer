import { indexData } from './equipment.js';
import { createSearch } from './solver.js';
let db, search, running = false, timer, runId;

function tick() {
  if (!running) return;
  try {
    const state = search.step(130);
    postMessage({ type: 'progress', runId, ...state });
    if (state.exhausted) {
      running = false;
      search = null;
      postMessage({ type: 'done', runId });
    } else {
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
      search = createSearch(db, data.query);
      running = true;
      tick();
    }
    if (data.type === 'pause' && running) {
      running = false;
      clearTimeout(timer);
      postMessage({ type: 'paused', runId });
    }
    if (data.type === 'resume' && search && !running) {
      running = true;
      tick();
    }
  } catch (error) {
    postMessage({ type: 'error', runId, error: error.message });
  }
};
