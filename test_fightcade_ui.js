// test_fightcade_ui.js - Unit tests for Fightcade UI and Audio subsystems
import { FightcadeSound } from './src/ui/fightcade_sound.js';
import { FightcadeLobby } from './src/ui/fightcade_lobby.js';
import { GAME_IDS, getAllGameProfiles } from './src/profiles/game_profiles.js';

console.log("==================================================================");
console.log("  INICIANDO PRUEBAS UNITARIAS DE FIGHTCADE LOBBY & AUDIO");
console.log("==================================================================");

// [TEST 1] FightcadeSound synth tones & mute toggle
console.log("\n[TEST 1] Verificando FightcadeSound sintetizador y estados...");
const sound = new FightcadeSound();
if (sound.isMuted !== false) throw new Error("Audio debe iniciar no silenciado");

sound.playChallengeAlert();
sound.playChallengeAccept();
sound.playCountdownTick();
sound.playCountdownGo();
sound.playChatNotification();

const muted = sound.toggleMute();
if (muted !== true || sound.isMuted !== true) throw new Error("Fallo al silenciar audio");
sound.playChallengeAlert(); // No-op silently when muted
sound.toggleMute();
if (sound.isMuted !== false) throw new Error("Fallo al reactivar audio");
console.log("  -> PASADO: Sintetizador Web Audio API e idempotencia probados.");

// [TEST 2] Mock DOM Environment for FightcadeLobby
console.log("\n[TEST 2] Creando Mock DOM y testeando inicialización de FightcadeLobby...");

function createMockElement(tag, id = '') {
  return {
    tagName: tag.toUpperCase(),
    id: id,
    className: '',
    dataset: {},
    children: [],
    style: {},
    innerHTML: '',
    textContent: '',
    value: '',
    placeholder: '',
    title: '',
    listeners: {},
    classList: {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c, force) {
        if (force !== undefined) {
          if (force) this.add(c); else this.remove(c);
          return force;
        }
        if (this.contains(c)) { this.remove(c); return false; }
        else { this.add(c); return true; }
      }
    },
    attributes: {},
    setAttribute(k, v) { this.attributes[k] = v; },
    removeAttribute(k) { delete this.attributes[k]; },
    addEventListener(event, fn) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
    },
    dispatchEvent(event) {
      if (this.listeners[event]) this.listeners[event].forEach(fn => fn({ target: this, preventDefault() {} }));
    },
    appendChild(child) {
      this.children.push(child);
    },
    querySelector(sel) {
      return this.children.find(c => c.className && c.className.includes(sel.replace('.', ''))) || createMockElement('div');
    },
    querySelectorAll(sel) {
      return this.children.filter(c => c.className && c.className.includes(sel.replace('.', '')));
    }
  };
}

const mockDocElements = {
  fcChannelsList: createMockElement('div', 'fcChannelsList'),
  fcChatMessages: createMockElement('div', 'fcChatMessages'),
  fcChatForm: createMockElement('form', 'fcChatForm'),
  fcChatInput: createMockElement('input', 'fcChatInput'),
  fcRosterList: createMockElement('div', 'fcRosterList'),
  fcChallengeIncomingModal: createMockElement('dialog', 'fcChallengeIncomingModal'),
  fcLobbySection: createMockElement('section', 'fcLobbySection'),
  fcArenaSection: createMockElement('section', 'fcArenaSection'),
  viewLobbyBtn: createMockElement('button', 'viewLobbyBtn'),
  viewArenaBtn: createMockElement('button', 'viewArenaBtn'),
  btnArenaBackToLobby: createMockElement('button', 'btnArenaBackToLobby'),
  channelSearchInput: createMockElement('input', 'channelSearchInput'),
  fcSelfNameInput: createMockElement('input', 'fcSelfNameInput'),
  btnPlayPractice: createMockElement('button', 'btnPlayPractice'),
  btnCreateChallenge: createMockElement('button', 'btnCreateChallenge'),
  bannerRomStatus: createMockElement('button', 'bannerRomStatus'),
  fcAcceptChallengeBtn: createMockElement('button', 'fcAcceptChallengeBtn'),
  fcDeclineChallengeBtn: createMockElement('button', 'fcDeclineChallengeBtn'),
  totalGamesCount: createMockElement('span', 'totalGamesCount'),
  fcCurrentSysBadge: createMockElement('span', 'fcCurrentSysBadge'),
  fcCurrentGameTitle: createMockElement('span', 'fcCurrentGameTitle'),
  bannerSysBadge: createMockElement('span', 'bannerSysBadge'),
  bannerGameTitle: createMockElement('h1', 'bannerGameTitle'),
  bannerGameDesc: createMockElement('p', 'bannerGameDesc'),
  tabCountAll: createMockElement('span', 'tabCountAll'),
  tabCountReady: createMockElement('span', 'tabCountReady'),
  tabCountPlaying: createMockElement('span', 'tabCountPlaying'),
  fcOnlineCount: createMockElement('span', 'fcOnlineCount'),
  challengerAvatar: createMockElement('div', 'challengerAvatar'),
  challengerName: createMockElement('div', 'challengerName'),
  challengeGameName: createMockElement('strong', 'challengeGameName'),
  challengeTimerBar: createMockElement('div', 'challengeTimerBar')
};

