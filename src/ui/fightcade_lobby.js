// fightcade_lobby.js - Authentic Fightcade-Style Lobby, Channel Browser & Matchmaking
import { getAllGameProfiles, getGameProfile } from '../profiles/game_profiles.js';
import { fcSound } from './fightcade_sound.js';

export class FightcadeLobby {
  constructor(options = {}) {
    this.activeGameId = options.initialGameId || 'smb1';
    this.cachedGames = new Set(options.cachedGames || []);
    this.currentView = 'lobby'; // 'lobby' | 'arena'
    this.userName = localStorage.getItem('fc_username') || 'Mario_Speed';
    this.userStatus = 'online'; // 'online' | 'away'

    // Callbacks
    this.onGameSelected = options.onGameSelected || (() => {});
    this.onStartPractice = options.onStartPractice || (() => {});
    this.onCreateP2PRoom = options.onCreateP2PRoom || (() => {});
    this.onChallengePlayer = options.onChallengePlayer || (() => {});
    this.onViewChanged = options.onViewChanged || (() => {});
    this.onChatMessage = options.onChatMessage || (() => {});
    this.onOpenRomCache = options.onOpenRomCache || (() => {});

    // Chat streams per channel
    this.channelChats = {
      smb1: [
        { type: 'system', text: '¡Bienvenido al canal de Super Mario Bros. (NES)! Arrastra tu ROM o desafía a cualquier jugador.', time: '12:00' },
        { type: 'result', winner: 'Mario_Speed', loser: 'Bot_Mario', timeText: '00:31.84', time: '12:01' },
        { type: 'user', sender: 'RetroKing', avatar: '🍄', text: '¿Quién para un 1v1 Any% en World 1-1?', time: '12:02' }
      ],
      smw: [
        { type: 'system', text: '¡Bienvenido al canal de Super Mario World (SNES)! Sincronización de Mario fantasma activada.', time: '12:00' },
        { type: 'user', sender: 'YoshiRider', avatar: '🦖', text: 'Practicando la ruta Yoshi Island 1.', time: '12:01' }
      ],
      sonic1: [
        { type: 'system', text: '¡Bienvenido al canal de Sonic the Hedgehog (Genesis)! Spindash habilitado.', time: '12:00' },
        { type: 'user', sender: 'SonicDash', avatar: '🦔', text: 'Green Hill Zone listo para speedrun.', time: '12:01' }
      ],
      sonic2: [
        { type: 'system', text: '¡Bienvenido al canal de Sonic 2 (Genesis)! Emerald Hill Zone 1.', time: '12:00' }
      ],
      sonic3k: [
        { type: 'system', text: '¡Bienvenido al canal de Sonic 3 & Knuckles! Hydrocity Zone.', time: '12:00' }
      ]
    };

    // Roster mock players
    this.channelPlayers = {
      smb1: [
        { id: 'bot_mario', name: 'Mario_Bot [IA]', avatar: '🍄', role: 'Mario (Bot)', flag: '🤖', ping: 5, status: 'ready', isBot: true },
        { id: 'p_retro1', name: 'BowserCrusher', avatar: '🍄', role: 'Mario (Pro)', flag: '🇲🇽', ping: 18, status: 'ready' },
        { id: 'p_retro2', name: 'Speedy_Gonzalo', avatar: '🍄', role: 'Mario (Expert)', flag: '🇪🇸', ping: 26, status: 'playing' },
        { id: 'p_retro3', name: 'Nintendero_85', avatar: '🍄', role: 'Mario (Casual)', flag: '🇦🇷', ping: 42, status: 'ready' },
        { id: 'p_retro4', name: 'PeachDefender', avatar: '🍄', role: 'Mario (Any%)', flag: '🇨🇱', ping: 35, status: 'away' }
      ],
      smw: [
        { id: 'bot_smw', name: 'SMW_Bot [IA]', avatar: '🍄', role: 'Mario (Bot)', flag: '🤖', ping: 5, status: 'ready', isBot: true },
        { id: 'p_smw1', name: 'CapeMaster', avatar: '🍄', role: 'Mario (Cape)', flag: '🇺🇸', ping: 22, status: 'ready' },
        { id: 'p_smw2', name: 'YoshiRider', avatar: '🦖', role: 'Yoshi Speed', flag: '🇲🇽', ping: 15, status: 'ready' }
      ],
      sonic1: [
        { id: 'bot_sonic', name: 'Sonic_Bot [IA]', avatar: '🦔', role: 'Sonic (Bot)', flag: '🤖', ping: 5, status: 'ready', isBot: true },
        { id: 'p_sonic1', name: 'SonicDash_91', avatar: '🦔', role: 'Sonic (Pro)', flag: '🇧🇷', ping: 30, status: 'ready' }
      ],
      sonic2: [
        { id: 'bot_sonic2', name: 'Tails_Bot [IA]', avatar: '⚡', role: 'Sonic 2 Bot', flag: '🤖', ping: 5, status: 'ready', isBot: true }
      ],
      sonic3k: [
        { id: 'bot_sonic3k', name: 'Knuckles_Bot [IA]', avatar: '💎', role: 'S3&K Bot', flag: '🤖', ping: 5, status: 'ready', isBot: true }
      ]
    };

    this.activeRosterFilter = 'all';
    this.challengeTimeout = null;
    this.initElements();
    this.bindEvents();
    this.render();
  }

