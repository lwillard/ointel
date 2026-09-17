if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  console.error('Build the Apple Silicon package on an Apple Silicon Mac, using an arm64 Node.js 22.12+ installation. Run npm ci on that Mac first; do not copy Windows node_modules.');
  process.exit(1);
}
require.resolve('sherpa-onnx-darwin-arm64/package.json');
console.log('Apple Silicon dependencies found. The packaged app will include macOS audio permission descriptions.');
