// main.js - Master Game Loop & UI Orchestrator for Fightcade-Style Retro Speedrun VS
import { NesAudio } from './nes/nes_audio.js';
import { GAME_IDS, getGameProfile, detectGameFromFileName } from './profiles/game_profiles.js';
import { romCache } from './cache/rom_cache.js';
import { createRunner } from './core/runner_factory.js';
import { MultiGhostBot } from './ghost/multi_ghost_bot.js';
import { MultiGhostRenderer } from './ghost/multi_ghost_renderer.js';
import { TelemetryBar } from './ui/telemetry_bar.js';
import { WebRtcSync, CHALLENGE_STATES } from './net/webrtc_sync.js';
import { TouchControls } from './ui/touch_controls.js';
import { RomCacheUI } from './ui/rom_cache_ui.js';
import { PodiumModal } from './ui/podium_modal.js';
import { FightcadeLobby } from './ui/fightcade_lobby.js';
import { fcSound } from './ui/fightcade_sound.js';

// Application State
const state = {
  gameId: GAME_IDS.SMB1,
  mode: 'BOT', // 'ONLINE', 'BOT', 'SOLO'
  romData: null,
  isPaused: false,
  isCountingDown: false,
  raceStartTime: 0,
  elapsedTimeMs: 0,
  hasStartedRace: false,
  playerFinished: false,
  playerFinishTimeMs: 0,
  rivalFinished: false,
  rivalFinishTimeMs: 0
};

// Master Screen Canvas
const masterCanvas = document.getElementById('gameCanvas');
const masterCtx = masterCanvas.getContext('2d', { alpha: false });

// Offscreen buffer for native emulation frames
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');
let offscreenImageData = null;
let offscreenBuf32 = null;

// Audio & Emulators
const audio = new NesAudio(48000);
let playerRunner = null;
let rivalBotRunner = null;
const bot = new MultiGhostBot(state.gameId);
const ghostRenderer = new MultiGhostRenderer();
const telemetryBar = new TelemetryBar(256, 40);
let remoteGhostTelemetry = null;

// UI Components
let fcLobby = null;
let romCacheUI = null;
let touchControls = null;
let podiumModal = null;

// WebRTC Network Sync & Matchmaking
const webrtc = new WebRtcSync({
  onConnected: (roomCode) => {
    updateNetStatus(`ONLINE: Sala ${roomCode} Conectada! (Ping: ${webrtc.pingMs}ms)`, true);
    if (fcLobby) {
      fcLobby.sendUserChatMessage(`¡Conectado a la sala ${roomCode}! Preparando partida...`);
    }
    updateChallengeUI();
  },
  onDisconnected: () => {
    updateNetStatus('ONLINE: Rival desconectado.', false);
    updateChallengeUI();
  },
  onGhostData: (data) => {
    remoteGhostTelemetry = data;
    if (data && data.finished && !state.rivalFinished) {
      state.rivalFinished = true;
      state.rivalFinishTimeMs = state.elapsedTimeMs;
      checkRaceConclusion();
    }
  },
  onStatus: (msg) => {
    updateNetStatus(msg);
  },
  onChallengeStateChange: (challengeState, details) => {
    handleChallengeStateChange(challengeState, details);
  },
  onCountdownTick: (value) => {
    showCountdownOverlay(value);
  },
  onRivalFinished: (data) => {
    state.rivalFinished = true;
    state.rivalFinishTimeMs = data.finalTimeMs || state.elapsedTimeMs;
    checkRaceConclusion();
  },
  onGameSwitchRequested: async (newGameId) => {
    if (newGameId !== state.gameId) {
      await switchGame(newGameId);
    }
  }
});

// Setup Canvas Dimensions for Active Game
function configureCanvasForGame(gameId) {
  const profile = getGameProfile(gameId);
  masterCanvas.width = profile.width;
  masterCanvas.height = profile.totalCanvasHeight;
  masterCanvas.style.aspectRatio = '4 / 3';
  const bezel = masterCanvas.closest('.screen-bezel');
  if (bezel) {
    bezel.style.aspectRatio = '4 / 3';
  }

  offscreenCanvas.width = profile.width;
  offscreenCanvas.height = profile.height;
  offscreenImageData = offscreenCtx.createImageData(profile.width, profile.height);
  offscreenBuf32 = new Uint32Array(offscreenImageData.data.buffer);

  telemetryBar.setWidth(profile.width);
  if (touchControls) {
    touchControls.setSystem(profile.system);
  }

  updateArenaHeaders();
}

