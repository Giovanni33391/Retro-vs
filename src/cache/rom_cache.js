// rom_cache.js - Permanent ROM Caching System with IndexedDB
// Provides 0.1s instant boot on repeat visits, drag-and-drop caching, and cache deletion.

import { detectGameFromFileName } from '../profiles/game_profiles.js';

const DB_NAME = 'SpeedrunVsRomCache';
const DB_VERSION = 1;
const STORE_NAME = 'roms';

// In-memory fallback cache for Node.js test environment or SSR
const memoryCache = new Map();

class RomCacheManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  isIndexedDBSupported() {
    return typeof indexedDB !== 'undefined';
  }

  async getDb() {
    if (!this.isIndexedDBSupported()) {
      return null;
    }
    if (this.db) return this.db;

    if (!this.initPromise) {
      this.initPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'gameId' });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.warn('[RomCache] IndexedDB error, falling back to memory cache:', event.target.error);
          resolve(null);
        };
      });
    }

    return this.initPromise;
  }

  // Save ROM to IndexedDB (or fallback cache)
  async saveRom(gameId, fileName, data) {
    let binaryData = data;
    // Normalize to Uint8Array or binary string if necessary
    let size = 0;
    if (data instanceof ArrayBuffer) {
      size = data.byteLength;
      binaryData = new Uint8Array(data);
    } else if (data instanceof Uint8Array) {
      size = data.byteLength;
    } else if (typeof data === 'string') {
      size = data.length;
    }

    const record = {
      gameId,
      fileName,
      size,
      data: binaryData,
      lastModified: Date.now()
    };

    memoryCache.set(gameId, record);

    const db = await this.getDb();
    if (!db) {
      return record;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);

        req.onsuccess = () => resolve(record);
        req.onerror = (e) => reject(e.target.error);
      } catch (err) {
        console.warn('[RomCache] Failed to put into IndexedDB:', err);
        resolve(record);
      }
    });
  }

  // Load ROM from IndexedDB (< 0.1s)
  async loadRom(gameId) {
    if (memoryCache.has(gameId)) {
      return memoryCache.get(gameId);
    }

    const db = await this.getDb();
    if (!db) {
      return memoryCache.get(gameId) || null;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(gameId);

        req.onsuccess = () => {
          const result = req.result;
          if (result) {
            memoryCache.set(gameId, result);
            resolve(result);
          } else {
            resolve(null);
          }
        };

        req.onerror = () => resolve(null);
      } catch (err) {
        console.warn('[RomCache] Load error:', err);
        resolve(null);
      }
    });
  }

  // Delete cached ROM
  async deleteRom(gameId) {
    memoryCache.delete(gameId);
    const db = await this.getDb();
    if (!db) return true;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(gameId);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // Check if ROM exists in cache
  async hasRom(gameId) {
    if (memoryCache.has(gameId)) return true;
    const item = await this.loadRom(gameId);
    return item !== null;
  }

  // List all cached ROM entries
  async listRoms() {
    const db = await this.getDb();
    if (!db) {
      return Array.from(memoryCache.values());
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.forEach(item => memoryCache.set(item.gameId, item));
          resolve(list);
        };
        req.onerror = () => resolve(Array.from(memoryCache.values()));
      } catch (e) {
        resolve(Array.from(memoryCache.values()));
      }
    });
  }

  // Auto-detect game and store uploaded ROM file
  async handleFileUpload(file) {
    const fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const gameId = detectGameFromFileName(fileName, bytes);

    const record = await this.saveRom(gameId, fileName, bytes);
    return {
      gameId,
      record
    };
  }

  // Clear memory cache (useful for tests)
  clearMemoryCache() {
    memoryCache.clear();
  }
}

export const romCache = new RomCacheManager();
