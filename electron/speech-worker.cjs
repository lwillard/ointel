const { createSpeechEngine } = require('./speech-engine.cjs');
let engine;
let chain = Promise.resolve();
if (process.env.OINTEL_TEST_MODE === '1' && process.env.OINTEL_TEST_OFFLINE === '1') globalThis.fetch = async () => { throw new Error('Network disabled for packaged offline test'); };
process.parentPort.on('message', ({ data: message }) => {
  chain = chain.then(async () => {
    try {
      let result;
      if (message.action === 'prepare') {
        const { ensureSpeechModels } = await import('./speech-models.mjs');
        await ensureSpeechModels(message.directory, progress => process.parentPort.postMessage({ progress }), { allowDownload: !process.env.OINTEL_BUNDLED_MODELS });
        engine = createSpeechEngine(message.directory); result = true;
      } else if (!engine) throw new Error('Prepare local speech first.');
      else if (message.action === 'reset') engine.reset();
      else if (message.action === 'audio') result = engine.process(message.chunk);
      process.parentPort.postMessage({ id: message.id, result });
    } catch (error) { process.parentPort.postMessage({ id: message.id, error: error.message }); }
  });
});
