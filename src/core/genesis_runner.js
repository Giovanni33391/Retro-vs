// genesis_runner.js - Sega Genesis / Mega Drive M68K Speedrun Runner for Sonic 1, 2, 3&K
import { BaseRunner } from './base_runner.js';
import { getGameProfile, GAME_IDS } from '../profiles/game_profiles.js';

export class GenesisRunner extends BaseRunner {
  constructor(options = {}) {
    super({
      ...options,
      gameId: options.gameId || GAME_IDS.SONIC1,
      width: 320,
      height: 224
    });

    this.profile = getGameProfile(this.gameId);

    // 64KB Genesis M68K RAM ($FFFF0000 - $FFFFFFFF)
    this.ram = new Uint8Array(0x10000);
    this.buttons = new Uint16Array(2);

    // Internal physics state for Sonic momentum
    this.speed = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.isRolling = false;
    this.spindashRev = 0;
    this.subX = 0;

    this.initPalette();
  }

  get mem() {
    return this.ram;
  }

  initPalette() {
    // 32-bit ARGB/RGB colors (0x00RRGGBB) for Green Hill / Emerald Hill aesthetic
    this.colors = {
      skyBlue: 0xFF2090F0,     // Genesis Blue Sky (#2090F0)
      cloudWhite: 0xFFFFFFFF,
      mountainBlue: 0xFF1060D0,// Mountain Blue (#1060D0)
      waterCyan: 0xFF00C0E0,   // Water Cyan (#00C0E0)
      waterDeep: 0xFF0090B0,   // Deep Water (#0090B0)
      grassGreen: 0xFF00C020,  // Green Hill Grass (#00C020)
      grassDark: 0xFF008010,
      checkerboard1: 0xFFC85810, // Brown tile 1 (#C85810)
      checkerboard2: 0xFFE87020, // Brown tile 2 (#E87020)
      sonicBlue: 0xFF0070EC,    // Sonic Cobalt Blue (#0070EC)
      sonicWhite: 0xFFFFFFFF,
      sonicRed: 0xFFE82010,     // Sonic Shoes Red (#E82010)
      sonicSkin: 0xFFF8B870,    // Peach Muzzle (#F8B870)
      signpostGold: 0xFFF8C010  // Signpost Gold (#F8C010)
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
    this.ram.fill(0);

    const isSonic1 = (this.gameId === GAME_IDS.SONIC1);
    const objBase = isSonic1 ? 0xD000 : 0xB000;

    // Sonic initial position: X = 0x0060 (96 px), Y = 0x03A0 (928 px)
    const startX = 0x0060;
    const startY = 0x03A0;

    this.setWord(objBase + 0x08, startX);
    this.setWord(objBase + 0x0C, startY);

    if (this.gameId === GAME_IDS.SONIC3K) {
      this.setWord(objBase + 0x10, startX);
      this.setWord(objBase + 0x14, startY);
    }

    // Camera X = 0
    const camBase = isSonic1 ? 0xF700 : 0xEE00;
    this.setWord(camBase, 0);
    this.setWord(camBase + 0x04, startY - 120);

    // Zone 1 Act 1
    this.ram[0xFE10] = 0; // Zone 0 (Green Hill / Emerald Hill / Angel Island)
    this.ram[0xFE11] = 0; // Act 0 (Act 1)

    // Player Status: facing right (bit 0 = 0), grounded (bit 1 = 0)
    this.ram[objBase + 0x22] = 0x00;
    this.ram[objBase + 0x1C] = 0x00; // Walk/Run anim
    this.ram[0xF7C8] = 0; // Signpost trigger

    this.speed = 0;
    this.vy = 0;
    this.isGrounded = true;
    this.isRolling = false;
    this.spindashRev = 0;
    this.subX = 0;
    this.frameCounter = 0;
    this.renderFrame();
  }

  setWord(addr, val) {
    this.ram[addr] = (val >> 8) & 0xFF;
    this.ram[addr + 1] = val & 0xFF;
  }

  getWord(addr) {
    return (this.ram[addr] << 8) | this.ram[addr + 1];
  }

  // Button mapping (Genesis 3-button):
  // 0: A (Jump), 1: B (Jump), 2: C (Jump/Spindash), 3: Start, 4: Up, 5: Down, 6: Left, 7: Right
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
    const pressDown = (btn & (1 << 5)) !== 0;
    const pressJump = (btn & (1 << 0)) !== 0 || (btn & (1 << 1)) !== 0 || (btn & (1 << 2)) !== 0;

    const isSonic1 = (this.gameId === GAME_IDS.SONIC1);
    const objBase = isSonic1 ? 0xD000 : 0xB000;
    const xOffset = (this.gameId === GAME_IDS.SONIC3K) ? 0x10 : 0x08;
    const yOffset = (this.gameId === GAME_IDS.SONIC3K) ? 0x14 : 0x0C;

    let x = this.getWord(objBase + xOffset);
    let y = this.getWord(objBase + yOffset);
    let signpost = this.ram[0xF7C8];

    if (signpost > 0) {
      // Signpost spinning victory march
      x += 4;
      this.setWord(objBase + xOffset, x);
      this.updateCamera(x, y);
      this.renderFrame();
      return;
    }

    // Spindash mechanics: Hold Down + Press Jump
    if (this.isGrounded && pressDown) {
      this.isRolling = true;
      if (pressJump) {
        this.spindashRev = Math.min(this.spindashRev + 8, 48);
      }
    } else if (this.spindashRev > 0 && !pressDown) {
      // Launch spindash!
      this.speed = Math.max(24, this.spindashRev);
      this.spindashRev = 0;
      this.isRolling = true;
    }

    // Horizontal Momentum & Acceleration
    const maxRunSpeed = 36;
    const accel = 2;
    const decel = 1;

    if (pressRight) {
      this.ram[objBase + 0x22] &= ~0x01; // Facing right
      if (this.speed < maxRunSpeed) this.speed += accel;
    } else if (pressLeft) {
      this.ram[objBase + 0x22] |= 0x01; // Facing left
      if (this.speed > -maxRunSpeed) this.speed -= accel;
    } else {
      if (this.speed > 0) this.speed = Math.max(0, this.speed - decel);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + decel);
    }

