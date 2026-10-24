// ghost_renderer.js - Renders Mario Ghost Sprite (50% translucent) and Off-screen Chevrons

export class GhostRenderer {
  constructor() {
    // Generate small/super Mario ghost sprite canvases for crisp alpha-blended rendering
    this.spriteCache = {};
    this.initSprites();
  }

  initSprites() {
    // Authentic 16x16 pixel sprites for Mario Ghost
    // Palettes:
    // Transparent = 0, Red = 1 (#D82800), Brown = 2 (#A81000), Peach = 3 (#FC9838)
    this.smallMarioWalk1 = [
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

    this.smallMarioJump = [
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

    this.smallMarioSkid = [
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

    // Backward-compatibility aliases
    this.smallLuigiWalk1 = this.smallMarioWalk1;
    this.smallLuigiJump = this.smallMarioJump;
    this.smallLuigiSkid = this.smallMarioSkid;
  }

  // Draw sprite onto an offscreen canvas
  createSpriteCanvas(pattern, facingLeft = false) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    const imgData = ctx.createImageData(16, 16);
    const data = imgData.data;

    // Classic NES SMB1 Mario Palette (Red cap/shirt, brown overalls, peach skin)
    const palette = {
      "1": [0xD8, 0x28, 0x00, 255], // Mario Red (#D82800)
      "2": [0xA8, 0x10, 0x00, 255], // Mario Brown overalls (#A81000)
      "3": [0xFC, 0x98, 0x38, 255]  // Peach face (#FC9838)
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
      let pattern = this.smallMarioWalk1;
      if (state === 2) pattern = this.smallMarioJump;
      if (state === 3) pattern = this.smallMarioSkid;
      this.spriteCache[key] = this.createSpriteCanvas(pattern, facingLeft);
    }
    return this.spriteCache[key];
  }

  // Render ghost runner onto viewport (ctx is 256x240 game viewport)
  renderGhost(ctx, marioTelem, rivalTelem) {
    if (!marioTelem || !rivalTelem) return;

    const relX = rivalTelem.x - marioTelem.cam_x;
    const relY = rivalTelem.y;
    const distPx = rivalTelem.x - marioTelem.x;

    // Check if Mario Rival is within the camera viewport
    const onScreen = (relX >= -16 && relX <= 256);

    if (onScreen) {
      // Render translucent Mario Ghost at exact coordinates with 50% alpha
      ctx.save();
      ctx.globalAlpha = 0.50; // Authentic 50% translucency
      const facingLeft = (rivalTelem.facing === 1);
      const sprite = this.getGhostSprite(rivalTelem.state, facingLeft);
      ctx.drawImage(sprite, Math.round(relX), Math.round(relY));
      ctx.restore();
    } else {
      // Mario Rival is off-screen: Render Directional Chevron / Tracker Badge
      this.renderOffscreenTracker(ctx, relX, distPx, relY);
    }
  }

  renderOffscreenTracker(ctx, relX, distPx, targetY) {
    ctx.save();
    const clampedY = Math.max(30, Math.min(210, targetY || 120));
    const badgeW = 76;
    const badgeH = 16;

    if (relX > 256) {
      // Mario Rival is ahead (to the right)
      const badgeX = 256 - badgeW - 8;
      const text = `[MARIO] ▶ +${distPx}px`;

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(badgeX - 4, clampedY - 8, badgeW, badgeH);
      ctx.strokeStyle = "#FCA044";
      ctx.lineWidth = 1;
      ctx.strokeRect(badgeX - 4, clampedY - 8, badgeW, badgeH);

      ctx.font = "8px monospace";
      ctx.fillStyle = "#FCA044";
      ctx.fillText(text, badgeX, clampedY + 4);
    } else if (relX < -16) {
      // Mario Rival is behind (to the left)
      const badgeX = 8;
      const text = `◀ [MARIO] ${distPx}px`;

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
