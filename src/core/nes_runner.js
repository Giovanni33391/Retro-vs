// nes_runner.js - NES 6502 / PPU Runner powered by JSNES
import { NES, Controller } from 'jsnes';
import { BaseRunner } from './base_runner.js';
import { getGameProfile, GAME_IDS } from '../profiles/game_profiles.js';
import { NES_PALETTE } from '../nes/nes_palette.js';

export class NesRunner extends BaseRunner {
  constructor(options = {}) {
    super({
      ...options,
      gameId: GAME_IDS.SMB1,
      width: 256,
      height: 240
    });

    this.profile = getGameProfile(GAME_IDS.SMB1);

    this.nes = new NES({
      onFrame: (buffer) => {
        // Copy 256x240 buffer
        this.frameBuffer.set(buffer);
        this.frameCounter++;
        if (this.onFrameCallback) {
          this.onFrameCallback(this.frameBuffer);
        }
      },
      onAudioSample: (left, right) => {
        if (this.audioHandler && !this.isMuted) {
          this.audioHandler.writeSample(left, right);
        }
      }
    });

    if (this.nes && typeof this.nes.reset === 'function') {
      const origReset = this.nes.reset.bind(this.nes);
      this.nes.reset = () => {
        origReset();
        this.applyAuthenticPalette();
      };
    }

    this.applyAuthenticPalette();
  }

  applyAuthenticPalette() {
    if (!this.nes || !this.nes.ppu || !this.nes.ppu.palTable) return;
    const pal = this.nes.ppu.palTable;
    pal.loadNTSCPalette = () => {
      for (let i = 0; i < 64; i++) {
        pal.curTable[i] = NES_PALETTE[i];
      }
      pal.currentEmph = -1;
      pal.makeTables();
      pal.setEmphasis(0);
    };
    pal.loadPALPalette = pal.loadNTSCPalette;
    pal.loadNTSCPalette();
    pal.getEntry = (i) => NES_PALETTE[i & 0x3F];
    if (this.nes.ppu.updatePalettes) {
      this.nes.ppu.updatePalettes();
    }
  }

  loadRom(romBinary) {
    let binary = romBinary;
    if (romBinary instanceof Uint8Array || romBinary instanceof ArrayBuffer) {
      const bytes = new Uint8Array(romBinary);
      binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
    }
    this.romData = binary;
    this.nes.loadROM(binary);
    this.applyAuthenticPalette();
    this.romLoaded = true;
    this.frameCounter = 0;
  }

  reset() {
    if (this.romLoaded) {
      this.nes.reloadROM();
      this.applyAuthenticPalette();
      this.frameCounter = 0;
      this.fastBoot();
    }
  }

  fastBoot() {
    if (!this.romLoaded) return;
    this.applyAuthenticPalette();
    // Advance quickly past title screen and lives pre-level screen straight to starting line (x=40)
    for (let f = 0; f < 50; f++) this.nes.frame();
    this.buttonDown(1, 3); // Start
    for (let f = 0; f < 5; f++) this.nes.frame();
    this.buttonUp(1, 3);
    for (let f = 0; f < 135; f++) {
      this.nes.frame();
      if (this.mem && this.mem[0x0770] === 1 && this.mem[0x000E] === 8) {
        break;
      }
    }
    this.applyAuthenticPalette();
  }

  frame() {
    if (this.romLoaded) {
      this.nes.frame();
    }
  }

  // Controller buttons:
  // Controller.BUTTON_A = 0
  // Controller.BUTTON_B = 1
  // Controller.BUTTON_SELECT = 2
  // Controller.BUTTON_START = 3
  // Controller.BUTTON_UP = 4
  // Controller.BUTTON_DOWN = 5
  // Controller.BUTTON_LEFT = 6
  // Controller.BUTTON_RIGHT = 7
  buttonDown(controller, button) {
    const ctrl = (controller === 0) ? 1 : controller;
    this.nes.buttonDown(ctrl, button);
  }

  buttonUp(controller, button) {
    const ctrl = (controller === 0) ? 1 : controller;
    this.nes.buttonUp(ctrl, button);
  }

  get mem() {
    return this.nes.cpu ? this.nes.cpu.mem : null;
  }

  // Telemetry inspection directly from SMB1 NES RAM
  getTelemetry() {
    if (!this.mem) return null;
    return this.profile.parseTelemetry(this.mem);
  }
}
