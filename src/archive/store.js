import { openDB } from 'idb';

export function createArchiveStore(name = 'wilds-forge-searches') {
  let connection;
  const open = () => connection ||= openDB(name, 1, { upgrade(db) {
    db.createObjectStore('runs', { keyPath: 'id' });
    db.createObjectStore('checkpoints', { keyPath: 'runId' });
    db.createObjectStore('datasets');
    const builds = db.createObjectStore('builds', { keyPath: ['runId', 'key'] });
    builds.createIndex('sequence', ['runId', 'sequence', 'key']);
  } });
  return {
    async create(run, catalog) {
      const db = await open(), tx = db.transaction(['runs','datasets'],'readwrite');
      if(catalog&&!await tx.objectStore('datasets').getKey(run.fingerprint))await tx.objectStore('datasets').put(catalog,run.fingerprint);
      await tx.objectStore('runs').add({ ...run, resultCount: 0, sequence: 0 }); await tx.done;
    },
    async catalog(fingerprint) { const db=await open(); return db.get('datasets',fingerprint); },
    async list() { const db = await open(); return (await db.getAll('runs')).sort((a,b)=>b.updatedAt-a.updatedAt); },
    async get(id) { const db = await open(); return db.get('runs', id); },
    async checkpoint(id) { const db = await open(); return (await db.get('checkpoints', id))?.checkpoint; },
    async claim(id,owner,sequence) {
      const db=await open(),tx=db.transaction('runs','readwrite'),run=await tx.store.get(id);
      if(!run||run.sequence!==sequence){tx.abort();await tx.done.catch(()=>{});throw Error('The saved search changed in another tab. Refresh the search archive.');}
      const next={...run,owner};await tx.store.put(next);await tx.done;return next;
    },
    async save(id, payload) {
      const db = await open(), tx = db.transaction(['runs','builds','checkpoints'], 'readwrite', {durability:'strict'});
      try {
        const run = await tx.objectStore('runs').get(id);
        if (!run) throw Error('Search archive was deleted.');
        if (run.owner && run.owner !== payload.owner) throw Error('This search was resumed in another tab. Its newer checkpoint is protected.');
        if (payload.sequence <= run.sequence) { await tx.done; return run; }
        if (payload.sequence !== run.sequence + 1) throw Error('Search archive sequence mismatch.');
        let added = 0;
        const builds = tx.objectStore('builds');
        for (const record of payload.records) {
          if (!await builds.getKey([id, record.key])) { await builds.add({ ...record, runId: id, sequence: payload.sequence }); added++; }
        }
        const next = { ...run, resultCount: run.resultCount + added, sequence: payload.sequence,
          counts: payload.checkpoint.counts, status: payload.status, updatedAt: Date.now() };
        await tx.objectStore('checkpoints').put({ runId: id, checkpoint: payload.checkpoint });
        await tx.objectStore('runs').put(next);
        await tx.done;
        return next;
      } catch (error) { try { tx.abort(); } catch {} await tx.done.catch(()=>{}); throw error; }
    },
    async *records(id, sequence, size = 500) {
      const db = await open(); let lower = [id,0,''], exclusive = false;
      while (true) {
        const rows = await db.getAllFromIndex('builds', 'sequence', IDBKeyRange.bound(lower, [id,sequence,'\uffff'], exclusive), size);
        if (!rows.length) return;
        yield rows;
        const last = rows.at(-1); lower = [id,last.sequence,last.key]; exclusive = true;
      }
    },
    async remove(id) {
      const db = await open(), tx = db.transaction(['runs','builds','checkpoints','datasets'],'readwrite');
      const run=await tx.objectStore('runs').get(id);
      let cursor = await tx.objectStore('builds').index('sequence').openCursor(IDBKeyRange.bound([id,0,''],[id,Number.MAX_SAFE_INTEGER,'\uffff']));
      while(cursor) { await cursor.delete(); cursor = await cursor.continue(); }
      await tx.objectStore('runs').delete(id); await tx.objectStore('checkpoints').delete(id);
      if(run&&!(await tx.objectStore('runs').getAll()).some(r=>r.fingerprint===run.fingerprint))await tx.objectStore('datasets').delete(run.fingerprint);
      await tx.done;
    },
    async close() { if(connection) (await connection).close(); connection = undefined; },
  };
}
const scope=typeof location==='undefined'?'':new URL(import.meta.env?.BASE_URL||'./',location.href).pathname;
export const archives = createArchiveStore(`wilds-forge-searches:${scope}`);
