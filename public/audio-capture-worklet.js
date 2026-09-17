// Only PCM audio leaves this processor; the screen track is never read or encoded.
class OintelPCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(16000); this.offset = 0;
    this.weight = 0; this.sum = 0; this.start = null; this.sent = 0; this.done = false;
    this.port.onmessage = ({ data }) => {
      if (data === 'flush') { this.send(); this.done = true; this.port.postMessage({ flushed: true }); }
    };
  }
  send() {
    if (!this.offset) return;
    const samples = this.buffer.slice(0, this.offset);
    this.port.postMessage({ samples, start: this.start + this.sent / 16000 }, [samples.buffer]);
    this.sent += this.offset; this.offset = 0;
  }
  process(inputs) {
    if (this.done) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    if (this.start === null) this.start = currentFrame / sampleRate;
    const ratio = sampleRate / 16000;
    for (let i = 0; i < channels[0].length; i++) {
      const mono = channels.reduce((n, channel) => n + channel[i], 0) / channels.length;
      let remaining = 1;
      while (remaining > 1e-8) {
        const take = Math.min(remaining, ratio - this.weight);
        this.sum += mono * take; this.weight += take; remaining -= take;
        if (this.weight >= ratio - 1e-8) {
          this.buffer[this.offset++] = Math.max(-1, Math.min(1, this.sum / ratio));
          this.sum = 0; this.weight = 0;
          if (this.offset === 16000) this.send();
        }
      }
    }
    return true;
  }
}
registerProcessor('ointel-pcm', OintelPCM);
