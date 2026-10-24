// game_selector.js - Elegant Arcade Dropdown Component
import { getAllGameProfiles, getGameProfile } from '../profiles/game_profiles.js';

export class GameSelector {
  constructor(containerElement, onGameSelected) {
    this.container = containerElement;
    this.onGameSelected = onGameSelected;
    this.activeGameId = 'smb1';
    this.cachedGames = new Set();
    this.isOpen = false;
    this.init();
  }

  setCachedGames(gameIds) {
    this.cachedGames = new Set(gameIds);
    this.render();
  }

  setActiveGame(gameId) {
    this.activeGameId = gameId;
    this.isOpen = false;
    this.render();
  }

  init() {
    this.render();

    // Close dropdown on outside click
    if (typeof document !== 'undefined') {
      document.addEventListener('click', (e) => {
        if (this.isOpen && this.container && !this.container.contains(e.target)) {
          this.isOpen = false;
          this.render();
        }
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.isOpen = false;
          this.render();
        }
      });
    }
  }

  getGameIcon(id) {
    switch (id) {
      case 'smb1': return '🍄';
      case 'smw': return '🦖';
      case 'sonic1': return '🦔';
      case 'sonic2': return '⚡';
      case 'sonic3k': return '💎';
      default: return '🎮';
    }
  }

  render() {
    if (!this.container) return;
    const profiles = getAllGameProfiles();
    const current = getGameProfile(this.activeGameId) || profiles[0];
    const currentIcon = this.getGameIcon(current.id);
    const isCurrentCached = this.cachedGames.has(current.id);

    this.container.innerHTML = `
      <div class="game-dropdown-wrapper">
        <button id="gameDropdownToggle" class="game-dropdown-btn ${this.isOpen ? 'open' : ''}" type="button" aria-haspopup="true" aria-expanded="${this.isOpen}" title="Seleccionar juego retro">
          <span class="dropdown-icon">${currentIcon}</span>
          <span class="dropdown-title">${current.name}</span>
          <span class="dropdown-badge sys-${current.system}">${current.systemBadge || current.system.toUpperCase()}</span>
          <span class="dropdown-chevron">${this.isOpen ? '▲' : '▼'}</span>
        </button>

        <div class="game-dropdown-menu ${this.isOpen ? 'show' : ''}" role="menu">
          <div class="dropdown-header">CATÁLOGO MULTI-SISTEMA RETRO</div>
          ${profiles.map(p => {
            const isSelected = (p.id === this.activeGameId);
            const isCached = this.cachedGames.has(p.id);
            const icon = this.getGameIcon(p.id);
            return `
              <div class="game-menu-item game-card ${isSelected ? 'selected' : ''}" data-game="${p.id}" role="menuitem">
                <span class="menu-item-icon">${icon}</span>
                <div class="menu-item-info">
                  <span class="menu-item-name">${p.name}</span>
                  <span class="menu-item-meta">${p.systemName} • ${p.year}</span>
                </div>
                <span class="menu-item-badge sys-${p.system}">${p.system.toUpperCase()}</span>
                <span class="menu-item-cache ${isCached ? 'ready' : 'missing'}" title="${isCached ? 'ROM lista en caché local' : 'Requiere archivo ROM'}">
                  ${isCached ? '● LISTA' : '○ ROM'}
                </span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Toggle dropdown
    const toggleBtn = this.container.querySelector('#gameDropdownToggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.isOpen = !this.isOpen;
        this.render();
      });
    }

    // Select game item
    const items = this.container.querySelectorAll('.game-menu-item');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const selectedId = item.dataset.game;
        this.isOpen = false;
        if (selectedId !== this.activeGameId) {
          this.setActiveGame(selectedId);
          if (this.onGameSelected) {
            this.onGameSelected(selectedId);
          }
        } else {
          this.render();
        }
      });
    });
  }
}
