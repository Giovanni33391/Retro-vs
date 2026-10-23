// snes_runner.js - SNES 65816 / PPU Speedrun Runner for Super Mario World
import { BaseRunner } from './base_runner.js';
import { getGameProfile, GAME_IDS } from '../profiles/game_profiles.js';

export class SnesRunner extends BaseRunner {
  constructor(options = {}) {
    super({
      ...options,
      gameId: GAME_IDS.SMW,
      width: 256,
      height: 224
    });

    this.profile = getGameProfile(GAME_IDS.SMW);

    // 128KB SNES WRAM ($7E:0000 - $7F:FFFF)
    this.wram = new Uint8Array(0x20000);
    this.buttons = new Uint16Array(2); // Controller 1 & 2 bitmasks

    // Internal physics state for SMW Mario
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.subX = 0;

    // Palette cache for SNES pixel render
    this.initPalette();
  }

  get mem() {
    return this.wram;
  }

  initPalette() {
    // 32-bit ARGB/RGB colors (0x00RRGGBB) for authentic Yoshi's Island 1 aesthetic
    this.colors = {
      sky: 0xFF58D8FC,       // SMW Day Blue Sky (#58D8FC)
      skyDark: 0xFF40B8F0,   // Deep Sky Blue (#40B8F0)
      hillGreen: 0xFF00A028, // Yoshi Island Green (#00A028)
      hillOutline: 0xFF004810,
      cloudWhite: 0xFFFFFFFF,
      cloudShadow: 0xFFE0E0E0,
      groundBrown: 0xFF985028, // Ground dirt brown (#985028)
      groundTop: 0xFF10C030,   // Grass surface (#10C030)
      marioRed: 0xFFFC2810,    // Mario Cap & Shirt Red (#FC2810)
      marioBlue: 0xFF0040D8,   // Mario Overalls Blue (#0040D8)
      marioSkin: 0xFFFCA044,   // Peach Face (#FCA044)
      marioCap: 0xFFFC2810,
      goalWood: 0xFF683818,    // Goal Post Wood (#683818)
      goalTape: 0xFFFFFFFF
    };
  }

  loadRom(romData) {
    super.loadRom(romData);
    this.fastBoot();
  }

  reset() {
    super.reset();
  }

  fastBoot() {
    // Fast boot straight to Yoshi's Island 1 starting line
    this.wram.fill(0);

    // Mario X pos = 32 ($7E:0094 word)
    this.setWord(0x0094, 32);
    // Mario Y pos = 350 ($7E:0096 word)
    this.setWord(0x0096, 350);

    // Camera X = 0 ($7E:001A word), Camera Y = 240 ($7E:001C word)
    this.setWord(0x001A, 0);
    this.setWord(0x001C, 240);

    // Sublevel 0x105 (Yoshi's Island 1)
    this.wram[0x010B] = 0; // Level index
    this.wram[0x0071] = 0; // Normal state
    this.wram[0x0076] = 1; // Facing right (1=right, 0=left)
    this.wram[0x0019] = 0; // Small Mario
    this.wram[0x1493] = 0; // Goal flag (0=racing, >0=finished)

    this.vx = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.subX = 0;
    this.frameCounter = 0;
    this.renderFrame();
  }

  setWord(addr, val) {
    this.wram[addr] = val & 0xFF;
    this.wram[addr + 1] = (val >> 8) & 0xFF;
  }

  getWord(addr) {
    return this.wram[addr] | (this.wram[addr + 1] << 8);
  }

  // Button mapping (SNES):
  // 0: B (Jump), 1: Y (Run), 2: Select, 3: Start, 4: Up, 5: Down, 6: Left, 7: Right, 8: A (Spin Jump), 9: X (Run)
  buttonDown(controller, button) {
    const ctrl = (controller === 0) ? 0 : controller - 1;
    this.buttons[ctrl] |= (1 << button);
  }

  buttonUp(controller, button) {
    const ctrl = (controller === 0) ? 0 : controller - 1;
    this.buttons[ctrl] &= ~(1 << button);
  }

  frame() {
    this.frameCounter++;
    const btn = this.buttons[0];

    const pressLeft = (btn & (1 << 6)) !== 0;
    const pressRight = (btn & (1 << 7)) !== 0;
    const pressJump = (btn & (1 << 0)) !== 0 || (btn & (1 << 8)) !== 0;
    const pressRun = (btn & (1 << 1)) !== 0 || (btn & (1 << 9)) !== 0;

    let x = this.getWord(0x0094);
    let y = this.getWord(0x0096);
    let goalTimer = this.wram[0x1493];

    if (goalTimer > 0) {
      // Victory march past goal gate
      x += 2;
      this.setWord(0x0094, x);
      this.updateCamera(x);
      this.renderFrame();
      return;
    }

    // Horizontal Physics
    const maxSpeed = pressRun ? 38 : 24; // subpixel / 16
    const accel = 2;
    const friction = 1;

    if (pressRight) {
      this.wram[0x0076] = 1; // Facing right
      this.vx = Math.min(this.vx + accel, maxSpeed);
    } else if (pressLeft) {
      this.wram[0x0076] = 0; // Facing left
      this.vx = Math.max(this.vx - accel, -maxSpeed);
    } else {
      if (this.vx > 0) this.vx = Math.max(0, this.vx - friction);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + friction);
    }

