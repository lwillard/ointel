const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');

exports.createSpeechService = ({ directory, modelDirectory, fork, onStatus }) => {
  let worker, nextId = 0, ready = false, active = false, stopping, preparing, draft = null, message = 'Download the local speech models to get started.', error = '', progress = 0;
  let pendingAudio = 0, writeChain = Promise.resolve(), lastEnd = {}, initialized = false;
  const pending = new Map(), jobs = new Set();
  const draftPath = path.join(directory, 'live-meeting.json');
  const status = () => ({ ready, active, preparing: !!preparing, stopping: !!stopping, progress, pending: pendingAudio, message, error, draft, platform: process.platform, arch: process.arch });
  const emit = () => onStatus(status());
  async function load() {
    if (!initialized) {
      try { draft = JSON.parse(await fs.readFile(draftPath, 'utf8')); if (!Array.isArray(draft?.cues) || !draft.id) throw new Error('Invalid saved meeting draft.'); message = 'Recovered meeting draft. Review it before starting another call.'; }
      catch (e) { if (e.code !== 'ENOENT') { error = `Could not read the saved meeting draft: ${e.message}`; throw e; } }
      initialized = true;
    }
    return status();
  }
  function persist() {
    const value = JSON.stringify(draft);
    writeChain = writeChain.catch(() => {}).then(async () => {
      await fs.mkdir(directory, { recursive: true });
      if (value === 'null') await fs.rm(draftPath, { force: true });
      else { await fs.writeFile(draftPath + '.tmp', value); await fs.rename(draftPath + '.tmp', draftPath); }
    });
    return writeChain;
  }
  function fail(reason) {
    ready = false; active = false; error = reason; message = 'Capture stopped. Completed text remains in the draft.';
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error(reason)); }
    pending.clear(); emit();
  }
  function startWorker() {
    if (worker) return;
    const env = { ...process.env };
    if (process.platform === 'darwin') {
      const nativeDirectory = path.dirname(require.resolve(`sherpa-onnx-darwin-${process.arch}/package.json`)).replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep);
      env.DYLD_LIBRARY_PATH = nativeDirectory;
    }
    const child = fork(path.join(__dirname, 'speech-worker.cjs'), [], { serviceName: 'Ointel local speech', stdio: 'pipe', env, allowLoadingUnsignedLibraries: process.platform === 'darwin' });
    worker = child;
    child.stdout?.resume(); child.stderr?.resume();
    child.on('message', data => {
      if ('progress' in data) { progress = data.progress; message = progress < 100 ? `Downloading speech models · ${progress}%` : 'Loading local speech models…'; emit(); return; }
      const request = pending.get(data.id); if (!request) return;
      clearTimeout(request.timer); pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error)); else request.resolve(data.result);
    });
    child.on('exit', () => { if (worker === child) { worker = null; fail('The speech process stopped. Audio waiting for recognition was lost. Completed text is saved; prepare the models to retry.'); } });
  }
  function request(action, extra = {}) {
    startWorker(); const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { const child = worker; worker = null; fail('Local speech processing timed out. Capture stopped; completed text is saved.'); child?.kill(); }, action === 'prepare' ? 1200000 : 180000);
      pending.set(id, { resolve, reject, timer }); worker.postMessage({ id, action, ...extra });
    });
  }
  return {
    status: load,
    isActive: () => active,
    async prepare() {
      await load();
      if (ready) return status();
      if (preparing) { await preparing; return status(); }
      error = ''; message = 'Checking local speech models…';
      preparing = request('prepare', { directory: modelDirectory }); emit();
      try { await preparing; ready = true; message = 'Local speech models ready. English recognition.'; }
      catch (e) { error = e.message; throw e; }
      finally { preparing = null; emit(); }
      return status();
    },
    async start({ title, microphone }) {
      await load();
      if (!ready || active || stopping || preparing) throw new Error('Prepare speech models and finish the current session first.');
      if (draft) throw new Error('Add or discard the current draft before starting another call.');
      await request('reset');
      draft = { id: randomUUID(), title: typeof title === 'string' ? title.trim().slice(0, 160) || 'Live Zoom meeting' : 'Live Zoom meeting', date: new Date().toISOString(), cues: [], names: {}, microphone: !!microphone };
      lastEnd = {}; error = ''; message = 'Listening · text appears in short batches';
      await persist(); active = true; emit(); return status();
    },
    audio(chunk) {
      if (!active || stopping) return Promise.reject(new Error('The live session is not accepting audio.'));
      if (!chunk || !['system', 'mic'].includes(chunk.channel) || (chunk.channel === 'mic' && !draft.microphone) || !(chunk.samples instanceof Float32Array) || chunk.samples.length < 1 || chunk.samples.length > 240000 || !Number.isFinite(chunk.start) || chunk.start < 0 || chunk.start > 86400 || chunk.start + 0.01 < (lastEnd[chunk.channel] || 0) || chunk.samples.some(n => !Number.isFinite(n) || Math.abs(n) > 1.01)) return Promise.reject(new Error('Invalid audio chunk.'));
      if (pendingAudio >= 8) { active = false; error = 'Speech recognition fell behind. Capture stopped; the last audio chunk was not processed. Completed text is kept.'; emit(); return Promise.reject(new Error(error)); }
      lastEnd[chunk.channel] = chunk.start + chunk.samples.length / 16000;
      pendingAudio++; emit();
      const job = (async () => {
        try {
          const cues = await request('audio', { chunk });
          if (draft.cues.length + cues.length > 20000) throw new Error('Meeting draft reached 20,000 passages. Stop and add it to the map.');
          draft.cues.push(...cues); draft.cues.sort((a, b) => a.start - b.start);
          await persist();
        } catch (e) { active = false; error = e.message; throw e; }
        finally { pendingAudio--; emit(); }
      })();
      jobs.add(job); job.finally(() => jobs.delete(job)).catch(() => {}); return job;
    },
    async stop() {
      if (stopping) { await stopping; return status(); }
      active = false;
      stopping = Promise.allSettled([...jobs]); emit();
      try { await stopping; await writeChain; message = error ? 'Capture stopped. Review the partial draft.' : 'Capture stopped. Draft saved on this device.'; }
      finally { stopping = null; emit(); }
      return status();
    },
    async edit(patch) {
      await load(); if (!draft) throw new Error('No meeting draft.');
      if (patch.title !== undefined) { if (typeof patch.title !== 'string' || patch.title.length > 160) throw new Error('Invalid title.'); draft.title = patch.title; }
      if (patch.names !== undefined) {
        if (!patch.names || typeof patch.names !== 'object' || Object.keys(patch.names).length > 40 || Object.entries(patch.names).some(([k, v]) => k.length > 120 || typeof v !== 'string' || v.length > 120)) throw new Error('Invalid speaker names.');
        draft.names = { ...patch.names };
      }
      await persist(); emit(); return status();
    },
    async discard() {
      await load(); if (active || stopping || pendingAudio) throw new Error('Stop capturing before discarding the draft.');
      draft = null; error = ''; await persist(); emit(); return status();
    },
    async shutdown() { active = false; await writeChain; const child = worker; worker = null; child?.kill(); for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('Speech closed.')); } pending.clear(); },
  };
};
