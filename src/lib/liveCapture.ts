type Channel = 'system' | 'mic';
type Meter = (channel: Channel, level: number) => void;
let closeCapture: (() => Promise<void>) | null = null;
let opening: Promise<void> | null = null;
let cancelled = false;
export function isCapturing() { return !!closeCapture || !!opening; }
export async function stopLiveCapture() {
  cancelled = true;
  await opening?.catch(() => {});
  await closeCapture?.();
}
export async function startLiveCapture(microphone: boolean, onMeter: Meter, onError: (message: string) => void) {
  if (isCapturing()) throw new Error('A capture session is already open.');
  cancelled = false;
  opening = (async () => {
    const streams: MediaStream[] = [], processors: AudioWorkletNode[] = [], nodes: AudioNode[] = [];
    const work = new Set<Promise<void>>(), flushes = new Map<AudioWorkletNode, () => void>();
    const batches = new Map<Channel, { frames: Float32Array[]; length: number; start: number }>();
    let context: AudioContext | null = null, stopping: Promise<void> | null = null, closing = false;
    function submit(channel: Channel) {
      const batch = batches.get(channel); if (!batch?.length) return;
      const samples = new Float32Array(batch.length); let offset = 0;
      for (const frame of batch.frames) { samples.set(frame, offset); offset += frame.length; }
      batches.delete(channel);
      const promise = window.ointel!.speechAudio({ channel, samples, start: batch.start });
      work.add(promise);
      promise.catch(error => { onError(String(error.message || error)); if (!closing) void stopLiveCapture(); }).finally(() => work.delete(promise));
    }
    const close = async () => {
      if (stopping) return stopping;
      closing = true;
      stopping = (async () => {
        // Stop pulling new audio, then collect each worklet's final partial second.
        nodes.forEach(node => node.disconnect());
        streams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
        await Promise.all(processors.map(node => new Promise<void>(resolve => {
          const timer = setTimeout(() => { onError('Audio capture did not flush its final fraction of a second.'); resolve(); }, 2000);
          flushes.set(node, () => { clearTimeout(timer); resolve(); }); node.port.postMessage('flush');
        })));
        for (const channel of batches.keys()) submit(channel);
        processors.forEach(node => { node.disconnect(); node.port.close(); });
        await context?.close();
        await Promise.allSettled([...work]);
        await window.ointel!.speechStop();
        onMeter('system', 0); onMeter('mic', 0);
      })().finally(() => { closeCapture = null; });
      return stopping;
    };
    closeCapture = close;
    try {
      const system = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1, height: 1, frameRate: 1 }, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      streams.push(system);
      if (cancelled) return;
      if (!system.getAudioTracks().length) throw new Error('No system audio stream was provided. Enable system audio and screen recording for Ointel in macOS System Settings, then restart the app.');
      system.getVideoTracks().forEach(track => { track.enabled = false; });
      if (microphone) streams.push(await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }));
      if (cancelled) return;
      context = new AudioContext({ sampleRate: 16000 });
      await context.audioWorklet.addModule(new URL('audio-capture-worklet.js', document.baseURI).href);
      await context.resume();
      if (cancelled) return;
      for (let i = 0; i < streams.length; i++) {
        const channel: Channel = i === 0 ? 'system' : 'mic';
        const source = context.createMediaStreamSource(new MediaStream(streams[i].getAudioTracks()));
        const processor = new AudioWorkletNode(context, 'ointel-pcm');
        nodes.push(source); processors.push(processor);
        processor.port.onmessage = ({ data }) => {
          if (data.flushed) { flushes.get(processor)?.(); return; }
          const { samples, start } = data as { samples: Float32Array; start: number };
          const level = Math.sqrt(samples.reduce((n, v) => n + v * v, 0) / samples.length);
          onMeter(channel, level);
          let batch = batches.get(channel);
          if (!batch) { batch = { frames: [], length: 0, start }; batches.set(channel, batch); }
          batch.frames.push(samples); batch.length += samples.length;
          if (batch.length >= 192000 || (batch.length >= 128000 && level < 0.006)) submit(channel);
        };
        processor.onprocessorerror = () => { onError('The audio processor stopped. Capture is ending; completed text is saved.'); void stopLiveCapture(); };
        source.connect(processor); processor.connect(context.destination); // Worklet output is silence.
      }
      for (const stream of streams) for (const track of stream.getTracks()) track.onended = () => {
        if (!closing) { onError('An audio source disconnected. Capture stopped; completed text is saved.'); void stopLiveCapture(); }
      };
    } catch (error) { await close(); throw error; }
    finally { if (cancelled && !stopping) await close(); }
  })();
  try { await opening; } finally { opening = null; }
}