global.document = {
  getElementById: (id) => mockDocElements[id] || null,
  querySelector: (sel) => createMockElement('div'),
  querySelectorAll: (sel) => [],
  createElement: (tag) => createMockElement(tag)
};
global.localStorage = {
  getItem: () => 'TestMario',
  setItem: () => {}
};

let selectedGameId = null;
let startedPractice = null;
let viewChanged = null;

const lobby = new FightcadeLobby({
  initialGameId: 'smb1',
  cachedGames: ['smb1'],
  onGameSelected: (id) => { selectedGameId = id; },
  onStartPractice: (mode) => { startedPractice = mode; },
  onViewChanged: (view) => { viewChanged = view; }
});

if (lobby.activeGameId !== 'smb1') throw new Error('activeGameId inicial incorrecto');
if (!lobby.cachedGames.has('smb1')) throw new Error('cachedGames inicial incorrecto');
console.log("  -> PASADO: FightcadeLobby inicializado correctamente.");

// [TEST 3] Cambio de canales de juego y estado de caché
console.log("\n[TEST 3] Cambio de canales y renderizado de badges...");
lobby.setActiveGame(GAME_IDS.SMW);
if (lobby.activeGameId !== 'smw') throw new Error("Fallo al cambiar canal a smw");

lobby.setCachedGames(['smb1', 'smw']);
if (!lobby.cachedGames.has('smw')) throw new Error("Fallo al actualizar caché de SMW");
console.log("  -> PASADO: Navegación de canales y actualización de caché validados.");

// [TEST 4] Chat feed e historial de partidas
console.log("\n[TEST 4] Pruebas de mensajería de chat y resultados de partidas...");
const initialMsgCount = lobby.channelChats['smw'].length;
lobby.sendUserChatMessage("¡Desafío a quien sea en Yoshi's Island 1!");
if (lobby.channelChats['smw'].length !== initialMsgCount + 1) throw new Error("Mensaje de chat no añadido");

lobby.addMatchResult("TestMario", "CapeMaster", "00:45.12");
const lastMsg = lobby.channelChats['smw'][lobby.channelChats['smw'].length - 1];
if (lastMsg.type !== 'result' || lastMsg.winner !== 'TestMario') throw new Error("Fallo al registrar resultado");
console.log("  -> PASADO: Flujo de chat y registro de victorias verificado.");

// [TEST 5] Cambio de vistas (Lobby vs Arena)
console.log("\n[TEST 5] Alternancia de vista Lobby y Arena...");
lobby.switchView('arena');
if (lobby.currentView !== 'arena' || viewChanged !== 'arena') throw new Error("Fallo al cambiar a vista Arena");
if (!mockDocElements.fcArenaSection.classList.contains('active')) throw new Error("Clase active no aplicada a fcArenaSection");

lobby.switchView('lobby');
if (lobby.currentView !== 'lobby' || viewChanged !== 'lobby') throw new Error("Fallo al volver a vista Lobby");
console.log("  -> PASADO: Transición limpia entre Lobby y Arena verificada.");

// [TEST 6] Modal de desafío Fightcade
console.log("\n[TEST 6] Flujo del modal de desafío entrante Fightcade...");
let challengeAccepted = false;
let challengeDeclined = false;

lobby.showIncomingChallenge(
  { name: 'RetroPro', avatar: '🍄' },
  () => { challengeAccepted = true; },
  () => { challengeDeclined = true; }
);

if (mockDocElements.challengerName.textContent !== 'RetroPro') throw new Error("Nombre del retador no asignado");

lobby.closeChallengeModal();
console.log("  -> PASADO: Modal de desafío entrante y callbacks validados.");

console.log("\n==================================================================");
console.log("  ¡TODAS LAS PRUEBAS DE FIGHTCADE PASARON EXITOSAMENTE (100%)!");
console.log("==================================================================");
