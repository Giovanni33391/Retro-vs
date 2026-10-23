// multi_ghost_renderer.js - Multi-System Ghost Runner Renderer
// Renders 50% translucent ghosts for Luigi (SMB1 & SMW) and Tails/Sonic (Genesis)
import { GAME_IDS, getGameProfile } from '../profiles/game_profiles.js';
import { GhostRenderer as Smb1GhostRenderer } from './ghost_renderer.js';

export class MultiGhostRenderer {
  constructor() {
    this.smb1Renderer = new Smb1GhostRenderer();
    this.spriteCache = {};
    this.initSprites();
  }

  initSprites() {
    // 16x16 Super Mario World Luigi Sprite
    // Palette: 0=transp, 1=green (#00A800), 2=white/purple (#F0F0FF), 3=peach (#FCA044), 4=yellow cape (#FCE440)
    this.smwLuigiPattern = [
      "....11111.......",
      "...111111111....",
      "...2223323444...",
      "..232333234444..",
      "..23223332344...",
      "..2233332222....",
      "....3333333.....",
      "...112111.......",
      "..1112112111....",
      ".111122221111...",
      ".33.123221.33...",
      ".333.2222.333...",
      ".333222222333...",
      "....222.222.....",
      "...111...111....",
      "..1111...1111..."
    ];

    // 24x24 Sega Genesis Tails Sprite
    // Palette: 0=transp, 1=orange (#FCA000), 2=white (#FFFFFF), 3=red shoes (#E42020), 4=black (#000000)
    this.tailsPattern = [
      ".......111..............",
      "......111111............",
      ".....11111111...........",
      "....1122112211..........",
      "....1124112411..........",
      "....1122112211..........",
      ".....11122111...1111....",
      "......122221...111111...",
      "......222222..11111111..",
      ".....22222222.11111111..",
      ".....11222211..111111...",
      "....1112222111...11.....",
      "....1111221111..........",
      "....11..11..11..........",
      "...333......333.........",
      "..3333......3333........"
    ];
  }

  createSprite(pattern, width, height, palette, facingLeft = false) {
    if (typeof document === 'undefined') return null; // Node.js test environment guard
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = 0; y < height; y++) {
      const line = pattern[y] || "";
      for (let x = 0; x < width; x++) {
        const char = line[facingLeft ? (width - 1 - x) : x] || ".";
        const idx = (y * width + x) * 4;
        const color = palette[char];
        if (color) {
          data[idx] = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  getGhostSprite(gameId, state, facingLeft) {
    const key = `${gameId}_${state}_${facingLeft ? 'L' : 'R'}`;
    if (!this.spriteCache[key]) {
      if (gameId === GAME_IDS.SMW) {
        const palette = {
          "1": [0x00, 0xA8, 0x00],
          "2": [0xF0, 0xF0, 0xFF],
          "3": [0xFC, 0x98, 0x38],
          "4": [0xFC, 0xE4, 0x40]
        };
        this.spriteCache[key] = this.createSprite(this.smwLuigiPattern, 16, 16, palette, facingLeft);
      } else if (gameId === GAME_IDS.SONIC1 || gameId === GAME_IDS.SONIC2 || gameId === GAME_IDS.SONIC3K) {
        const palette = {
          "1": [0xFC, 0xA0, 0x00], // Orange
          "2": [0xFF, 0xFF, 0xFF], // White
          "3": [0xE4, 0x20, 0x20], // Red
          "4": [0x10, 0x10, 0x10]  // Black
        };
        this.spriteCache[key] = this.createSprite(this.tailsPattern, 24, 16, palette, facingLeft);
      } else {
        return this.smb1Renderer.getGhostSprite(state, facingLeft);
      }
    }
    return this.spriteCache[key];
  }

  renderGhost(ctx, localTelem, remoteTelem, gameId = GAME_IDS.SMB1) {
    if (!localTelem || !remoteTelem || !ctx) return;

    if (gameId === GAME_IDS.SMB1) {
      this.smb1Renderer.renderGhost(ctx, localTelem, remoteTelem);
      return;
    }

    const profile = getGameProfile(gameId);
    const viewWidth = profile.width;
    const viewHeight = profile.height;

    const relX = remoteTelem.x - localTelem.cam_x;
    let relY = remoteTelem.y;

    if (gameId === GAME_IDS.SMW) {
      relY = 180 - (350 - remoteTelem.y) - 16;
    } else if (gameId.startsWith('sonic')) {
      relY = 180 - (0x03A0 - remoteTelem.y) - 24;
    }

    const distPx = remoteTelem.x - localTelem.x;
    const onScreen = (relX >= -24 && relX <= viewWidth);

    if (onScreen) {
      ctx.save();
      ctx.globalAlpha = 0.55; // 55% translucency
      const facingLeft = (remoteTelem.facing === 1);
      const sprite = this.getGhostSprite(gameId, remoteTelem.state, facingLeft);
      if (sprite) {
        ctx.drawImage(sprite, Math.round(relX), Math.round(relY));
      }
      ctx.restore();
    } else {
      this.renderOffscreenTracker(ctx, relX, distPx, relY, viewWidth, profile.rival);
    }
  }

  renderOffscreenTracker(ctx, relX, distPx, targetY, viewWidth = 256, rivalName = 'RIVAL') {
    ctx.save();
    const clampedY = Math.max(30, Math.min(190, targetY || 100));
    const badgeW = 76;
    const badgeH = 16;
    const tag = `[${rivalName.toUpperCase().slice(0, 5)}]`;

    if (relX > viewWidth) {
      // Ahead
      const badgeX = viewWidth - badgeW - 8;
      const text = `${tag} ▶ +${distPx}px`;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(badgeX - 4, clampedY - 8, badgeW, badgeH);
      ctx.strokeStyle = "#FCA044";
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX - 4, clampedY - 8, badgeW, badgeH);

      ctx.font = "8px monospace";
      ctx.fillStyle = "#FCA044";
      ctx.fillText(text, badgeX, clampedY + 4);
    } else if (relX < -16) {
      // Behind
      const badgeX = 8;
      const text = `◀ ${tag} ${distPx}px`;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(badgeX - 4, clampedY - 8, badgeW, badgeH);
      ctx.strokeStyle = "#5C94FC";
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX - 4, clampedY - 8, badgeW, badgeH);

      ctx.font = "8px monospace";
      ctx.fillStyle = "#5C94FC";
      ctx.fillText(text, badgeX, clampedY + 4);
    }

    ctx.restore();
  }
}
