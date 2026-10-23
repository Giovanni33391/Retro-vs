// nes_audio.js - Web Audio API driver for NES APU samples
export class NesAudio {
  constructor(sampleRate = 44100) {
    this.sampleRate = sampleRate;
    this.audioCtx = null;
    this.bufferSize = 2048;
    this.buffer = new Float32Array(this.bufferSize * 2);
    this.writeIndex = 0;
    this.readIndex = 0;
    this.isMuted = false;
    this.isUnlocked = false;
  }

  unlock() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
      
      this.scriptNode = this.audioCtx.createScriptProcessor(this.bufferSize, 0, 2);
      this.scriptNode.onaudioprocess = (e) => {
        const outL = e.outputBuffer.getChannelData(0);
        const outR = e.outputBuffer.getChannelData(1);

        if (this.isMuted) {
          outL.fill(0);
          outR.fill(0);
          return;
        }

        for (let i = 0; i < this.bufferSize; i++) {
          if (this.readIndex !== this.writeIndex) {
            outL[i] = this.buffer[this.readIndex * 2];
            outR[i] = this.buffer[this.readIndex * 2 + 1];
            this.readIndex = (this.readIndex + 1) % this.bufferSize;
          } else {
            outL[i] = 0;
            outR[i] = 0;
          }
        }
      };

      this.scriptNode.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.isUnlocked = true;
  }

  writeSample(left, right) {
    if (!this.isUnlocked || this.isMuted) return;
    this.buffer[this.writeIndex * 2] = left;
    this.buffer[this.writeIndex * 2 + 1] = right;
    this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }
}
