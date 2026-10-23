// rom_cache_ui.js - ROM Cache Indicator & Drag-and-Drop Handler
import { romCache } from '../cache/rom_cache.js';
import { getGameProfile } from '../profiles/game_profiles.js';

export class RomCacheUI {
  constructor(containerElement, options = {}) {
    this.container = containerElement;
    this.onRomLoaded = options.onRomLoaded || null;
    this.onRomDeleted = options.onRomDeleted || null;
    this.currentGameId = options.gameId || 'smb1';
    this.cachedRecord = null;
    this.init();
  }

  async setGame(gameId) {
    this.currentGameId = gameId;
    await this.refresh();
  }

  async refresh() {
    this.cachedRecord = await romCache.loadRom(this.currentGameId);
    this.render();
  }

  init() {
    this.setupGlobalDragAndDrop();
    this.render();
  }

  render() {
    if (!this.container) return;
    const profile = getGameProfile(this.currentGameId);
    const hasCache = !!this.cachedRecord;

    const allowedExts = profile.extensions.join(', ');
    const sizeStr = hasCache ? `(${(this.cachedRecord.size / 1024).toFixed(1)} KB)` : '';

    this.container.innerHTML = `
      <div class="cache-bar ${hasCache ? 'has-cache' : 'no-cache'}">
        <div class="cache-info">
          <span class="cache-icon">${hasCache ? '✅' : '⚠️'}</span>
          <span class="cache-text">
            ${hasCache
              ? `<strong>ROM en caché lista:</strong> ${this.cachedRecord.fileName} ${sizeStr}`
              : `<strong>Sin ROM en caché:</strong> Arrastra tu archivo (${allowedExts})`}
          </span>
        </div>
        <div class="cache-actions">
          <label class="cache-btn load-btn" title="Cargar archivo ROM local">
            📂 ${hasCache ? 'Cambiar' : 'Cargar'} ROM
            <input type="file" id="cacheFileInput" accept="${profile.extensions.join(',')}" style="display:none;">
          </label>
          ${hasCache ? `<button class="cache-btn delete-btn" id="deleteCacheBtn" title="Eliminar ROM de la memoria local">🗑️ Borrar</button>` : ''}
        </div>
      </div>
    `;

    // File input change
    const fileInput = this.container.querySelector('#cacheFileInput');
    if (fileInput) {
      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.processUploadedFile(file);
        }
      });
    }

    // Delete button
    const deleteBtn = this.container.querySelector('#deleteCacheBtn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        if (confirm(`¿Borrar ROM en caché para ${profile.name}?`)) {
          await romCache.deleteRom(this.currentGameId);
          this.cachedRecord = null;
          await this.refresh();
          if (this.onRomDeleted) this.onRomDeleted(this.currentGameId);
        }
      });
    }
  }

  setupGlobalDragAndDrop() {
    const dropOverlay = document.getElementById('dragDropOverlay');

    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dropOverlay) dropOverlay.classList.add('active');
    });

    window.addEventListener('dragleave', (e) => {
      if (e.relatedTarget === null && dropOverlay) {
        dropOverlay.classList.remove('active');
      }
    });

    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      if (dropOverlay) dropOverlay.classList.remove('active');

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        await this.processUploadedFile(files[0]);
      }
    });
  }

  async processUploadedFile(file) {
    const uploadResult = await romCache.handleFileUpload(file);
    await this.refresh();
    if (this.onRomLoaded) {
      this.onRomLoaded(uploadResult.gameId, uploadResult.record);
    }
  }
}
