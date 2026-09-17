const path = require('node:path');
// Loaded only in a dedicated process. Keep this ONNX runtime separate from vector search.
exports.createSpeechEngine = directory => {
  const sherpa = require('sherpa-onnx-node');
  const recognizer = new sherpa.OfflineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: { whisper: { encoder: path.join(directory, 'encoder.onnx'), decoder: path.join(directory, 'decoder.onnx'), language: 'en', task: 'transcribe' }, tokens: path.join(directory, 'tokens.txt'), numThreads: 2, provider: 'cpu', debug: false },
  });
  const embedding = { model: path.join(directory, 'speaker.onnx'), numThreads: 2, debug: false };
  const diarizer = new sherpa.OfflineSpeakerDiarization({ segmentation: { pyannote: { model: path.join(directory, 'segmentation.onnx') }, numThreads: 2 }, embedding, clustering: { numClusters: -1, threshold: 0.5 }, minDurationOn: 0.3, minDurationOff: 0.5 });
  const extractor = new sherpa.SpeakerEmbeddingExtractor(embedding);
  let voices = [];
  function identify(samples) {
    if (samples.length < 16000) return 'Unknown speaker';
    const stream = extractor.createStream();
    stream.acceptWaveform({ sampleRate: 16000, samples }); stream.inputFinished();
    if (!extractor.isReady(stream)) return 'Unknown speaker';
    // Electron's V8 memory cage forbids native external ArrayBuffers.
    const vector = Array.from(extractor.compute(stream, false));
    const norm = Math.hypot(...vector) || 1;
    for (let i = 0; i < vector.length; i++) vector[i] /= norm;
    const scores = voices.map(v => v.reduce((sum, n, i) => sum + n * vector[i], 0));
    const best = Math.max(-1, ...scores), index = scores.indexOf(best);
    if (best >= 0.6) return `Speaker ${index + 1}`;
    if (voices.length >= 30) return 'Unknown speaker';
    voices.push(vector); return `Speaker ${voices.length}`;
  }
  function transcribe(samples) {
    const stream = recognizer.createStream(); stream.acceptWaveform({ sampleRate: 16000, samples }); recognizer.decode(stream);
    return recognizer.getResult(stream).text.trim();
  }
  return {
    reset: () => { voices = []; },
    process({ samples, channel, start }) {
      // The segmentation model gates Whisper, which can hallucinate on silence.
      const segments = diarizer.process(samples);
      const names = new Map();
      for (const speaker of new Set(segments.map(s => s.speaker))) {
        const pieces = segments.filter(s => s.speaker === speaker).map(s => samples.slice(Math.round(s.start * 16000), Math.min(samples.length, Math.round(s.end * 16000))));
        const combined = new Float32Array(pieces.reduce((n, p) => n + p.length, 0));
        let offset = 0; for (const piece of pieces) { combined.set(piece, offset); offset += piece.length; }
        names.set(speaker, channel === 'mic' ? 'You' : identify(combined));
      }
      return segments.flatMap(segment => {
        const begin = Math.max(0, Math.round(segment.start * 16000)), end = Math.min(samples.length, Math.round(segment.end * 16000));
        if (end - begin < 4800) return [];
        const text = transcribe(samples.slice(Math.max(0, begin - 2400), Math.min(samples.length, end + 1600)));
        return text ? [{ speaker: names.get(segment.speaker), text, start: start + begin / 16000, end: start + end / 16000 }] : [];
      });
    },
  };
};
