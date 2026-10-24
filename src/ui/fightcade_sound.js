// fightcade_sound.js - Authentic Retro Arcade Audio Cues (Zero External Assets)
export class FightcadeSound {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  // Play a synthesized tone with frequency, type, duration, and gain envelope
  playTone(freq, type = 'square', duration = 0.1, gainVal = 0.15) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // AudioContext might be blocked until user gesture
    }
  }

  // Fightcade Challenge Alert: Ascending dual chime [C5, G5]
  playChallengeAlert() {
    if (this.isMuted) return;
    this.playTone(523.25, 'triangle', 0.12, 0.25); // C5
    setTimeout(() => {
      this.playTone(783.99, 'square', 0.25, 0.20); // G5
    }, 120);
  }

  // Fightcade Challenge Accepted: Classic Arcade Coin Arpeggio [B5, E6]
  playChallengeAccept() {
    if (this.isMuted) return;
    this.playTone(987.77, 'square', 0.08, 0.22); // B5
    setTimeout(() => {
      this.playTone(1318.51, 'square', 0.28, 0.25); // E6
    }, 80);
  }

  // Chat notification: Subtle soft blip
  playChatNotification() {
    if (this.isMuted) return;
    this.playTone(659.25, 'sine', 0.06, 0.08); // E5
  }

  // Countdown tick (3, 2, 1)
  playCountdownTick() {
    if (this.isMuted) return;
    this.playTone(440.00, 'square', 0.07, 0.18); // A4
  }

  // Countdown GO!
  playCountdownGo() {
    if (this.isMuted) return;
    this.playTone(880.00, 'triangle', 0.35, 0.28); // A5
  }
}

export const fcSound = new FightcadeSound();