function updateArenaHeaders() {
  const modeTag = document.getElementById('arenaModeTag');
  const rivalTag = document.getElementById('arenaRivalTag');
  const profile = getGameProfile(state.gameId);

  const isMarioGame = (state.gameId === GAME_IDS.SMB1 || state.gameId === GAME_IDS.SMW);

  if (modeTag) {
    modeTag.textContent = state.mode === 'ONLINE' ? '1v1 P2P SPEEDRUN' : (state.mode === 'BOT' ? 'PRÁCTICA BOT' : 'CONTRARRELOJ');
  }

  if (rivalTag) {
    if (isMarioGame) {
      const rivalName = state.mode === 'ONLINE' ? 'MARIO [FANTASMA RIVAL]' : (state.mode === 'BOT' ? 'MARIO [FANTASMA BOT]' : 'NINGUNO (SOLO)');
      rivalTag.textContent = `MARIO [TÚ] vs ${rivalName}`;
    } else {
      const rivalName = state.mode === 'ONLINE' ? `${profile.rival} [RIVAL]` : (state.mode === 'BOT' ? `${profile.rival} [BOT]` : 'SOLO');
      rivalTag.textContent = `${profile.hero} [TÚ] vs ${rivalName}`;
    }
  }
}

// Switch Active Game
async function switchGame(newGameId) {
  state.gameId = newGameId;
  state.playerFinished = false;
  state.rivalFinished = false;
  state.hasStartedRace = false;
  state.isCountingDown = false;
  state.elapsedTimeMs = 0;
  bot.setGame(newGameId);
  configureCanvasForGame(newGameId);

  if (fcLobby) fcLobby.setActiveGame(newGameId);
  if (romCacheUI) await romCacheUI.setGame(newGameId);

  // Update share link and notify peer if in room
  if (webrtc.roomCode) {
    const shareInput = document.getElementById('roomShareLink');
    if (shareInput) {
      shareInput.value = `${window.location.origin}/?room=${webrtc.roomCode}&game=${newGameId}`;
    }
  }
  if (state.mode === 'ONLINE') {
    webrtc.sendGameSwitch(newGameId);
  }

  await loadRomForGame(newGameId);
}

// Load ROM (Check IndexedDB cache -> Fallback to defaultRom -> Fallback to File Picker)
async function loadRomForGame(gameId) {
  const statusEl = document.getElementById('loadingStatus');
  const overlay = document.getElementById('loadingOverlay');
  overlay.classList.remove('hidden');

  try {
    statusEl.textContent = `Buscando ROM en caché permanente para ${gameId.toUpperCase()}...`;
    const cached = await romCache.loadRom(gameId);

    if (cached && cached.data) {
      statusEl.textContent = `ROM en caché cargada en 0.1s: ${cached.fileName}`;
      state.romData = cached.data;
      initRunners();
      setTimeout(() => overlay.classList.add('hidden'), 100);
      await refreshCachedPills();
      return;
    }

    // Default ROM for SMB1 (if bundled in public/)
    const profile = getGameProfile(gameId);
    if (profile.defaultRom) {
      try {
        statusEl.textContent = `Descargando ROM por defecto: ${profile.defaultRom}...`;
        const response = await fetch(profile.defaultRom);
        const contentType = response.headers.get('content-type') || '';
        if (response.ok && !contentType.includes('text/html')) {
          const arrayBuf = await response.arrayBuffer();
          await romCache.saveRom(gameId, profile.defaultRom.replace('/', ''), arrayBuf);
          state.romData = new Uint8Array(arrayBuf);
          initRunners();
          if (romCacheUI) await romCacheUI.refresh();
          await refreshCachedPills();
          statusEl.textContent = `¡ROM lista: ${profile.name}!`;
          setTimeout(() => overlay.classList.add('hidden'), 150);
          return;
        }
      } catch (e) {
        console.warn('Default ROM fetch failed:', e);
      }
    }

    // No ROM in cache or default
    statusEl.innerHTML = `
      <div style="color: #fca044; margin-bottom: 10px; font-weight: bold;">ROM no encontrada en caché para ${profile.name}</div>
      <p style="font-size: 12px; color: #aaa; margin-bottom: 12px;">Arrastra tu archivo (${profile.extensions.join(', ')}) o selecciónalo:</p>
      <label class="btn btn-primary" style="display:inline-block; cursor:pointer;">
        📂 Seleccionar Archivo ROM
        <input type="file" id="modalFilePicker" accept="${profile.extensions.join(',')}" style="display:none;">
      </label>
    `;
    const picker = document.getElementById('modalFilePicker');
    if (picker) {
      picker.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          const upload = await romCache.handleFileUpload(file);
          if (upload.gameId !== state.gameId) {
            await switchGame(upload.gameId);
          } else {
            state.romData = upload.record.data;
            initRunners();
            if (romCacheUI) await romCacheUI.refresh();
            await refreshCachedPills();
            overlay.classList.add('hidden');
          }
        }
      };
    }
  } catch (err) {
    console.error('Error loading ROM:', err);
    statusEl.textContent = `Error: ${err.message}`;
  }
}