  setCachedGames(cachedIds) {
    this.cachedGames = new Set(cachedIds);
    this.renderChannels();
    this.updateBannerRomStatus();
  }

  setActiveGame(gameId) {
    this.activeGameId = gameId;
    this.renderChannels();
    this.renderBanner();
    this.renderChatMessages();
    this.renderRoster();
  }

  switchView(viewName) {
    this.currentView = viewName;
    const lobbySec = document.getElementById('fcLobbySection');
    const arenaSec = document.getElementById('fcArenaSection');
    const tabLobby = document.getElementById('viewLobbyBtn');
    const tabArena = document.getElementById('viewArenaBtn');

    if (viewName === 'arena') {
      if (lobbySec) lobbySec.classList.remove('active');
      if (arenaSec) arenaSec.classList.add('active');
      if (tabLobby) tabLobby.classList.remove('active');
      if (tabArena) tabArena.classList.add('active');
    } else {
      if (arenaSec) arenaSec.classList.remove('active');
      if (lobbySec) lobbySec.classList.add('active');
      if (tabArena) tabArena.classList.remove('active');
      if (tabLobby) tabLobby.classList.add('active');
    }

    if (this.onViewChanged) this.onViewChanged(viewName);
  }

  initElements() {
    this.channelsListEl = document.getElementById('fcChannelsList');
    this.chatMessagesEl = document.getElementById('fcChatMessages');
    this.chatFormEl = document.getElementById('fcChatForm');
    this.chatInputEl = document.getElementById('fcChatInput');
    this.rosterListEl = document.getElementById('fcRosterList');
    this.challengeIncomingModal = document.getElementById('fcChallengeIncomingModal');
  }

