import { Worker } from 'node:worker_threads';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const directory = path.resolve('.test-data/vectors');
await mkdir(directory, { recursive: true });
const worker = new Worker(new URL('../electron/vector-worker.mjs', import.meta.url), { workerData: { directory } });
const nodes = [
  { id: 'garden', title: 'Urban gardening', body: 'Growing vegetables in small spaces. Tomatoes and herbs thrive in pots on a sunny balcony. Compost enriches the soil.', history: [] },
  { id: 'software', title: 'Application architecture', body: 'Design software using modular components and clear interfaces. Automated tests catch regressions.', history: [] },
  { id: 'rest', title: 'Rest and recovery', body: 'Sleep gives your mind and body time to recover. A consistent bedtime and a quiet bedroom help you recharge.', history: [{ id: 'old', title: 'Evening ritual', body: 'Meditation and calm breathing release stress before going to bed.' }] },
  { id: 'long', title: 'A long journal', body: 'Today was an ordinary workday full of meetings and emails. '.repeat(100) + 'At the end of this entry: telescopes observe distant galaxies, planets, and stars. Astronomers explore the universe through astrophysics and cosmology.', history: [] },
];
let phase = 0;
const finished = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Vector integration timed out')), 240000);
  worker.on('error', reject);
  worker.on('message', async message => {
    try {
      if (message.type === 'status') {
        if (message.state !== 'loading' || message.progress % 25 === 0) console.log(message.message, message.progress || '');
        if (message.state === 'error') throw new Error(message.message);
        if (message.state === 'ready' && phase === 0) { phase = 1; worker.postMessage({ type: 'query', id: 1, text: 'How can I raise food on my apartment terrace?' }); }
      }
      if (message.type === 'result') {
        if (message.error) throw new Error(message.error);
        console.log('Query', message.id, JSON.stringify(message.results.map(r => ({ id: r.nodeId, score: r.score.toFixed(3), revision: r.revisionId }))));
        if (message.id === 1) { assert.equal(message.results[0].nodeId, 'garden'); worker.postMessage({ type: 'query', id: 2, text: 'outer space astronomy universe planets' }); }
        if (message.id === 2) { assert.equal(message.results[0].nodeId, 'long'); worker.postMessage({ type: 'query', id: 3, text: 'meditation breathing stress', includeHistory: true }); }
        if (message.id === 3) { assert.equal(message.results[0].revisionId, 'old');
          const saved = JSON.parse(await readFile(path.join(directory, 'vector-index.json'), 'utf8'));
          assert(Object.values(saved.cache).every(entry => entry.chunks.every(c => c.vector.length === 384)));
          clearTimeout(timeout); resolve();
        }
      }
    } catch (error) { clearTimeout(timeout); reject(error); }
  });
});
worker.postMessage({ type: 'sync', workspace: { nodes } });
try { await finished; console.log('Real local embedding integration passed.'); }
finally { await worker.terminate(); }
