import { Worker } from 'node:worker_threads';
import path from 'node:path';
import assert from 'node:assert/strict';
const directory = path.resolve(process.env.OINTEL_BUNDLED_MODELS ? `.test-data/offline-bundled-${Date.now()}` : '.test-data/vectors');
const entry = new URL('../electron/vector-worker.mjs', import.meta.url).href;
// Block every network fetch in this fresh worker, including model metadata requests.
const worker = new Worker(`globalThis.fetch = async () => { throw new Error('Network disabled for offline test'); }; import(${JSON.stringify(entry)});`, { eval: true, workerData: { directory } });
let started = false;
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Offline search timed out')), 90000);
    worker.on('error', reject);
    worker.on('message', message => {
      if (message.type === 'status' && message.state === 'error') { clearTimeout(timeout); reject(new Error(message.message)); }
      if (message.type === 'status' && message.state === 'ready' && !started) { started = true; worker.postMessage({ type: 'query', id: 1, text: 'growing produce on a sunny terrace' }); }
      if (message.type === 'result') {
        clearTimeout(timeout);
        try { if (message.error) throw new Error(message.error); assert.equal(message.results[0].nodeId, 'garden'); console.log('Offline model loading and semantic search passed with all network fetches blocked.'); resolve(); }
        catch (error) { reject(error); }
      }
    });
    worker.postMessage({ type: 'sync', workspace: { nodes: [{ id: 'garden', title: 'Urban gardening', body: 'Growing vegetables in small spaces. Tomatoes and herbs thrive in pots on a sunny balcony. Compost enriches the soil.', history: [] }] } });
  });
} finally { await worker.terminate(); }
