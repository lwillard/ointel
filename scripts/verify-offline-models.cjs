const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = async () => {
  const root = path.resolve('build/offline-models');
  const manifest = JSON.parse(await fs.promises.readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.vectors.length !== 4 || manifest.speech.length !== 5) throw new Error('Incomplete offline model manifest. Run npm run prepare:offline.');
  for (const entry of [...manifest.vectors, ...manifest.speech]) {
    const file = path.join(root, entry.path);
    if ((await fs.promises.stat(file)).size !== entry.size) throw new Error(`Wrong model size: ${entry.path}`);
    const hash = crypto.createHash('sha256');
    for await (const data of fs.createReadStream(file)) hash.update(data);
    if (hash.digest('hex') !== entry.sha) throw new Error(`Wrong model checksum: ${entry.path}`);
  }
  console.log('All nine offline model files verified before packaging.');
};