async function refreshCachedPills() {
  const cached = await romCache.listRoms();
  const cachedIds = cached.map(c => c.gameId);
  if (fcLobby) fcLobby.setCachedGames(cachedIds);
}

// Initialize Players and Practice Bot
function initRunners() {
  if (!state.romData) return;

  // Local Player Runner
  playerRunner = createRunner(state.gameId, {
    audioHandler: audio,
    isMuted: false
  });
  playerRunner.loadRom(state.romData);
  playerRunner.fastBoot();

  // Autonomous Ghost Rival Runner (for Bot Practice)
  rivalBotRunner = createRunner(state.gameId, {
    audioHandler: null,
    isMuted: true
  });
  rivalBotRunner.loadRom(state.romData);
  rivalBotRunner.fastBoot();
  bot.reset();

  state.raceStartTime = performance.now();
  state.hasStartedRace = false; // Freeze until race starts
  state.isCountingDown = false;
  state.playerFinished = false;
  state.rivalFinished = false;
}

// Synchronized Challenge State Handler
function handleChallengeStateChange(challengeState, details) {
  const readyBtn = document.getElementById('readyMatchBtn');
  const modalStatus = document.getElementById('challengeModalStatus');

  if (modalStatus) {
    modalStatus.textContent = `Estado: ${challengeState}`;
  }

  if (challengeState === CHALLENGE_STATES.WAITING_RIVAL) {
    if (readyBtn) readyBtn.style.display = 'none';
  } else if (challengeState === CHALLENGE_STATES.RIVAL_CONNECTED) {
    if (readyBtn) {
      readyBtn.style.display = 'block';
      readyBtn.textContent = '¡ESTOY LISTO!';
      readyBtn.classList.remove('btn-ready-active');
    }
  } else if (challengeState === CHALLENGE_STATES.READY) {
    if (readyBtn) {
      readyBtn.textContent = details.localReady ? '✓ ESPERANDO A QUE RIVAL CONFIRME' : '¡ESTOY LISTO!';
      if (details.localReady) readyBtn.classList.add('btn-ready-active');
    }
  } else if (challengeState === CHALLENGE_STATES.COUNTDOWN) {
    const roomModal = document.getElementById('roomModal');
    if (roomModal && typeof roomModal.close === 'function') roomModal.close();
    if (fcLobby) fcLobby.switchView('arena');
    state.isCountingDown = true;
    state.hasStartedRace = false;
    if (playerRunner) playerRunner.reset();
    if (rivalBotRunner) rivalBotRunner.reset();
  } else if (challengeState === CHALLENGE_STATES.RACING) {
    setTimeout(() => {
      const countOverlay = document.getElementById('countdownOverlay');
      if (countOverlay) countOverlay.classList.remove('active');
    }, 800);
    // Start synchronized race frame
    state.isCountingDown = false;
    state.hasStartedRace = true;
    state.raceStartTime = performance.now();
    state.elapsedTimeMs = 0;
    state.playerFinished = false;
    state.rivalFinished = false;
  }
}

function showCountdownOverlay(val) {
  const countOverlay = document.getElementById('countdownOverlay');
  const countNum = document.getElementById('countdownNumber');
  if (countOverlay && countNum) {
    countOverlay.classList.add('active');
    countNum.textContent = val;
    countNum.className = (val === '¡GO!') ? 'countdown-go' : 'countdown-tick';
  }
  if (val === '¡GO!') {
    fcSound.playCountdownGo();
  } else {
    fcSound.playCountdownTick();
  }
}

