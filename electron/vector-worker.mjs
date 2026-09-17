import { parentPort, workerData } from 'node:worker_threads';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { pipeline, env } from '@huggingface/transformers';
import { MODEL, MODEL_KEY, plainText, documentsFor, rankResults, rankTagResults } from './vector-core.mjs';
import { tagQuery } from '../shared/tags.mjs';

env.cacheDir = process.env.OINTEL_MODEL_CACHE || path.join(workerData.directory, 'models');
env.allowLocalModels = false;
const bundledModels = process.env.OINTEL_BUNDLED_MODELS;
if (bundledModels) {
  env.localModelPath = path.join(bundledModels, 'vectors') + path.sep;
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.useFSCache = false;
}
if (process.env.OINTEL_TEST_MODE === '1' && process.env.OINTEL_TEST_OFFLINE === '1') globalThis.fetch = async () => { throw new Error('Network disabled for packaged offline test'); };
const indexPath = path.join(workerData.directory, 'vector-index.json');
let cache = {};
let documents = [];
let extractor;
let latestWorkspace;
let busy = false;
let indexError;
const queries = [];
const status = data => parentPort.postMessage({ type: 'status', ...data });
try {
  const saved = JSON.parse(await readFile(indexPath, 'utf8'));
  if (saved.model === MODEL_KEY && saved.cache && typeof saved.cache === 'object') {
    cache = Object.fromEntries(Object.entries(saved.cache).filter(([, entry]) => Array.isArray(entry?.chunks) && entry.chunks.every(chunk =>
      typeof chunk.text === 'string' && Array.isArray(chunk.vector) && chunk.vector.length === 384 && chunk.vector.every(Number.isFinite))));
  }
} catch { /* The index is disposable; rebuild it from the original notes. */ }

async function model() {
  if (!extractor) {
    status({ state: 'loading', message: 'Preparing local search model…', progress: 0 });
    extractor = await pipeline('feature-extraction', MODEL, { dtype: 'q8', device: 'cpu',
      progress_callback: event => { if (event.status === 'progress') status({ state: 'loading', message: 'Downloading local search model…', progress: Math.round(event.progress || 0) }); },
    });
  }
  return extractor;
}
async function embed(text) {
  const pipe = await model();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
async function indexWorkspace(workspace) {
  const nextDocuments = documentsFor(workspace);
  const unique = [...new Map(nextDocuments.map(doc => [doc.key, doc])).values()];
  const missing = unique.filter(doc => !cache[doc.key]);
  const tagVectors = new Map(Object.values(cache).flatMap(entry => entry.chunks.filter(c => c.kind === 'tag').map(c => [c.tag, c.vector])));
  if (missing.length) await model();
  for (let i = 0; i < missing.length; i++) {
    const doc = missing[i];
    status({ state: 'indexing', message: `Vectorizing notes ${i + 1} of ${missing.length}`, progress: Math.round(i / missing.length * 100) });
    const chunks = [];
    if (doc.title.trim()) chunks.push({ text: doc.title, vector: await embed(doc.title) });
    for (const tag of doc.tags) {
      if (!tagVectors.has(tag)) tagVectors.set(tag, await embed(tag.replace(/[-_]/g, ' ')));
      chunks.push({ text: `#${tag}`, kind: 'tag', tag, vector: tagVectors.get(tag) });
    }
    const text = plainText(doc.body);
    if (text) {
      const encoded = await extractor.tokenizer(text, { add_special_tokens: false, truncation: false });
      const ids = Array.from(encoded.input_ids.data, Number);
      const titleTokens = await extractor.tokenizer(doc.title, { add_special_tokens: false });
      const prefix = extractor.tokenizer.decode(Array.from(titleTokens.input_ids.data, Number).slice(0, 32), { skip_special_tokens: true });
      // Token windows cover the entire note; overlap keeps context at boundaries.
      for (let start = 0; start < ids.length; start += 144) {
        const chunk = extractor.tokenizer.decode(ids.slice(start, start + 180), { skip_special_tokens: true });
        chunks.push({ text: chunk, vector: await embed(`${prefix}\n${chunk}`) });
        if (start + 180 >= ids.length) break;
      }
    }
    cache[doc.key] = { chunks };
  }
  documents = nextDocuments;
  const live = new Set(documents.map(doc => doc.key));
  cache = Object.fromEntries(Object.entries(cache).filter(([key]) => live.has(key)));
  await mkdir(workerData.directory, { recursive: true });
  await writeFile(`${indexPath}.tmp`, JSON.stringify({ model: MODEL_KEY, cache }));
  await rename(`${indexPath}.tmp`, indexPath);
  status({ state: 'ready', message: `${workspace.nodes.length} ideas vectorized`, progress: 100, count: workspace.nodes.length,
    chunks: Object.values(cache).reduce((sum, entry) => sum + entry.chunks.length, 0) });
}
async function drain() {
  if (busy) return;
  busy = true;
  try {
    while (latestWorkspace || queries.length) {
      if (latestWorkspace) {
        const workspace = latestWorkspace; latestWorkspace = undefined;
        try { await indexWorkspace(workspace); indexError = undefined; }
        catch (error) { indexError = error; status({ state: 'error', message: `Vector search unavailable: ${error.message}. ${bundledModels ? 'The bundled search model could not load. Reinstall the complete offline package, then retry.' : 'Check your connection for the first model download, then retry.'}` }); }
      } else {
        const query = queries.shift();
        try {
          if (indexError) throw indexError;
          const tag = tagQuery(query.text);
          const vector = await embed(tag ? tag.replace(/[-_]/g, ' ') : query.text);
          parentPort.postMessage({ type: 'result', id: query.id, results: tag
            ? rankTagResults(documents, cache, vector, tag) : rankResults(documents, cache, vector, query.includeHistory) });
        } catch (error) { parentPort.postMessage({ type: 'result', id: query.id, error: error.message }); }
      }
    }
  } finally { busy = false; }
}
parentPort.on('message', message => {
  if (message.type === 'sync') latestWorkspace = message.workspace;
  if (message.type === 'query') queries.push(message);
  void drain();
});
