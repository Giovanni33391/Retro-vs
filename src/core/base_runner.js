// base_runner.js - Abstract Base Runner for Retro Speedrun Systems (NES, SNES, Genesis)

export class BaseRunner {
  constructor(options = {}) {
    this.gameId = options.gameId || 'smb1';
    this.isMuted = options.isMuted || false;
    this.audioHandler = options.audioHandler || null;
    this.onFrameCallback = options.onFrame || null;

    this.width = options.width || 256;
    this.height = options.height || 240;
    this.frameBuffer = new Uint32Array(this.width * this.height);
    this.frameCounter = 0;
    this.romLoaded = false;
    this.romData = null;
  }

  loadRom(romData) {
    this.romData = romData;
    this.romLoaded = true;
    this.frameCounter = 0;
  }

  fastBoot() {
    // Override in subclass
  }

  reset() {
    this.frameCounter = 0;
    this.fastBoot();
  }

  frame() {
    // Override in subclass
    this.frameCounter++;
  }

  buttonDown(controller, button) {
    // Override in subclass
  }

  buttonUp(controller, button) {
    // Override in subclass
  }

  getTelemetry() {
    // Override in subclass
    return null;
  }
}