function startPracticeCountdown() {
  resetRace();
  state.isCountingDown = true;
  state.hasStartedRace = false;
  fcLobby.switchView('arena');
  let step = 3;
  showCountdownOverlay(step);

  const timer = setInterval(() => {
    step--;
    if (step > 0) {
      showCountdownOverlay(step);
    } else if (step === 0) {
      showCountdownOverlay('¡GO!');
    } else {
      clearInterval(timer);
      const countOverlay = document.getElementById('countdownOverlay');
      if (countOverlay) countOverlay.classList.remove('active');
      state.isCountingDown = false;
      state.hasStartedRace = true;
      state.raceStartTime = performance.now();
      state.elapsedTimeMs = 0;
    }
  }, 900);
}

function checkRaceConclusion() {
  if (state.playerFinished && !podiumModal.isShown) {
    const profile = getGameProfile(state.gameId);
    const isWinner = (!state.rivalFinished || state.playerFinishTimeMs <= state.rivalFinishTimeMs);

    const isMarioGame = (state.gameId === GAME_IDS.SMB1 || state.gameId === GAME_IDS.SMW);
    const playerName = isMarioGame ? 'MARIO [TÚ]' : `${profile.hero || 'Player 1'}`;
    const rivalName = isMarioGame
      ? (state.mode === 'BOT' ? 'MARIO [BOT]' : 'MARIO [RIVAL]')
      : ((state.mode === 'BOT') ? profile.rival : 'Rival Online');

    const formattedTime = (state.playerFinishTimeMs / 1000).toFixed(2);
    if (fcLobby) {
      const winnerName = isWinner ? playerName : rivalName;
      const loserName = isWinner ? rivalName : playerName;
      fcLobby.addMatchResult(winnerName, loserName, `${formattedTime}s`);
    }

    podiumModal.show({
      isWinner,
      playerName,
      rivalName,
      playerTimeMs: state.playerFinishTimeMs,
      rivalTimeMs: state.rivalFinishTimeMs,
      gameName: profile.name
    });
  }
}

