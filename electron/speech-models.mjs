import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, rm, stat, open } from 'node:fs/promises';
import path from 'node:path';

const whisper = 'https://huggingface.co/csukuangfj/sherpa-onnx-whisper-tiny.en/resolve/d026532c022fa99fd789d6b32446a1df7b6bfc43/';
export const speechModels = [
  { name: 'encoder.onnx', url: whisper + 'tiny.en-encoder.int8.onnx', size: 12937772, sha: '0ce578b827c94a961aacb8fa14b02f096504b337e5c94be37c36238cbe3e8bc6' },
  { name: 'decoder.onnx', url: whisper + 'tiny.en-decoder.int8.onnx', size: 89853865, sha: '06c0e6ff6348d427e51839219d1c886c18cfdf411e629e33f5e1679bff9c1527' },
  { name: 'tokens.txt', url: whisper + 'tiny.en-tokens.txt', size: 835554, sha: '306cd27f03c1a714eca7108e03d66b7dc042abe8c258b44c199a7ed9838dd930' },
  { name: 'segmentation.onnx', url: 'https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/model.int8.onnx', size: 1540506, sha: 'd582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d' },
  { name: 'speaker.onnx', url: 'https://github.com/k2-fsa/sherpa-onnx/releases/download/speaker-recongition-models/3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx', size: 29596978, sha: '357a834f702b80161e5b981182c038e18553c1f2ca752ed6cec2052365d4129b' },
];
async function valid(file, model) {
  if ((await stat(file).catch(() => null))?.size !== model.size) return false;
  if (!model.sha) return true;
  const hash = createHash('sha256');
  for await (const data of createReadStream(file)) hash.update(data);
  return hash.digest('hex') === model.sha;
}
export async function ensureSpeechModels(directory, progress = () => {}) {
  await mkdir(directory, { recursive: true });
  const total = speechModels.reduce((n, m) => n + m.size, 0);
  let complete = 0;
  for (const model of speechModels) {
    const file = path.join(directory, model.name);
    if (!await valid(file, model)) {
      const temporary = file + '.download';
      const response = await fetch(model.url, { signal: AbortSignal.timeout(600000) });
      if (!response.ok || !response.body) throw new Error(`Model download failed (${response.status}). Retry when connected.`);
      const handle = await open(temporary, 'w');
      let received = 0, last = 0;
      try {
        for await (const data of response.body) {
          received += data.byteLength;
          if (received > model.size) throw new Error('Model download has an unexpected size.');
          await handle.write(data);
          if (Date.now() - last > 300) { last = Date.now(); progress(Math.round(100 * (complete + received) / total)); }
        }
      } finally { await handle.close(); }
      if (!await valid(temporary, model)) { await rm(temporary, { force: true }); throw new Error('Model verification failed. Please retry.'); }
      await rename(temporary, file);
    }
    complete += model.size;
    progress(Math.round(100 * complete / total));
  }
}
