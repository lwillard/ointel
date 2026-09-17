const { Worker } = require('node:worker_threads');
const path = require('node:path');
module.exports.createVectorService = (directory, onStatus) => {
  let worker;
  let stopped = false;
  let failed = false;
  let status = { state: 'idle', message: 'Preparing vector index…', progress: 0 };
  let latest;
  let timer;
  let nextId = 0;
  const pending = new Map();
  function startWorker() {
    failed = false;
    worker = new Worker(path.join(__dirname, 'vector-worker.mjs'), { workerData: { directory } });
    worker.on('message', message => {
    if (message.type === 'status') { status = message; onStatus(status); }
    if (message.type === 'result') {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timeout); pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error)); else request.resolve(message.results);
    }
  });
    worker.on('error', error => {
    failed = true;
    status = { state: 'error', message: error.message }; onStatus(status);
    for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(error); }
    pending.clear();
    });
    worker.on('exit', code => { if (!stopped && code !== 0 && !failed) {
      failed = true; status = { state: 'error', message: 'The local search worker stopped. Click Retry to restart it.' }; onStatus(status);
    } });
  }
  startWorker();
  const sync = () => { if (stopped) return; if (failed) startWorker(); if (latest) worker.postMessage({ type: 'sync', workspace: latest }); };
  return {
    status: () => status,
    sync(workspace) {
      latest = { nodes: workspace.nodes.map(({ id, title, body, tags, history }) => ({ id, title, body, tags, history })) };
      clearTimeout(timer); timer = setTimeout(sync, 1200);
    },
    retry: sync,
    search(text, includeHistory) {
      if (typeof text !== 'string' || text.length > 2000) throw new Error('Search query is too long.');
      if (!text.trim()) return Promise.resolve([]);
      clearTimeout(timer); sync();
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Search is taking longer than expected. Wait for indexing to finish and try again.')); }, 180000);
        pending.set(id, { resolve, reject, timeout });
        worker.postMessage({ type: 'query', id, text, includeHistory: !!includeHistory });
      });
    },
    stop: () => { stopped = true; clearTimeout(timer); for (const request of pending.values()) { clearTimeout(request.timeout); request.reject(new Error('Search closed.')); } pending.clear(); return worker.terminate(); },
  };
};
