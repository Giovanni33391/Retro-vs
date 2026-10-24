// nes_audio.js - High-Fidelity Audio Driver with AudioWorklet & Fallback Buffer
// Eliminates stutter, clicks, buffer underruns, and sample rate mismatch

const WORKLET_PROCESSOR_CODE = `
class NESAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Capacity of ~170ms of audio (8192 samples stereo)
    this.capacity = 8192;
    this.bufferL = new Float32Array(this.capacity);
    this.bufferR = new Float32Array(this.capacity);
    this.readPos = 0;
    this.writePos = 0;
    this.count = 0;

    this.port.onmessage = (e) => {
      if (e.data.type === "samples") {
        const left = e.data.left;
        const right = e.data.right;
        const len = left.length;

        // If adding these samples would overflow, drop oldest to avoid stutter
        if (this.count + len > this.capacity) {
          const drop = this.count + len - this.capacity;
          this.readPos = (this.readPos + drop) % this.capacity;
          this.count -= drop;
        }

        for (let i = 0; i < len; i++) {
          this.bufferL[this.writePos] = left[i];
          this.bufferR[this.writePos] = right[i];
          this.writePos = (this.writePos + 1) % this.capacity;
        }
        this.count += len;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length < 2) return true;

    const outL = output[0];
    const outR = output[1];
    const size = outL.length;

    if (this.count < size) {
      for (let i = 0; i < this.count; i++) {
        outL[i] = this.bufferL[this.readPos];
        outR[i] = this.bufferR[this.readPos];
        this.readPos = (this.readPos + 1) % this.capacity;
      }
      for (let i = this.count; i < size; i++) {
        outL[i] = 0;
        outR[i] = 0;
      }
      this.count = 0;
    } else {
      for (let i = 0; i < size; i++) {
        outL[i] = this.bufferL[this.readPos];
        outR[i] = this.bufferR[this.readPos];
        this.readPos = (this.readPos + 1) % this.capacity;
      }
      this.count -= size;
    }

    return true;
  }
}
registerProcessor("nes-audio-processor", NESAudioProcessor);
`;

const BATCH_SIZE = 128;

export class NesAudio {
  constructor(preferredSampleRate = 48000) {
    this.preferredSampleRate = preferredSampleRate;
    this.audioCtx = null;
    this.workletNode = null;
    this.scriptNode = null;
    this.isMuted = false;
    this.isUnlocked = false;

    // Batching buffers for low MessagePort overhead
    this.batchL = new Float32Array(BATCH_SIZE);
    this.batchR = new Float32Array(BATCH_SIZE);
    this.batchPos = 0;

    // Fallback circular buffer for ScriptProcessorNode
    this.fallbackCapacity = 8192;
    this.fallbackBufferL = new Float32Array(this.fallbackCapacity);
    this.fallbackBufferR = new Float32Array(this.fallbackCapacity);
    this.fallbackRead = 0;
    this.fallbackWrite = 0;
    this.fallbackCount = 0;
  }

  getSampleRate() {
    if (this.audioCtx) {
      return this.audioCtx.sampleRate;
    }
    return this.preferredSampleRate;
  }

  unlock() {
    if (this.isUnlocked) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }

    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.audioCtx = new AudioCtx();
    } catch (e) {
      console.warn('AudioContext creation failed:', e);
      return;
    }

    // Try AudioWorklet first
    if (this.audioCtx.audioWorklet) {
      try {
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: "application/javascript" });
        const workletUrl = URL.createObjectURL(blob);
        this.audioCtx.audioWorklet.addModule(workletUrl).then(() => {
          URL.revokeObjectURL(workletUrl);
          if (!this.audioCtx) return;
          this.workletNode = new AudioWorkletNode(this.audioCtx, "nes-audio-processor", {
            outputChannelCount: [2]
          });
          this.workletNode.connect(this.audioCtx.destination);
        }).catch((err) => {
          console.warn('AudioWorklet module failed, falling back to ScriptProcessor:', err);
          this.setupScriptProcessor();
        });
      } catch (err) {
        this.setupScriptProcessor();
      }
    } else {
      this.setupScriptProcessor();
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    this.isUnlocked = true;
  }

  setupScriptProcessor() {
    if (!this.audioCtx || this.scriptNode) return;
    const bufferSize = 2048;
    this.scriptNode = this.audioCtx.createScriptProcessor(bufferSize, 0, 2);

    this.scriptNode.onaudioprocess = (e) => {
      const outL = e.outputBuffer.getChannelData(0);
      const outR = e.outputBuffer.getChannelData(1);
      const size = outL.length;

      if (this.isMuted || this.fallbackCount === 0) {
        outL.fill(0);
        outR.fill(0);
        return;
      }

      const toRead = Math.min(size, this.fallbackCount);
      for (let i = 0; i < toRead; i++) {
        outL[i] = this.fallbackBufferL[this.fallbackRead];
        outR[i] = this.fallbackBufferR[this.fallbackRead];
        this.fallbackRead = (this.fallbackRead + 1) % this.fallbackCapacity;
      }
      for (let i = toRead; i < size; i++) {
        outL[i] = 0;
        outR[i] = 0;
      }
      this.fallbackCount -= toRead;
    };

    this.scriptNode.connect(this.audioCtx.destination);
  }

  writeSample(left, right) {
    if (!this.isUnlocked || this.isMuted) return;

    if (this.workletNode) {
      this.batchL[this.batchPos] = left;
      this.batchR[this.batchPos] = right;
      this.batchPos++;

      if (this.batchPos >= BATCH_SIZE) {
        this.workletNode.port.postMessage({
          type: "samples",
          left: this.batchL.slice(),
          right: this.batchR.slice()
        });
        this.batchPos = 0;
      }
    } else if (this.scriptNode) {
      // Fallback ring buffer with drop oldest
      if (this.fallbackCount >= this.fallbackCapacity) {
        this.fallbackRead = (this.fallbackRead + 1) % this.fallbackCapacity;
        this.fallbackCount--;
      }
      this.fallbackBufferL[this.fallbackWrite] = left;
      this.fallbackBufferR[this.fallbackWrite] = right;
      this.fallbackWrite = (this.fallbackWrite + 1) % this.fallbackCapacity;
      this.fallbackCount++;
    }
  }

  // Flush partial batch at end of frame
  flush() {
    if (this.batchPos > 0 && this.workletNode) {
      this.workletNode.port.postMessage({
        type: "samples",
        left: this.batchL.slice(0, this.batchPos),
        right: this.batchR.slice(0, this.batchPos)
      });
      this.batchPos = 0;
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.batchPos = 0;
      this.fallbackCount = 0;
    }
    return this.isMuted;
  }
}
