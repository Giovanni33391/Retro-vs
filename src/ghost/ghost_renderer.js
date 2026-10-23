// ghost_renderer.js - Renders Luigi Ghost Sprite (50% translucent) and Off-screen Chevrons

export class GhostRenderer {
  constructor() {
    // Generate small/super Luigi sprite canvases for crisp alpha-blended rendering
    this.spriteCache = {};
    this.initSprites();
  }

  initSprites() {
    // Authentic 16x16 / 16x32 pixel sprites for Luigi (Green cap/shirt, white overalls)
    // Small Luigi (16x16)
    // Palettes:
    // Transparent = 0, Green = 1 (#00A800), White = 2 (#FFFFFF), Peach = 3 (#FCA044)
    this.smallLuigiWalk1 = [
      "....11111.......",
      "...111111111....",
      "...2223323......",
      "..2323332333....",
      "..23223332333...",
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

    this.smallLuigiJump = [
      "....11111.......",
      "...111111111....",
      "...2223323......",
      "..2323332333....",
      "..23223332333...",
      "..2233332222....",
      "....3333333.....",
      ".3..112111..3...",
      ".3311121121133..",
      "..31112222113...",
      "...222222222....",
      "..22222222222...",
      ".2222222222222..",
      ".111.......111..",
      "1111.......1111.",
      "................"
    ];

    this.smallLuigiSkid = [
      "....11111.......",
      "...111111111....",
      "...2223323......",
      "..2323332333....",
      "..23223332333...",
      "..2233332222....",
      "....3333333.....",
      "...112111.33....",
      "..11121121133...",
      ".11112222111....",
      ".33.123221......",
      "....22222.......",
      "...2222222......",
      "..1111.1111.....",
      ".1111...1111....",
      "................"
    ];
  }

  // Draw sprite onto an offscreen canvas
  createSpriteCanvas(pattern, facingLeft = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(16, 16);
    const data = imgData.data;

    const palette = {
      "1": [0x00, 0xA8, 0x00, 255], // Green
      "2": [0xFF, 0xFF, 0xFF, 255], // White
      "3": [0xFC, 0x98, 0x38, 255]  // Peach
    };

    for (let y = 0; y < 16; y++) {
      const line = pattern[y] || "................";
      for (let x = 0; x < 16; x++) {
        const char = line[facingLeft ? (15 - x) : x];
        const idx = (y * 16 + x) * 4;
        if (palette[char]) {
          data[idx] = palette[char][0];
          data[idx + 1] = palette[char][1];
          data[idx + 2] = palette[char][2];
          data[idx + 3] = 255;
        } else {
          data[idx + 3] = 0; // Transparent
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  getGhostSprite(state, facingLeft) {
    const key = `${state}_${facingLeft ? 'L' : 'R'}`;
    if (!this.spriteCache[key]) {
      let pattern = this.smallLuigiWalk1;
      if (state === 2) pattern = this.smallLuigiJump;
      if (state === 3) pattern = this.smallLuigiSkid;
      this.spriteCache[key] = this.createSpriteCanvas(pattern, facingLeft);
    }
    return this.spriteCache[key];
  }

  // Render ghost runner onto viewport (ctx is 256x240 game viewport)
  renderGhost(ctx, marioTelem, luigiTelem) {
    if (!marioTelem || !luigiTelem) return;

    const relX = luigiTelem.x - marioTelem.cam_x;
    const relY = luigiTelem.y;
    const distPx = luigiTelem.x - marioTelem.x;

    // Check if Luigi is within the camera viewport
    const onScreen = (relX >= -16 && relX <= 256);

    if (onScreen) {
      // Render translucent Luigi Ghost at exact coordinates
      ctx.save();
      ctx.globalAlpha = 0.55; // 50-55% translucency for authentic ghost feel
      const facingLeft = (luigiTelem.facing === 1);
      const sprite = this.getGhostSprite(luigiTelem.state, facingLeft);
      ctx.drawImage(sprite, Math.round(relX), Math.round(relY));
      ctx.restore();
    } else {
      // Luigi is off-screen: Render Directional Chevron / Tracker Badge
      this.renderOffscreenTracker(ctx, relX, distPx, relY);
    }
  }

  renderOffscreenTracker(ctx, relX, distPx, targetY) {
    ctx.save();
    const clampedY = Math.max(30, Math.min(210, targetY || 120));

    if (relX > 256) {
      // Luigi is ahead (to the right)
      const badgeX = 186;
      const badgeY = clampedY;
      const text = `[L] ▶ +${distPx}px`;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(badgeX - 4, badgeY - 8, 70, 16);
      ctx.strokeStyle = "#FCA044";
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX - 4, badgeY - 8, 70, 16);

      ctx.font = "8px monospace";
      ctx.fillStyle = "#FCA044";
      ctx.fillText(text, badgeX, badgeY + 4);
    } else if (relX < -16) {
      // Luigi is behind (to the left)
      const badgeX = 8;
      const badgeY = clampedY;
      const text = `◀ [L] ${distPx}px`;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(badgeX - 4, badgeY - 8, 70, 16);
      ctx.strokeStyle = "#5C94FC";
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX - 4, badgeY - 8, 70, 16);

      ctx.font = "8px monospace";
      ctx.fillStyle = "#5C94FC";
      ctx.fillText(text, badgeX, badgeY + 4);
    }

    ctx.restore();
  }
}