  bindEvents() {
    // View navigation tabs
    const tabLobby = document.getElementById('viewLobbyBtn');
    const tabArena = document.getElementById('viewArenaBtn');
    const btnBackLobby = document.getElementById('btnArenaBackToLobby');

    if (tabLobby) tabLobby.addEventListener('click', () => this.switchView('lobby'));
    if (tabArena) tabArena.addEventListener('click', () => this.switchView('arena'));
    if (btnBackLobby) btnBackLobby.addEventListener('click', () => this.switchView('lobby'));

    // Channel search input
    const searchInput = document.getElementById('channelSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.renderChannels(e.target.value.toLowerCase().trim());
      });
    }

    // Chat form submit
    if (this.chatFormEl) {
      this.chatFormEl.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.chatInputEl.value.trim();
        if (text) {
          this.sendUserChatMessage(text);
          this.chatInputEl.value = '';
        }
      });
    }

    // Roster filter tabs
    const filterTabs = document.querySelectorAll('.fc-roster-tabs .fc-tab-btn');
    filterTabs.forEach(btn => {
      btn.addEventListener('click', () => {
        filterTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeRosterFilter = btn.dataset.filter || 'all';
        this.renderRoster();
      });
    });

    // Self username input
    const nameInput = document.getElementById('fcSelfNameInput');
    if (nameInput) {
      nameInput.value = this.userName;
      nameInput.addEventListener('change', (e) => {
        this.userName = e.target.value.trim() || 'Mario_Speed';
        localStorage.setItem('fc_username', this.userName);
        this.updateSelfDisplay();
      });
    }

    // Banner Quick Actions
    const btnPractice = document.getElementById('btnPlayPractice');
    if (btnPractice) {
      btnPractice.addEventListener('click', () => {
        this.onStartPractice('BOT');
        this.switchView('arena');
      });
    }

    const btnP2P = document.getElementById('btnCreateChallenge');
    if (btnP2P) {
      btnP2P.addEventListener('click', () => {
        this.onCreateP2PRoom();
      });
    }

    const romStatusBtn = document.getElementById('bannerRomStatus');
    if (romStatusBtn) {
      romStatusBtn.addEventListener('click', () => {
        this.onOpenRomCache();
      });
    }

    // Challenge Modal buttons
    const btnAccept = document.getElementById('fcAcceptChallengeBtn');
    const btnDecline = document.getElementById('fcDeclineChallengeBtn');

    if (btnAccept) {
      btnAccept.addEventListener('click', () => {
        this.closeChallengeModal();
        fcSound.playChallengeAccept();
        if (this.pendingChallenge && this.pendingChallenge.onAccept) {
          this.pendingChallenge.onAccept();
        }
        this.switchView('arena');
      });
    }

    if (btnDecline) {
      btnDecline.addEventListener('click', () => {
        this.closeChallengeModal();
        if (this.pendingChallenge && this.pendingChallenge.onDecline) {
          this.pendingChallenge.onDecline();
        }
      });
    }
  }

  render() {
    this.renderChannels();
    this.renderBanner();
    this.renderChatMessages();
    this.renderRoster();
    this.updateSelfDisplay();
  }

  renderChannels(filterText = '') {
    if (!this.channelsListEl) return;
    const profiles = getAllGameProfiles();
    this.channelsListEl.innerHTML = '';

    profiles.forEach(profile => {
      if (filterText && !profile.name.toLowerCase().includes(filterText) && !profile.system.toLowerCase().includes(filterText)) {
        return;
      }

      const isCached = this.cachedGames.has(profile.id);
      const isActive = profile.id === this.activeGameId;
      const playerCount = (this.channelPlayers[profile.id] || []).length + 1; // +1 for self

      const item = document.createElement('div');
      item.className = `fc-channel-item ${isActive ? 'active' : ''}`;
      item.dataset.gameId = profile.id;

      let icon = '🍄';
      if (profile.id === 'smw') icon = '🦖';
      if (profile.id.startsWith('sonic')) icon = '🦔';

      item.innerHTML = `
        <div class="channel-icon-box sys-${profile.system.toLowerCase()}">
          <span class="channel-icon">${icon}</span>
        </div>
        <div class="channel-meta">
          <div class="channel-title-row">
            <span class="channel-title">${profile.name}</span>
          </div>
          <div class="channel-tags-row">
            <span class="fc-badge-sys sys-${profile.system.toLowerCase()}">${profile.systemBadge}</span>
            <span class="fc-badge-count">👥 ${playerCount}</span>
            <span class="fc-badge-rom ${isCached ? 'cached' : 'missing'}">
              ${isCached ? '💾 CACHED' : '⚠️ NO ROM'}
            </span>
          </div>
        </div>
      `;

      item.addEventListener('click', () => {
        if (this.activeGameId !== profile.id) {
          this.onGameSelected(profile.id);
        }
      });

      this.channelsListEl.appendChild(item);
    });

    const countTag = document.getElementById('totalGamesCount');
    if (countTag) countTag.textContent = profiles.length;
  }

  renderBanner() {
    const profile = getGameProfile(this.activeGameId);
    if (!profile) return;

    // Header bar breadcrumbs
    const headerSys = document.getElementById('fcCurrentSysBadge');
    const headerTitle = document.getElementById('fcCurrentGameTitle');
    if (headerSys) {
      headerSys.textContent = profile.systemBadge;
      headerSys.className = `fc-current-sys sys-${profile.system.toLowerCase()}`;
    }
    if (headerTitle) {
      headerTitle.textContent = profile.name;
    }

    // Banner elements
    const bannerSys = document.getElementById('bannerSysBadge');
    const bannerTitle = document.getElementById('bannerGameTitle');
    const bannerDesc = document.getElementById('bannerGameDesc');
    const chatInput = document.getElementById('fcChatInput');

    if (bannerSys) {
      bannerSys.textContent = profile.systemBadge;
      bannerSys.className = `fc-game-sys-badge sys-${profile.system.toLowerCase()}`;
    }
    if (bannerTitle) bannerTitle.textContent = profile.name;
    if (bannerDesc) {
      if (profile.id === 'smb1') {
        bannerDesc.textContent = '1v1 Speedrun en tiempo real. Ambos corren como Mario (tú sólido, tu rival como fantasma traslúcido).';
      } else if (profile.id === 'smw') {
        bannerDesc.textContent = 'Super Mario World 16-bit. Sincronización P2P a 60 FPS con rival fantasma Mario.';
      } else {
        bannerDesc.textContent = `${profile.name} en Sega Genesis. Corre a toda velocidad contra el fantasma de tu rival.`;
      }
    }
    if (chatInput) {
      chatInput.placeholder = `Escribe un mensaje o desafío en #${profile.id}...`;
    }

    this.updateBannerRomStatus();
  }

  updateBannerRomStatus() {
    const statusEl = document.getElementById('bannerRomStatus');
    if (!statusEl) return;
    const isCached = this.cachedGames.has(this.activeGameId);
    if (isCached) {
      statusEl.textContent = '💾 ROM CACHEADA';
      statusEl.className = 'fc-rom-status-badge cached';
      statusEl.title = 'ROM guardada permanentemente en IndexedDB. Clic para cambiarla.';
    } else {
      statusEl.textContent = '⚠️ ARRASTRA TU ROM';
      statusEl.className = 'fc-rom-status-badge missing';
      statusEl.title = 'Arrastra tu archivo ROM o haz clic aquí para seleccionarlo.';
    }
  }

  renderChatMessages() {
    if (!this.chatMessagesEl) return;
    this.chatMessagesEl.innerHTML = '';
    const messages = this.channelChats[this.activeGameId] || [];

    messages.forEach(msg => {
      const msgRow = document.createElement('div');

      if (msg.type === 'system') {
        msgRow.className = 'fc-chat-msg system';
        msgRow.innerHTML = `
          <span class="msg-time">[${msg.time}]</span>
          <span class="msg-sys-tag">⚡ SISTEMA:</span>
          <span class="msg-text">${msg.text}</span>
        `;
      } else if (msg.type === 'result') {
        msgRow.className = 'fc-chat-msg result';
        msgRow.innerHTML = `
          <span class="msg-time">[${msg.time}]</span>
          <span class="msg-trophy">🏆 RESULTADO:</span>
          <span class="msg-text"><strong>${msg.winner}</strong> venció a <strong>${msg.loser}</strong> con tiempo récord de <span class="time-tag">${msg.timeText}</span>!</span>
        `;
      } else if (msg.type === 'challenge') {
        msgRow.className = 'fc-chat-msg challenge';
        msgRow.innerHTML = `
          <span class="msg-time">[${msg.time}]</span>
          <span class="msg-sword">⚔️ DESAFÍO:</span>
          <span class="msg-text"><strong>${msg.challenger}</strong> ha desafiado a <strong>${msg.target}</strong> a una carrera speedrun!</span>
        `;
      } else {
        const isSelf = msg.sender === this.userName;
        msgRow.className = `fc-chat-msg user ${isSelf ? 'self' : ''}`;
        msgRow.innerHTML = `
          <span class="msg-avatar">${msg.avatar || '🍄'}</span>
          <div class="msg-body">
            <div class="msg-author-row">
              <span class="msg-author ${isSelf ? 'self-name' : ''}">${msg.sender}</span>
              <span class="msg-time">${msg.time}</span>
            </div>
            <div class="msg-text">${msg.text}</div>
          </div>
        `;
      }

      this.chatMessagesEl.appendChild(msgRow);
    });

    // Auto-scroll to bottom
    this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
  }

  sendUserChatMessage(text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = {
      type: 'user',
      sender: this.userName,
      avatar: '🍄',
      text,
      time
    };

    if (!this.channelChats[this.activeGameId]) {
      this.channelChats[this.activeGameId] = [];
    }
    this.channelChats[this.activeGameId].push(msg);
    this.renderChatMessages();
    fcSound.playChatNotification();

    if (this.onChatMessage) {
      this.onChatMessage(msg);
    }
  }

  addMatchResult(winner, loser, timeText) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = {
      type: 'result',
      winner,
      loser,
      timeText,
      time
    };
    if (!this.channelChats[this.activeGameId]) {
      this.channelChats[this.activeGameId] = [];
    }
    this.channelChats[this.activeGameId].push(msg);
    this.renderChatMessages();
  }

  renderRoster() {
    if (!this.rosterListEl) return;
    this.rosterListEl.innerHTML = '';

    const players = this.channelPlayers[this.activeGameId] || [];

    // Filter by tab
    const filtered = players.filter(p => {
      if (this.activeRosterFilter === 'ready') return p.status === 'ready';
      if (this.activeRosterFilter === 'playing') return p.status === 'playing';
      return true;
    });

    // Update Tab Counts
    const countAll = document.getElementById('tabCountAll');
    const countReady = document.getElementById('tabCountReady');
    const countPlaying = document.getElementById('tabCountPlaying');
    const onlineTotal = document.getElementById('fcOnlineCount');

    const total = players.length + 1; // including self
    const readyCount = players.filter(p => p.status === 'ready').length + 1;
    const playingCount = players.filter(p => p.status === 'playing').length;

    if (countAll) countAll.textContent = total;
    if (countReady) countReady.textContent = readyCount;
    if (countPlaying) countPlaying.textContent = playingCount;
    if (onlineTotal) onlineTotal.textContent = total;

    // Render Self Item at top
    const selfItem = document.createElement('div');
    selfItem.className = 'fc-roster-item self-item';
    selfItem.innerHTML = `
      <div class="roster-avatar-box">
        <span class="roster-avatar">🍄</span>
        <span class="roster-status-dot online"></span>
      </div>
      <div class="roster-info">
        <div class="roster-name-row">
          <span class="roster-name">${this.userName} (TÚ)</span>
          <span class="roster-flag">🇲🇽</span>
        </div>
        <div class="roster-role-row">
          <span class="roster-role">Mario (Sólido)</span>
          <span class="roster-ping">🟢 0ms</span>
        </div>
      </div>
      <div class="roster-action">
        <span class="badge-self">LOCAL</span>
      </div>
    `;
    this.rosterListEl.appendChild(selfItem);

    // Render other players
    filtered.forEach(player => {
      const item = document.createElement('div');
      item.className = `fc-roster-item ${player.status}`;

      const statusLabel = player.status === 'ready' ? 'Listo' : (player.status === 'playing' ? 'En Carrera' : 'Ausente');
      const pingClass = player.ping < 30 ? 'good' : 'fair';

      item.innerHTML = `
        <div class="roster-avatar-box">
          <span class="roster-avatar">${player.avatar}</span>
          <span class="roster-status-dot ${player.status}"></span>
        </div>
        <div class="roster-info">
          <div class="roster-name-row">
            <span class="roster-name">${player.name}</span>
            <span class="roster-flag">${player.flag}</span>
          </div>
          <div class="roster-role-row">
            <span class="roster-role">${player.role}</span>
            <span class="roster-ping ${pingClass}">🟢 ${player.ping}ms</span>
          </div>
        </div>
        <div class="roster-action">
          <button class="btn-fc-challenge" data-player-id="${player.id}">
            ⚡ DESAFIAR
          </button>
        </div>
      `;

      const challengeBtn = item.querySelector('.btn-fc-challenge');
      if (challengeBtn) {
        challengeBtn.addEventListener('click', () => {
          this.triggerChallengeOffer(player);
        });
      }

      this.rosterListEl.appendChild(item);
    });
  }

  triggerChallengeOffer(player) {
    fcSound.playChallengeAlert();

    // Broadcast challenge to chat feed
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.channelChats[this.activeGameId].push({
      type: 'challenge',
      challenger: this.userName,
      target: player.name,
      time
    });
    this.renderChatMessages();

    // Notify user of outgoing challenge
    const bannerDesc = document.getElementById('bannerGameDesc');
    const originalText = bannerDesc ? bannerDesc.textContent : '';
    if (bannerDesc) {
      bannerDesc.innerHTML = `<span style="color: #fca044;">⚔️ Enviando desafío a <strong>${player.name}</strong>... esperando confirmación...</span>`;
    }

    // If bot or simulated player: simulate acceptance with audio cue and arena transition
    setTimeout(() => {
      fcSound.playChallengeAccept();
      if (bannerDesc) bannerDesc.textContent = originalText;

      // Add chat confirmation
      this.channelChats[this.activeGameId].push({
        type: 'system',
        text: `¡${player.name} aceptó tu desafío! Iniciando carrera 1v1 en ${getGameProfile(this.activeGameId).name}...`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      this.renderChatMessages();

      // Launch into arena
      if (this.onChallengePlayer) {
        this.onChallengePlayer(player);
      }
      this.switchView('arena');
    }, 1200);
  }

  showIncomingChallenge(challenger, onAccept, onDecline) {
    this.pendingChallenge = { challenger, onAccept, onDecline };
    fcSound.playChallengeAlert();

    const avatarEl = document.getElementById('challengerAvatar');
    const nameEl = document.getElementById('challengerName');
    const gameNameEl = document.getElementById('challengeGameName');
    const timerBar = document.getElementById('challengeTimerBar');

    if (avatarEl) avatarEl.textContent = challenger.avatar || '🍄';
    if (nameEl) nameEl.textContent = challenger.name || 'Rival Online';
    if (gameNameEl) gameNameEl.textContent = getGameProfile(this.activeGameId).name;

    if (this.challengeIncomingModal) {
      if (typeof this.challengeIncomingModal.showModal === 'function') {
        this.challengeIncomingModal.showModal();
      } else if (typeof this.challengeIncomingModal.setAttribute === 'function') {
        this.challengeIncomingModal.setAttribute('open', 'true');
      }
    }

    // Animate 15s timer bar
    if (timerBar) {
      timerBar.style.transition = 'none';
      timerBar.style.width = '100%';
      setTimeout(() => {
        timerBar.style.transition = 'width 15s linear';
        timerBar.style.width = '0%';
      }, 50);
    }

    // Auto-decline after 15s
    if (this.challengeTimeout) clearTimeout(this.challengeTimeout);
    this.challengeTimeout = setTimeout(() => {
      this.closeChallengeModal();
      if (onDecline) onDecline();
    }, 15000);
  }

  closeChallengeModal() {
    if (this.challengeTimeout) clearTimeout(this.challengeTimeout);
    if (this.challengeIncomingModal) {
      if (typeof this.challengeIncomingModal.close === 'function') {
        this.challengeIncomingModal.close();
      } else if (typeof this.challengeIncomingModal.removeAttribute === 'function') {
        this.challengeIncomingModal.removeAttribute('open');
      }
    }
  }

  updateSelfDisplay() {
    if (typeof document !== 'undefined' && document.querySelector) {
      const userPillName = document.querySelector('#fcLocalUserPill .fc-username');
      if (userPillName) userPillName.textContent = `${this.userName} [TÚ]`;
    }
  }
}