    // Apply horizontal speed (16 subpixels = 1 pixel)
    this.subX += this.vx;
    const dx = Math.floor(this.subX / 10);
    this.subX %= 10;
    x += dx;
    if (x < 16) x = 16;
    this.setWord(0x0094, x);

    // Vertical Physics (Jump / Gravity)
    const groundY = 350;
    if (this.isGrounded) {
      if (pressJump) {
        this.vy = -12; // Initial jump impulse
        this.isGrounded = false;
        this.wram[0x0071] = 1; // Jump state
      } else {
        this.vy = 0;
        this.wram[0x0071] = (this.vx !== 0) ? 2 : 0; // 2=run, 0=stand
      }
    } else {
      // In air
      this.vy += 0.8; // Gravity
      y += this.vy;
      if (y >= groundY) {
        y = groundY;
        this.vy = 0;
        this.isGrounded = true;
        this.wram[0x0071] = 0;
      }
      this.setWord(0x0096, Math.round(y));
    }

    // Goal Tape / Victory Detection: Yoshi's Island 1 Goal Gate at X = 3550
    if (x >= 3550) {
      this.wram[0x1493] = 0x20; // Trigger course clear flag
    }

    this.updateCamera(x);
    this.renderFrame();
  }

  updateCamera(marioX) {
    // Camera centers Mario in the middle of 256px viewport
    let camX = marioX - 112;
    if (camX < 0) camX = 0;
    if (camX > 3400) camX = 3400;
    this.setWord(0x001A, camX);
  }

  renderFrame() {
    const fb = this.frameBuffer;
    const w = this.width;
    const h = this.height;
    const camX = this.getWord(0x001A);
    const marioX = this.getWord(0x0094);
    const marioY = this.getWord(0x0096);
    const facingRight = (this.wram[0x0076] === 1);
    const isJump = !this.isGrounded;

    // 1. Sky Gradient Background (Mode 1 SNES)
    const skyCol = this.colors.sky;
    for (let y = 0; y < 160; y++) {
      const idx = y * w;
      for (let x = 0; x < w; x++) {
        fb[idx + x] = skyCol;
      }
    }

    // 2. Distant Hills (Parallax layer)
    const hillOffsetX = Math.floor(camX * 0.25) % 180;
    for (let px = 0; px < w; px++) {
      const worldPx = (px + hillOffsetX);
      const hillHeight = Math.sin(worldPx * 0.03) * 30 + 130;
      for (let py = Math.floor(hillHeight); py < 180; py++) {
        if (py >= 0 && py < h) {
          fb[py * w + px] = this.colors.hillGreen;
        }
      }
    }

    // 3. Ground Layer (Y = 180 to 224)
    for (let py = 180; py < h; py++) {
      const isTop = (py === 180 || py === 181);
      const col = isTop ? this.colors.groundTop : this.colors.groundBrown;
      const idx = py * w;
      for (let px = 0; px < w; px++) {
        fb[idx + px] = col;
      }
    }

    // 4. Yoshi's Island 1 Goal Gate (at world X = 3550)
    const screenGoalX = 3550 - camX;
    if (screenGoalX >= -20 && screenGoalX < w + 20) {
      // Draw Wood Posts
      for (let gy = 80; gy < 180; gy++) {
        const row = gy * w;
        if (screenGoalX >= 0 && screenGoalX < w) fb[row + screenGoalX] = this.colors.goalWood;
        if (screenGoalX + 16 >= 0 && screenGoalX + 16 < w) fb[row + screenGoalX + 16] = this.colors.goalWood;
      }
      // Draw Goal Tape
      for (let gx = screenGoalX; gx <= screenGoalX + 16; gx++) {
        if (gx >= 0 && gx < w) fb[110 * w + gx] = this.colors.goalTape;
      }
    }

    // 5. Draw Mario Sprite (16x16 at relative screen position)
    const screenMarioX = marioX - camX;
    const screenMarioY = Math.round(180 - (350 - marioY) - 16);

    this.drawMarioSprite(screenMarioX, screenMarioY, facingRight, isJump);

    if (this.onFrameCallback) {
      this.onFrameCallback(fb);
    }
  }

  drawMarioSprite(sx, sy, facingRight, isJump) {
    const w = this.width;
    const h = this.height;
    const fb = this.frameBuffer;

    const red = this.colors.marioRed;
    const blue = this.colors.marioBlue;
    const skin = this.colors.marioSkin;

    for (let dy = 0; dy < 16; dy++) {
      const py = sy + dy;
      if (py < 0 || py >= h) continue;

      for (let dx = 0; dx < 16; dx++) {
        const renderDx = facingRight ? dx : (15 - dx);
        const px = sx + renderDx;
        if (px < 0 || px >= w) continue;

        let col = 0;
        // Simple recognizable SMW Mario Cap & Overalls pattern
        if (dy < 4 && dx >= 4 && dx <= 12) col = red; // Cap
        else if (dy >= 4 && dy < 8 && dx >= 4 && dx <= 10) col = skin; // Face
        else if (dy >= 8 && dy < 13 && dx >= 3 && dx <= 12) col = blue; // Overalls
        else if (dy >= 13 && dx >= 3 && dx <= 13) col = red; // Shoes

        if (col !== 0) {
          fb[py * w + px] = col;
        }
      }
    }
  }

  getTelemetry() {
    return this.profile.parseTelemetry(this.wram);
  }
}
