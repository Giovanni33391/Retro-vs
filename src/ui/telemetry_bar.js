// telemetry_bar.js - Renders the Multi-System Telemetry Header Bar
import { getGameProfile, GAME_IDS } from '../profiles/game_profiles.js';

export class TelemetryBar {
  constructor(width = 256, height = 40) {
    this.width = width;
    this.height = height;
    this.levelLengths = {
      1: 3200, // 1-1
      2: 3266, // 1-2
      3: 2425, // 1-3
      4: 2400  // 1-4
    };
  }

  setWidth(width) {
    this.width = width;
  }

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    const mStr = String(minutes).padStart(2, "0");
    const sStr = String(seconds).padStart(2, "0");
    const hStr = String(hundredths).padStart(2, "0");
    return `${mStr}:${sStr}.${hStr}`;
  }

  render(ctx, playerTelem, rivalTelem, modeName, elapsedTimeMs, gameId = GAME_IDS.SMB1) {
    if (!ctx) return;
    const profile = getGameProfile(gameId);
    ctx.save();

    // 1. Bar background (retro deep dark slate with golden border)
    ctx.fillStyle = "#0c0d12";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = "#2c2d3a";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.height - 0.5);
    ctx.lineTo(this.width, this.height - 0.5);
    ctx.stroke();

    // 2. Left: Mode & Level / Zone
    let stageStr = "1-1";
    if (playerTelem) {
      stageStr = profile.stageName ? profile.stageName(playerTelem) : `${playerTelem.world || 1}-${playerTelem.level || 1}`;
    }

    ctx.font = "7px 'Press Start 2P', monospace, sans-serif";
    ctx.fillStyle = "#FCA044"; // Retro gold
    ctx.fillText(stageStr, 8, 14);

    ctx.font = "6px monospace";
    ctx.fillStyle = "#8888aa";
    ctx.fillText(modeName || "GHOST", 8, 26);

    // 3. Center: Mini Race Progress Track
    const trackW = Math.min(130, this.width - 150);
    const trackX = Math.round((this.width - trackW) / 2);
    const trackY = 16;
    const trackH = 4;

    ctx.fillStyle = "#1e2029";
    ctx.fillRect(trackX, trackY, trackW, trackH);
    ctx.strokeStyle = "#40445a";
    ctx.strokeRect(trackX, trackY, trackW, trackH);

    // Goal flag marker
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(trackX + trackW - 2, trackY - 4, 2, 8);

    let maxLen = profile.trackLength || 3200;
    if (gameId === GAME_IDS.SMB1 && playerTelem && playerTelem.level && this.levelLengths[playerTelem.level]) {
      maxLen = this.levelLengths[playerTelem.level];
    }

    // Player Pin (Hero)
    const heroInitial = profile.hero ? profile.hero[0] : "P";
    const rivalInitial = profile.rival ? profile.rival[0] : "R";

    if (playerTelem) {
      const pPct = Math.min(1.0, Math.max(0.0, playerTelem.x / maxLen));
      const pPinX = trackX + Math.round(pPct * trackW);
      ctx.fillStyle = profile.heroColor || "#FC3800";
      ctx.fillRect(pPinX - 2, trackY - 3, 4, 6);
      ctx.font = "5px monospace";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(heroInitial, pPinX - 1.5, trackY - 4);
    }

    // Rival Pin (Ghost)
    if (rivalTelem) {
      const rPct = Math.min(1.0, Math.max(0.0, rivalTelem.x / maxLen));
      const rPinX = trackX + Math.round(rPct * trackW);
      ctx.fillStyle = profile.rivalColor || "#00A800";
      ctx.fillRect(rPinX - 2, trackY + 1, 4, 6);
      ctx.font = "5px monospace";
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(rivalInitial, rPinX - 1.5, trackY + 11);
    }

    // 4. Right: Timer and Delta
    const timeStr = this.formatTime(elapsedTimeMs);
    const rightMargin = this.width - 80;
    ctx.font = "8px monospace";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(timeStr, rightMargin, 14);

    // Delta calculation
    if (playerTelem && rivalTelem) {
      const distDelta = playerTelem.x - rivalTelem.x;
      // Convert pixels to estimated seconds (avg speed ~ 2.5 - 6 px/frame)
      const pxPerSec = (gameId.startsWith('sonic')) ? 300.0 : 150.0;
      const secDelta = distDelta / pxPerSec;
      let deltaStr = "±0.00s";
      let deltaColor = "#FFFFFF";

      if (distDelta > 15) {
        deltaStr = `+${secDelta.toFixed(2)}s`;
        deltaColor = "#38E45C"; // Ahead
      } else if (distDelta < -15) {
        deltaStr = `${secDelta.toFixed(2)}s`;
        deltaColor = "#FC5C5C"; // Behind
      }

      ctx.font = "7px monospace";
      ctx.fillStyle = deltaColor;
      ctx.fillText(deltaStr, rightMargin, 26);
    } else {
      ctx.font = "6px monospace";
      ctx.fillStyle = "#666688";
      ctx.fillText("SOLO RUN", rightMargin, 26);
    }

    ctx.restore();
  }
}
