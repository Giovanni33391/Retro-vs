// game_selector.js - Visual Game Catalog & Selector Component
import { getAllGameProfiles } from '../profiles/game_profiles.js';

export class GameSelector {
  constructor(containerElement, onGameSelected) {
    this.container = containerElement;
    this.onGameSelected = onGameSelected;
    this.activeGameId = 'smb1';
    this.cachedGames = new Set();
    this.init();
  }

  setCachedGames(gameIds) {
    this.cachedGames = new Set(gameIds);
    this.render();
  }

  setActiveGame(gameId) {
    this.activeGameId = gameId;
    this.render();
  }

  init() {
    this.render();
  }

  render() {
    if (!this.container) return;
    const profiles = getAllGameProfiles();

    this.container.innerHTML = `
      <div class="game-selector-grid">
        ${profiles.map(p => {
          const isActive = (p.id === this.activeGameId);
          const isCached = this.cachedGames.has(p.id);
          const cacheLabel = isCached ? 'LISTA' : 'ROM';
          const cacheClass = isCached ? 'cache-ready' : 'cache-missing';

          let icon = '🍄';
          if (p.id === 'smw') icon = '🦖';
          else if (p.id === 'sonic1') icon = '🦔';
          else if (p.id === 'sonic2') icon = '⚡';
          else if (p.id === 'sonic3k') icon = '💎';

          return `
            <button class="game-card game-pill ${isActive ? 'active' : ''}" data-game="${p.id}" title="${p.name} (${p.systemName}) - ${isCached ? 'ROM en caché' : 'Requiere ROM'}">
              <span class="pill-icon">${icon}</span>
              <span class="pill-name">${p.shortName || p.name}</span>
              <span class="sys-badge pill-sys ${p.system}">${p.system.toUpperCase()}</span>
              <span class="cache-pill pill-dot ${cacheClass}" title="${cacheLabel}"></span>
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Bind click events
    const cards = this.container.querySelectorAll('.game-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const gameId = card.dataset.game;
        if (gameId !== this.activeGameId) {
          this.setActiveGame(gameId);
          if (this.onGameSelected) {
            this.onGameSelected(gameId);
          }
        }
      });
    });
  }
}
