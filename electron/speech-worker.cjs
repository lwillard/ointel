const { createSpeechEngine } = require('./speech-engine.cjs');
let engine;
let chain = Promise.resolve();
process.parentPort.on('message', ({ data: message }) => {
  chain = chain.then(async () => {
    try {
      let result;
      if (message.action === 'prepare') {
        const { ensureSpeechModels } = await import('./speech-models.mjs');
        await ensureSpeechModels(message.directory, progress => process.parentPort.postMessage({ progress }));
        engine = createSpeechEngine(message.directory); result = true;
      } else if (!engine) throw new Error('Download speech models first.');
      else if (message.action === 'reset') engine.reset();
      else if (message.action === 'audio') result = engine.process(message.chunk);
      process.parentPort.postMessage({ id: message.id, result });
    } catch (error) { process.parentPort.postMessage({ id: message.id, error: error.message }); }
  });
});