// Master 60 FPS Emulation & Render Loop
let lastTime = 0;
const targetFrameTime = 1000 / 60; // 16.666 ms

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  if (!state.romData || !playerRunner) return;

  const delta = timestamp - lastTime;
  if (delta < targetFrameTime - 2) return;
  lastTime = timestamp;

  // If in countdown or race not started, freeze simulation on starting line (render static frame 0)
  if (state.isCountingDown || !state.hasStartedRace) {
    const playerTelem = playerRunner.getTelemetry();
    const rivalTelem = rivalBotRunner ? rivalBotRunner.getTelemetry() : null;
    const profile = getGameProfile(state.gameId);
    const modeLabel = (state.mode === 'ONLINE') ? 'ONLINE VS' : (state.mode === 'BOT' ? 'BOT PRACTICE' : 'SOLO TRIAL');

    telemetryBar.render(masterCtx, playerTelem, rivalTelem, modeLabel, 0, state.gameId);

    // Render current static frame buffer
    const fb = playerRunner.frameBuffer;
    const pixelCount = profile.width * profile.height;
    for (let i = 0; i < pixelCount; i++) {
      const pixel = fb[i];
      const r = (pixel >> 16) & 0xFF;
      const g = (pixel >> 8) & 0xFF;
      const b = pixel & 0xFF;
      offscreenBuf32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
    }
    offscreenCtx.putImageData(offscreenImageData, 0, 0);

    // Render ghost at starting position
    if (rivalTelem) {
      ghostRenderer.renderGhost(offscreenCtx, playerTelem, rivalTelem, state.gameId);
    }

    masterCtx.drawImage(offscreenCanvas, 0, profile.headerHeight);
    return;
  }

  // 1. Step Player Runner (60 FPS)
  playerRunner.frame();
  const playerTelem = playerRunner.getTelemetry();

  // Check victory / finish condition
  if (playerTelem && playerTelem.finished && !state.playerFinished) {
    state.playerFinished = true;
    state.playerFinishTimeMs = state.elapsedTimeMs;
    checkRaceConclusion();
  }

  // 2. Step Rival based on Active Mode
  let rivalTelem = null;

  if (state.mode === 'BOT') {
    if (rivalBotRunner && !state.rivalFinished) {
      bot.update(rivalBotRunner);
      rivalBotRunner.frame();
      rivalTelem = rivalBotRunner.getTelemetry();

      if (rivalTelem && rivalTelem.finished && !state.rivalFinished) {
        state.rivalFinished = true;
        state.rivalFinishTimeMs = state.elapsedTimeMs;
        checkRaceConclusion();
      }
    } else if (rivalBotRunner) {
      rivalTelem = rivalBotRunner.getTelemetry();
    }
  } else if (state.mode === 'ONLINE') {
    // Transmit telemetry over WebRTC DataChannel
    webrtc.sendTelemetry(playerTelem);
    rivalTelem = webrtc.getInterpolatedGhost() || remoteGhostTelemetry;
  } else if (state.mode === 'SOLO') {
    rivalTelem = null;
  }

  // Timer update
  if (!state.playerFinished && state.hasStartedRace) {
    state.elapsedTimeMs = Math.round(performance.now() - state.raceStartTime);
  }

  // 3. Compose Screen
  const profile = getGameProfile(state.gameId);
  const modeLabel = (state.mode === 'ONLINE') ? 'ONLINE VS' : (state.mode === 'BOT' ? 'BOT PRACTICE' : 'SOLO TRIAL');

  // Top Header: TelemetryBar
  telemetryBar.render(masterCtx, playerTelem, rivalTelem, modeLabel, state.elapsedTimeMs, state.gameId);

  // Bottom Viewport: Raw Frame Buffer
  const fb = playerRunner.frameBuffer;
  const pixelCount = profile.width * profile.height;
  for (let i = 0; i < pixelCount; i++) {
    const pixel = fb[i];
    // Convert 0x00RRGGBB to Little-Endian 0xAABBGGRR
    const r = (pixel >> 16) & 0xFF;
    const g = (pixel >> 8) & 0xFF;
    const b = pixel & 0xFF;
    offscreenBuf32[i] = 0xFF000000 | (b << 16) | (g << 8) | r;
  }
  offscreenCtx.putImageData(offscreenImageData, 0, 0);

  // Render Ghost Rival on top of native game viewport
  if (rivalTelem) {
    ghostRenderer.renderGhost(offscreenCtx, playerTelem, rivalTelem, state.gameId);
  }

  // Draw offscreen viewport onto Master Canvas at Y = 40
  masterCtx.drawImage(offscreenCanvas, 0, profile.headerHeight);
}

// Keyboard Input Handlers
const keyMap = {
  'ArrowUp': 4, 'KeyW': 4,
  'ArrowDown': 5, 'KeyS': 5,
  'ArrowLeft': 6, 'KeyA': 6,
  'ArrowRight': 7, 'KeyD': 7,
  'KeyZ': 1, 'KeyJ': 1, // B / Y / Turbo
  'KeyX': 0, 'KeyK': 0, // A / Jump
  'KeyC': 2, 'KeyL': 2, // Genesis C / Spin / Select
  'Enter': 3,            // Start
  'ShiftRight': 2, 'ShiftLeft': 2 // Select
};

