import { it, expect } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ensureSpeechModels } from '../electron/speech-models.mjs';

it('fails clearly for missing or damaged bundled models without attempting a download', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ointel-offline-models-'));
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Network must not be used'); };
  try {
    await expect(ensureSpeechModels(directory, () => {}, { allowDownload: false })).rejects.toThrow('Bundled speech model encoder.onnx is missing or damaged');
    await writeFile(path.join(directory, 'encoder.onnx'), 'damaged');
    await expect(ensureSpeechModels(directory, () => {}, { allowDownload: false })).rejects.toThrow('Reinstall the complete offline package');
    expect(requests).toBe(0);
  } finally { globalThis.fetch = originalFetch; }
});