    // Apply speed
    this.subX += this.speed;
    const dx = Math.floor(this.subX / 6);
    this.subX %= 6;
    x += dx;
    if (x < 64) x = 64;
    this.setWord(objBase + xOffset, x);

    // Vertical Physics & Jump
    const groundY = 0x03A0;
    if (this.isGrounded) {
      if (pressJump && !pressDown) {
        this.vy = -14;
        this.isGrounded = false;
        this.isRolling = true;
        this.ram[objBase + 0x22] |= 0x02; // in-air
      } else {
        this.vy = 0;
        this.ram[objBase + 0x22] &= ~0x02;
        if (!pressDown && Math.abs(this.speed) < 2) this.isRolling = false;
      }
    } else {
      this.vy += 0.9; // Genesis gravity
      y += this.vy;
      if (y >= groundY) {
        y = groundY;
        this.vy = 0;
        this.isGrounded = true;
        this.isRolling = false;
        this.ram[objBase + 0x22] &= ~0x02;
      }
      this.setWord(objBase + yOffset, Math.round(y));
    }

    // Animation state
    if (this.isRolling) {
      this.ram[objBase + 0x1C] = 2; // Rolling / Ball
    } else if (Math.abs(this.speed) > 16) {
      this.ram[objBase + 0x1C] = 1; // Full run
    } else if (Math.abs(this.speed) > 0) {
      this.ram[objBase + 0x1C] = 0; // Walk
    }

    // Victory detection: Signpost reached (~10580 px)
    if (x >= 10580) {
      this.ram[0xF7C8] = 0x01; // Trigger signpost spin
    }

