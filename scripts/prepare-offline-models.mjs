import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, writeFile, stat, copyFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { ensureSpeechModels, speechModels } from '../electron/speech-models.mjs';

const root = path.resolve('build/offline-models');
const model = 'Xenova/all-MiniLM-L6-v2';
const revision = '751bff37182d3f1213fa05d7196b954e230abad9';
const vectors = [
  { name: 'config.json', size: 650, sha: '7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7' },
  { name: 'tokenizer_config.json', size: 366, sha: '9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3' },
  { name: 'tokenizer.json', size: 711661, sha: 'da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0' },
  { name: 'onnx/model_quantized.onnx', size: 22972370, sha: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1' },
];
async function digest(file) { const hash = createHash('sha256'); for await (const bytes of createReadStream(file)) hash.update(bytes); return hash.digest('hex'); }
async function valid(file, entry) { return (await stat(file).catch(() => null))?.size === entry.size && await digest(file) === entry.sha; }
for (const entry of vectors) {
  const file = path.join(root, 'vectors', model, entry.name);
  await mkdir(path.dirname(file), { recursive: true });
  if (!await valid(file, entry)) {
    const cached = path.resolve('.test-data/vectors/models', model, entry.name);
    if (await valid(cached, entry)) await copyFile(cached, file);
    else {
      const response = await fetch(`https://huggingface.co/${model}/resolve/${revision}/${entry.name}`, { signal: AbortSignal.timeout(600000) });
      if (!response.ok) throw new Error(`Search model download failed: ${response.status} ${entry.name}`);
      await writeFile(file + '.download', Buffer.from(await response.arrayBuffer()));
      if (!await valid(file + '.download', entry)) throw new Error(`Search model checksum mismatch: ${entry.name}`);
      await rename(file + '.download', file);
    }
  }
  console.log(`Verified search model: ${entry.name}`);
}
await mkdir(path.join(root, 'speech'), { recursive: true });
for (const entry of speechModels) {
  const cached = path.resolve('.test-data/speech/models', entry.name), file = path.join(root, 'speech', entry.name);
  if (!await valid(file, entry) && await valid(cached, entry)) await copyFile(cached, file);
}
await ensureSpeechModels(path.join(root, 'speech'), n => console.log(`Speech model preparation: ${n}%`));
const licenses = [
  ['Whisper-MIT.txt', 'https://raw.githubusercontent.com/openai/whisper/main/LICENSE'],
  ['Segmentation-MIT.txt', 'https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/LICENSE'],
  ['3D-Speaker-Apache-2.0.txt', 'https://raw.githubusercontent.com/modelscope/3D-Speaker/main/LICENSE'],
  ['Sherpa-ONNX-Apache-2.0.txt', 'https://raw.githubusercontent.com/k2-fsa/sherpa-onnx/master/LICENSE'],
  ['MiniLM-Apache-2.0.txt', 'https://www.apache.org/licenses/LICENSE-2.0.txt'],
  ['MiniLM-model-card.md', `https://huggingface.co/${model}/resolve/${revision}/README.md`],
];
await mkdir(path.join(root, 'licenses'), { recursive: true });
for (const [name, url] of licenses) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`License retrieval failed: ${name} (${response.status})`);
  await writeFile(path.join(root, 'licenses', name), await response.text());
}
await writeFile(path.join(root, 'MODEL-NOTICES.md'), await readFile('SPEECH-MODELS.md', 'utf8') + `\nBundled search model: ${model} (${revision}), Apache 2.0. See licenses/ for license texts.\n`);
await writeFile(path.join(root, 'manifest.json'), JSON.stringify({ vectors: vectors.map(e => ({ ...e, path: `vectors/${model}/${e.name}` })), speech: speechModels.map(e => ({ ...e, path: `speech/${e.name}` })) }, null, 2));
console.log('Offline model bundle prepared and verified.');
