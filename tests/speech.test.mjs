import { it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSpeechService } = require('../electron/speech-service.cjs');

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ointel-speech-'));
  const child = new EventEmitter(), audio = [];
  child.kill = () => child.emit('exit', 0);
  child.postMessage = msg => {
    if (msg.action === 'audio') audio.push(msg);
    else setImmediate(() => child.emit('message', { id: msg.id, result: true }));
  };
  const service = createSpeechService({ directory, modelDirectory: directory, fork: () => child, onStatus: () => {} });
  await service.prepare(); await service.start({ title: 'Test call', microphone: true });
  return { directory, child, audio, service, close: async () => { await service.shutdown(); await rm(directory, { recursive: true, force: true }); } };
}

it('drains in-flight audio on stop, saves chronological text and restores speaker names without audio', async () => {
  const f = await fixture();
  try {
    const a = f.service.audio({ channel: 'system', samples: new Float32Array(16000), start: 10 });
    const b = f.service.audio({ channel: 'mic', samples: new Float32Array(8000), start: 2 });
    let stopped = false; const stopping = f.service.stop().then(() => { stopped = true; });
    await new Promise(resolve => setImmediate(resolve)); expect(stopped).toBe(false);
    await expect(f.service.audio({ channel: 'system', samples: new Float32Array(1), start: 11 })).rejects.toThrow('not accepting');
    for (const msg of f.audio) f.child.emit('message', { id: msg.id, result: [{ text: 'A saved thought.', speaker: msg.chunk.channel === 'mic' ? 'You' : 'Speaker 1', start: msg.chunk.start, end: msg.chunk.start + 0.5 }] });
    await Promise.all([a, b, stopping]);
    await f.service.edit({ names: { 'Speaker 1': 'Alice' }, title: 'Recovered call' });
    const saved = await readFile(path.join(f.directory, 'live-meeting.json'), 'utf8');
    expect(saved).not.toContain('samples');
    const recovered = createSpeechService({ directory: f.directory, modelDirectory: '', fork: () => { throw new Error('Must not load model for recovery'); }, onStatus: () => {} });
    const status = await recovered.status();
    expect(status.active).toBe(false); expect(status.draft.cues.map(c => c.start)).toEqual([2, 10]);
    expect(status.draft.names['Speaker 1']).toBe('Alice'); expect(status.draft.title).toBe('Recovered call');
    await expect(f.service.start({ title: 'Replace?' })).rejects.toThrow('current draft');
  } finally { await f.close(); }
});

it('rejects oversized, invalid and out-of-order PCM and stops visibly when its queue fills', async () => {
  const f = await fixture();
  try {
    await expect(f.service.audio({ channel: 'system', start: 0, samples: new Float32Array(240001) })).rejects.toThrow('Invalid');
    await expect(f.service.audio({ channel: 'system', start: 0, samples: new Float32Array([NaN]) })).rejects.toThrow('Invalid');
    const jobs = [];
    for (let i = 0; i < 8; i++) jobs.push(f.service.audio({ channel: 'system', start: i, samples: new Float32Array(16000) }));
    await expect(f.service.audio({ channel: 'system', start: 0, samples: new Float32Array(16000) })).rejects.toThrow('Invalid');
    await expect(f.service.audio({ channel: 'system', start: 8, samples: new Float32Array(16000) })).rejects.toThrow('fell behind');
    expect((await f.service.status()).active).toBe(false);
    for (const msg of f.audio) f.child.emit('message', { id: msg.id, result: [] });
    await Promise.all(jobs); await f.service.stop();
    expect((await f.service.status()).error).toContain('last audio chunk');
  } finally { await f.close(); }
});

it('resamples stereo at 44.1/48 kHz, preserves timestamps and flushes the final partial frame', async () => {
  const source = await readFile('public/audio-capture-worklet.js', 'utf8');
  for (const rate of [16000, 44100, 48000]) {
    const messages = []; let Processor;
    const sandbox = { Float32Array, sampleRate: rate, currentFrame: 3200,
      AudioWorkletProcessor: class { constructor() { this.port = { postMessage: message => messages.push(message) }; } },
      registerProcessor: (_name, value) => { Processor = value; },
    };
    vm.runInNewContext(source, sandbox);
    const processor = new Processor();
    const length = Math.round(rate * 1.25), a = new Float32Array(length).fill(0.8), b = new Float32Array(length).fill(-0.2);
    processor.process([[a, b]]); processor.port.onmessage({ data: 'flush' });
    const frames = messages.filter(m => m.samples);
    expect(frames.map(m => m.samples.length)).toEqual([16000, 4000]);
    expect(frames[0].start).toBe(3200 / rate); expect(frames[1].start).toBe(3200 / rate + 1);
    expect(frames[1].samples[3999]).toBeCloseTo(0.3, 5);
    expect(messages.at(-1)).toEqual({ flushed: true }); expect(processor.process([[a]])).toBe(false);
  }
});