    this.updateCamera(x, y);
    this.renderFrame();
  }

  updateCamera(sonicX, sonicY) {
    const isSonic1 = (this.gameId === GAME_IDS.SONIC1);
    const camBase = isSonic1 ? 0xF700 : 0xEE00;

    let camX = sonicX - 144;
    if (camX < 0) camX = 0;
    if (camX > 10500) camX = 10500;
    this.setWord(camBase, camX);
  }

  renderFrame() {
    const fb = this.frameBuffer;
    const w = this.width;
    const h = this.height;

    const isSonic1 = (this.gameId === GAME_IDS.SONIC1);
    const objBase = isSonic1 ? 0xD000 : 0xB000;
    const camBase = isSonic1 ? 0xF700 : 0xEE00;
    const xOffset = (this.gameId === GAME_IDS.SONIC3K) ? 0x10 : 0x08;
    const yOffset = (this.gameId === GAME_IDS.SONIC3K) ? 0x14 : 0x0C;

    const camX = this.getWord(camBase);
    const sonicX = this.getWord(objBase + xOffset);
    const sonicY = this.getWord(objBase + yOffset);
    const facingLeft = (this.ram[objBase + 0x22] & 0x01) !== 0;
    const isBall = this.isRolling;

    // 1. Sky & Clouds
    for (let y = 0; y < 100; y++) {
      const row = y * w;
      const col = (y > 70 && y < 85) ? this.colors.cloudWhite : this.colors.skyBlue;
      for (let x = 0; x < w; x++) {
        fb[row + x] = col;
      }
    }

    // 2. Parallax Distant Mountains & Water
    const mountainParallax = Math.floor(camX * 0.2) % 200;
    for (let y = 100; y < 150; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const peak = Math.sin((x + mountainParallax) * 0.04) * 15 + 115;
        fb[row + x] = (y >= peak) ? this.colors.mountainBlue : this.colors.skyBlue;
      }
    }

    // 3. Water Scanlines (Y = 150 to 180)
    for (let y = 150; y < 180; y++) {
      const row = y * w;
      const col = (y % 4 < 2) ? this.colors.waterCyan : this.colors.waterDeep;
      for (let x = 0; x < w; x++) {
        fb[row + x] = col;
      }
    }

    // 4. Ground: Iconic Green Hill Checkerboard (Y = 180 to 224)
    for (let y = 180; y < h; y++) {
      const row = y * w;
      const isGrass = (y <= 184);
      for (let x = 0; x < w; x++) {
        if (isGrass) {
          fb[row + x] = (x % 4 < 2) ? this.colors.grassGreen : this.colors.grassDark;
        } else {
          const worldX = x + camX;
          const checkPattern = ((Math.floor(worldX / 16) + Math.floor(y / 16)) % 2 === 0);
          fb[row + x] = checkPattern ? this.colors.checkerboard1 : this.colors.checkerboard2;
        }
      }
    }

    // 5. Signpost (World X = 10580)
    const screenSignX = 10580 - camX;
    if (screenSignX >= -24 && screenSignX < w + 24) {
      for (let sy = 130; sy < 180; sy++) {
        const row = sy * w;
        if (screenSignX + 8 >= 0 && screenSignX + 8 < w) {
          fb[row + screenSignX + 8] = 0xFF505050; // Post
        }
        if (sy < 155 && screenSignX >= 0 && screenSignX + 16 < w) {
          for (let sx = screenSignX; sx <= screenSignX + 16; sx++) {
            fb[row + sx] = this.colors.signpostGold; // Signplate
          }
        }
      }
    }

    // 6. Sonic Sprite (relative screen position)
    const screenSonicX = sonicX - camX;
    const screenSonicY = Math.round(180 - (0x03A0 - sonicY) - 24);

    this.drawSonicSprite(screenSonicX, screenSonicY, facingLeft, isBall);

    if (this.onFrameCallback) {
      this.onFrameCallback(fb);
    }
  }

  drawSonicSprite(sx, sy, facingLeft, isBall) {
    const w = this.width;
    const h = this.height;
    const fb = this.frameBuffer;

    const blue = this.colors.sonicBlue;
    const skin = this.colors.sonicSkin;
    const red = this.colors.sonicRed;
    const white = this.colors.sonicWhite;

    if (isBall) {
      // Sonic Rolling Spindash Ball (18x18 circle)
      for (let dy = 6; dy < 24; dy++) {
        const py = sy + dy;
        if (py < 0 || py >= h) continue;
        for (let dx = 3; dx < 21; dx++) {
          const px = sx + dx;
          if (px < 0 || px >= w) continue;
          const distSq = (dx - 12) * (dx - 12) + (dy - 15) * (dy - 15);
          if (distSq <= 64) {
            fb[py * w + px] = (distSq < 20) ? white : blue;
          }
        }
      }
      return;
    }

    // Standing / Running Sonic Sprite (24x24)
    for (let dy = 0; dy < 24; dy++) {
      const py = sy + dy;
      if (py < 0 || py >= h) continue;

      for (let dx = 0; dx < 24; dx++) {
        const renderDx = facingLeft ? (23 - dx) : dx;
        const px = sx + renderDx;
        if (px < 0 || px >= w) continue;

        let col = 0;
        // Sonic quill / body silhouette
        if (dy < 10 && dx >= 4 && dx <= 16) col = blue; // Head & Quills
        else if (dy >= 6 && dy < 12 && dx >= 14 && dx <= 18) col = skin; // Muzzle
        else if (dy >= 10 && dy < 18 && dx >= 6 && dx <= 16) col = blue; // Torso
        else if (dy >= 12 && dy < 17 && dx >= 9 && dx <= 14) col = skin; // Belly
        else if (dy >= 18 && dy < 21 && dx >= 7 && dx <= 15) col = blue; // Legs
        else if (dy >= 21 && dx >= 6 && dx <= 18) col = red; // Power Sneakers

        if (col !== 0) {
          fb[py * w + px] = col;
        }
      }
    }
  }

  getTelemetry() {
    return this.profile.parseTelemetry(this.ram);
  }
}