window.addEventListener('keydown', (e) => {
  audio.unlock();
  fcSound.init();
  if (state.isCountingDown || !state.hasStartedRace) {
    return;
  }
  if (state.mode === 'ONLINE' && webrtc.challengeState === CHALLENGE_STATES.COUNTDOWN) {
    return;
  }
  const btn = keyMap[e.code];
  if (btn !== undefined && playerRunner) {
    playerRunner.buttonDown(1, btn);
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  const btn = keyMap[e.code];
  if (btn !== undefined && playerRunner) {
    playerRunner.buttonUp(1, btn);
    e.preventDefault();
  }
});

// Setup UI Controls & Mode Listeners
function setupUI() {
  const roomModal = document.getElementById('roomModal');
  const btnAudio = document.getElementById('audioToggleBtn');
  const btnReset = document.getElementById('resetGameBtn');

  // Initialize Fightcade Lobby Component
  fcLobby = new FightcadeLobby({
    initialGameId: state.gameId,
    onGameSelected: async (selectedGameId) => {
      await switchGame(selectedGameId);
    },
    onStartPractice: (practiceMode) => {
      state.mode = practiceMode;
      updateArenaHeaders();
      startPracticeCountdown();
    },
    onCreateP2PRoom: () => {
      state.mode = 'ONLINE';
      updateArenaHeaders();
      const code = webrtc.createRoom(null, state.gameId);
      document.getElementById('currentRoomCode').textContent = code;
      document.getElementById('roomShareLink').value = `${window.location.origin}/?room=${code}&game=${state.gameId}`;
      document.getElementById('roomCreatedSection').classList.remove('hidden');
      roomModal.showModal();
      updateChallengeUI();
    },
    onChallengePlayer: (player) => {
      state.mode = 'BOT';
      updateArenaHeaders();
      startPracticeCountdown();
    },
    onViewChanged: (viewName) => {
      if (viewName === 'arena') {
        configureCanvasForGame(state.gameId);
      }
    },
    onOpenRomCache: () => {
      const subDrawer = document.getElementById('subBarDrawer');
      const btnRom = document.getElementById('romToggleBtn');
      if (subDrawer) {
        subDrawer.classList.toggle('open');
        if (btnRom) btnRom.classList.toggle('active', subDrawer.classList.contains('open'));
      }
    }
  });

  // ROM Cache UI in Drawer
  const cacheContainer = document.getElementById('romCacheBar');
  romCacheUI = new RomCacheUI(cacheContainer, {
    gameId: state.gameId,
    onRomLoaded: async (gameId, record) => {
      await switchGame(gameId);
      await refreshCachedPills();
    },
    onRomDeleted: async (gameId) => {
      await refreshCachedPills();
      await loadRomForGame(gameId);
    }
  });

  // Podium Modal
  const podiumDialog = document.getElementById('podiumModal');
  podiumModal = new PodiumModal(podiumDialog, {
    onRematch: () => {
      if (state.mode === 'ONLINE') {
        webrtc.requestRematch();
      } else {
        startPracticeCountdown();
      }
    },
    onClose: () => {
      resetRace();
      fcLobby.switchView('lobby');
    }
  });

  // Room Matchmaking Handlers
  document.getElementById('createRoomBtn').addEventListener('click', () => {
    const code = webrtc.createRoom(null, state.gameId);
    document.getElementById('currentRoomCode').textContent = code;
    document.getElementById('roomShareLink').value = `${window.location.origin}/?room=${code}&game=${state.gameId}`;
    document.getElementById('roomCreatedSection').classList.remove('hidden');
    updateChallengeUI();
  });

  document.getElementById('joinRoomBtn').addEventListener('click', () => {
    const code = document.getElementById('joinRoomInput').value.trim();
    if (code) {
      const roomCode = webrtc.joinRoom(code, state.gameId);
      document.getElementById('currentRoomCode').textContent = roomCode;
      document.getElementById('roomShareLink').value = `${window.location.origin}/?room=${roomCode}&game=${state.gameId}`;
      document.getElementById('roomCreatedSection').classList.remove('hidden');
      updateChallengeUI();
    }
  });

  document.getElementById('readyMatchBtn').addEventListener('click', () => {
    webrtc.toggleReady();
  });

  document.getElementById('copyLinkBtn').addEventListener('click', () => {
    const linkInput = document.getElementById('roomShareLink');
    navigator.clipboard.writeText(linkInput.value);
    alert('¡Enlace de sala copiado al portapapeles!');
  });

  document.getElementById('closeModalBtn').addEventListener('click', () => {
    roomModal.close();
  });

  btnAudio.addEventListener('click', () => {
    audio.unlock();
    fcSound.init();
    const muted = audio.toggleMute();
    fcSound.toggleMute();
    btnAudio.textContent = muted ? '🔇' : '🔊';
    btnAudio.title = muted ? 'Sonido: Desactivado' : 'Sonido: Activado';
    btnAudio.classList.toggle('active', !muted);
  });

  btnReset.addEventListener('click', () => {
    startPracticeCountdown();
  });

  // Toggle ROM Status Drawer
  const btnRom = document.getElementById('romToggleBtn');
  const subDrawer = document.getElementById('subBarDrawer');
  if (btnRom && subDrawer) {
    btnRom.addEventListener('click', () => {
      subDrawer.classList.toggle('open');
      btnRom.classList.toggle('active', subDrawer.classList.contains('open'));
    });
  }

  // Toggle Fullscreen Viewport
  const btnFullscreen = document.getElementById('fullscreenBtn');
  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      const bezel = document.querySelector('.screen-bezel') || masterCanvas;
      if (!document.fullscreenElement) {
        if (bezel.requestFullscreen) {
          bezel.requestFullscreen();
        } else if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });
  }

  // Mobile Touch Controls
  const touchContainer = document.getElementById('touchControlsContainer');
  const btnTouch = document.getElementById('touchToggleBtn');
  if (btnTouch && touchContainer) {
    btnTouch.addEventListener('click', () => {
      touchContainer.classList.toggle('force-show');
      const active = touchContainer.classList.contains('force-show');
      btnTouch.classList.toggle('active', active);
    });
  }

  touchControls = new TouchControls(touchContainer, (btnIndex, isPressed) => {
    audio.unlock();
    fcSound.init();
    if (state.isCountingDown || !state.hasStartedRace) {
      return;
    }
    if (state.mode === 'ONLINE' && webrtc.challengeState === CHALLENGE_STATES.COUNTDOWN) {
      return;
    }
    if (!playerRunner) return;
    if (isPressed) {
      playerRunner.buttonDown(1, btnIndex);
    } else {
      playerRunner.buttonUp(1, btnIndex);
    }
  }, getGameProfile(state.gameId).system);

  // Drag and Drop ROM onto whole window
  const dragOverlay = document.getElementById('dragDropOverlay');
  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    if (dragOverlay) dragOverlay.classList.add('active');
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });

  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null && dragOverlay) {
      dragOverlay.classList.remove('active');
    }
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (dragOverlay) dragOverlay.classList.remove('active');

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const upload = await romCache.handleFileUpload(file);
      if (upload.gameId !== state.gameId) {
        await switchGame(upload.gameId);
      } else {
        state.romData = upload.record.data;
        initRunners();
        if (romCacheUI) await romCacheUI.refresh();
        await refreshCachedPills();
        const loading = document.getElementById('loadingOverlay');
        if (loading) loading.classList.add('hidden');
      }
    }
  });

  // Check URL parameters: ?room=SPEED-XXXX&game=smw
  const urlParams = new URLSearchParams(window.location.search);
  const roomParam = urlParams.get('room');
  const gameParam = urlParams.get('game');

  if (gameParam && Object.values(GAME_IDS).includes(gameParam)) {
    state.gameId = gameParam;
    if (fcLobby) fcLobby.setActiveGame(gameParam);
  }

  if (roomParam) {
    state.mode = 'ONLINE';
    updateArenaHeaders();
    const roomCode = webrtc.formatRoomCode(roomParam);
    document.getElementById('currentRoomCode').textContent = roomCode;
    document.getElementById('roomShareLink').value = `${window.location.origin}/?room=${roomCode}&game=${state.gameId}`;
    document.getElementById('roomCreatedSection').classList.remove('hidden');
    webrtc.joinRoom(roomParam, state.gameId);
    updateChallengeUI();
    if (fcLobby) fcLobby.switchView('arena');
  }
}

