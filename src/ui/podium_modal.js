// podium_modal.js - Victory Podium and Results Modal
export class PodiumModal {
  constructor(dialogElement, options = {}) {
    this.dialog = dialogElement;
    this.onRematch = options.onRematch || null;
    this.onClose = options.onClose || null;
    this.isShown = false;
  }

  show(results) {
    if (!this.dialog || this.isShown) return;
    this.isShown = true;

    const {
      isWinner,
      playerName = 'MARIO [YOU]',
      rivalName = 'MARIO [RIVAL / BOT]',
      playerTimeMs = 0,
      rivalTimeMs = 0,
      gameName = 'Super Mario Bros'
    } = results;

    const formatTime = (ms) => {
      const totalSec = Math.floor(ms / 1000);
      const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const s = String(totalSec % 60).padStart(2, '0');
      const h = String(Math.floor((ms % 1000) / 10)).padStart(2, '0');
      return `${m}:${s}.${h}`;
    };

    const deltaMs = playerTimeMs - rivalTimeMs;
    const deltaSec = (deltaMs / 1000).toFixed(2);
    const deltaStr = (deltaMs > 0) ? `+${deltaSec}s` : `${deltaSec}s`;
    const deltaColor = isWinner ? '#38E45C' : '#FC5C5C';
    const displayPlayerName = (playerName.includes('[YOU]') || playerName.includes('(TÚ)')) ? playerName : `${playerName} (TÚ)`;

    this.dialog.innerHTML = `
      <div class="podium-content">
        <div class="podium-trophy">${isWinner ? '🏆' : '🥈'}</div>
        <h2 class="podium-title ${isWinner ? 'win' : 'lose'}">
          ${isWinner ? '¡VICTORIA ÉPICA!' : '¡CARRERA COMPLETADA!'}
        </h2>
        <p class="podium-subtitle">${gameName} Speedrun VS</p>

        <div class="results-table">
          <div class="result-row ${isWinner ? 'winner-row' : ''}">
            <span class="r-place">${isWinner ? '🥇 1º' : '🥈 2º'}</span>
            <span class="r-name">${displayPlayerName}</span>
            <span class="r-time">${formatTime(playerTimeMs)}</span>
          </div>
          <div class="result-row ${!isWinner ? 'winner-row' : ''}">
            <span class="r-place">${!isWinner ? '🥇 1º' : '🥈 2º'}</span>
            <span class="r-name">${rivalName}</span>
            <span class="r-time">${rivalTimeMs > 0 ? formatTime(rivalTimeMs) : 'DNF'}</span>
          </div>
          <div class="delta-badge" style="color: ${deltaColor}">
            Diferencia: <strong>${deltaStr}</strong>
          </div>
        </div>

        <div class="podium-actions">
          <button id="podiumRematchBtn" class="btn btn-primary">🔄 Revancha (Rematch)</button>
          <button id="podiumCloseBtn" class="btn btn-secondary">🚪 Volver al Lobby</button>
        </div>
      </div>
    `;

    const rematchBtn = this.dialog.querySelector('#podiumRematchBtn');
    if (rematchBtn) {
      rematchBtn.addEventListener('click', () => {
        this.close();
        if (this.onRematch) this.onRematch();
      });
    }

    const closeBtn = this.dialog.querySelector('#podiumCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
        if (this.onClose) this.onClose();
      });
    }

    if (typeof this.dialog.showModal === 'function') {
      this.dialog.showModal();
    }
  }

  close() {
    this.isShown = false;
    if (this.dialog && typeof this.dialog.close === 'function') {
      try { this.dialog.close(); } catch (e) {}
    }
  }
}