function resetRace() {
  if (playerRunner) playerRunner.reset();
  if (rivalBotRunner) rivalBotRunner.reset();
  bot.reset();
  if (podiumModal) podiumModal.close();
  state.hasStartedRace = false;
  state.isCountingDown = false;
  state.raceStartTime = performance.now();
  state.elapsedTimeMs = 0;
  state.playerFinished = false;
  state.rivalFinished = false;
  state.playerFinishTimeMs = 0;
  state.rivalFinishTimeMs = 0;
}

function updateChallengeUI() {
  const readyBtn = document.getElementById('readyMatchBtn');
  const statusEl = document.getElementById('challengeModalStatus');
  if (statusEl) {
    statusEl.textContent = `Estado de sala: ${webrtc.challengeState}`;
  }
  if (readyBtn) {
    readyBtn.style.display = (webrtc.isConnected || webrtc.challengeState !== CHALLENGE_STATES.WAITING_RIVAL) ? 'block' : 'none';
  }
}

function updateNetStatus(text, isGood = false) {
  const el = document.getElementById('netStatus');
  if (el) {
    el.textContent = text;
    el.style.color = isGood ? '#10b981' : '#fca044';
  }
}

// App Bootstrap
window.addEventListener('DOMContentLoaded', async () => {
  setupUI();
  configureCanvasForGame(state.gameId);
  await refreshCachedPills();
  await loadRomForGame(state.gameId);
  requestAnimationFrame(gameLoop);
});
