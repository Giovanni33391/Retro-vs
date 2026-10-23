// webrtc_sync.js - WebRTC P2P DataChannel synchronization for Ghost Runner
import Peer from 'peerjs';

export const CHALLENGE_STATES = {
  LOBBY: 'LOBBY',
  WAITING_RIVAL: 'WAITING_RIVAL',
  RIVAL_CONNECTED: 'RIVAL_CONNECTED',
  READY: 'READY',
  COUNTDOWN: 'COUNTDOWN',
  RACING: 'RACING',
  FINISHED: 'FINISHED'
};

export class WebRtcSync {
  constructor(options = {}) {
    this.peer = null;
    this.conn = null;
    this.roomCode = null;
    this.gameId = options.gameId || 'smb1';
    this.isHost = false;
    this.isConnected = false;
    this.pingMs = 0;

    // Challenge flow state
    this.challengeState = CHALLENGE_STATES.LOBBY;
    this.localReady = false;
    this.remoteReady = false;
    this.countdownValue = 0;

    // Callbacks
    this.onConnected = options.onConnected || null;
    this.onDisconnected = options.onDisconnected || null;
    this.onGhostData = options.onGhostData || null;
    this.onStatus = options.onStatus || null;
    this.onChallengeStateChange = options.onChallengeStateChange || null;
    this.onCountdownTick = options.onCountdownTick || null;
    this.onRivalFinished = options.onRivalFinished || null;
    this.onGameSwitchRequested = options.onGameSwitchRequested || null;

    // Ghost state interpolation buffer
    this.remoteState = null;
    this.targetState = null;
    this.lastPacketTime = 0;
  }

  setChallengeState(newState) {
    this.challengeState = newState;
    this.logStatus(`Challenge State: ${newState}`);
    if (this.onChallengeStateChange) {
      this.onChallengeStateChange(newState, {
        localReady: this.localReady,
        remoteReady: this.remoteReady,
        countdown: this.countdownValue
      });
    }
  }

  logStatus(msg) {
    if (this.onStatus) this.onStatus(msg);
  }

  formatRoomCode(code) {
    const raw = (code || Math.floor(1000 + Math.random() * 9000).toString()).toUpperCase();
    if (!raw.startsWith('SPEED-')) {
      return `SPEED-${raw}`;
    }
    return raw;
  }

  toPeerId(formattedCode) {
    const sanitized = formattedCode.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    return `spdv1-${sanitized}`;
  }

  // Create a room (Host)
  createRoom(customCode = null, gameId = null) {
    if (gameId) this.gameId = gameId;
    const code = this.formatRoomCode(customCode);
    this.roomCode = code;
    this.isHost = true;
    this.localReady = false;
    this.remoteReady = false;
    this.setChallengeState(CHALLENGE_STATES.WAITING_RIVAL);

    const peerId = this.toPeerId(code);
    this.logStatus(`Creating room ${code}...`);
    this.initPeer(peerId);
    return code;
  }

  // Join a room (Guest)
  joinRoom(code, gameId = null) {
    if (gameId) this.gameId = gameId;
    const formattedCode = this.formatRoomCode(code);
    this.roomCode = formattedCode;
    this.isHost = false;
    this.localReady = false;
    this.remoteReady = false;
    this.setChallengeState(CHALLENGE_STATES.WAITING_RIVAL);

    const guestPeerId = `spdg-${Math.floor(1000 + Math.random() * 9000)}`;
    const hostPeerId = this.toPeerId(formattedCode);

    this.logStatus(`Joining room ${formattedCode}...`);
    this.initPeer(guestPeerId, () => {
      this.connectToHost(hostPeerId);
    });
    return formattedCode;
  }

  initPeer(peerId, onOpenCallback) {
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
    }

    this.peer = new Peer(peerId, {
      debug: 1
    });

    this.peer.on('open', (id) => {
      this.logStatus(`Peer opened (${id})`);
      if (onOpenCallback) onOpenCallback();
    });

    this.peer.on('connection', (connection) => {
      this.logStatus(`Incoming connection from rival`);
      this.setupConnection(connection);
    });

    this.peer.on('error', (err) => {
      let msg = `Peer error: ${err.type || err.message}`;
      if (err.type === 'peer-unavailable') {
        msg = 'No se encontró la sala especificada. Verifica el código.';
      } else if (err.type === 'unavailable-id') {
        msg = 'El código de sala ya está en uso o no disponible.';
      }
      this.logStatus(msg);
    });
  }

  connectToHost(hostId) {
    this.logStatus(`Connecting to host...`);
    const connection = this.peer.connect(hostId, {
      reliable: false // UDP-like low latency DataChannel for 60Hz telemetry
    });
    this.setupConnection(connection);
  }

  setupConnection(connection) {
    this.conn = connection;

    this.conn.on('open', () => {
      this.isConnected = true;
      this.setChallengeState(CHALLENGE_STATES.RIVAL_CONNECTED);
      this.logStatus(`Rival connected to room ${this.roomCode}!`);

      // Exchange initial handshake with gameId
      this.conn.send({
        type: 'handshake',
        gameId: this.gameId
      });

      if (this.onConnected) this.onConnected(this.roomCode);

      // Heartbeat ping
      this.pingInterval = setInterval(() => {
        if (this.conn && this.conn.open) {
          this.conn.send({ type: 'ping', t: performance.now() });
        }
      }, 2000);
    });

    this.conn.on('data', (data) => {
      if (!data) return;

      switch (data.type) {
        case 'ping':
          if (this.conn && this.conn.open) this.conn.send({ type: 'pong', t: data.t });
          break;

        case 'pong':
          this.pingMs = Math.round(performance.now() - data.t);
          break;

        case 'handshake':
        case 'game_switch':
          if (data.gameId && data.gameId !== this.gameId) {
            this.logStatus(`Switching game to match rival: ${data.gameId}`);
            this.gameId = data.gameId;
            if (this.onGameSwitchRequested) this.onGameSwitchRequested(data.gameId);
          }
          break;

        case 'ready':
          this.remoteReady = data.ready;
          this.logStatus(`Rival ready: ${data.ready ? 'YES' : 'NO'}`);
          this.checkBothReady();
          break;

        case 'countdown_start':
          this.startCountdown(data.serverTime);
          break;

        case 'telemetry':
          this.handleTelemetry(data);
          break;

        case 'finished':
          if (this.onRivalFinished) {
            this.onRivalFinished(data);
          }
          break;

        case 'rematch':
          this.resetForRematch();
          break;
      }
    });

    this.conn.on('close', () => {
      this.isConnected = false;
      this.setChallengeState(CHALLENGE_STATES.WAITING_RIVAL);
      this.logStatus(`Rival disconnected.`);
      if (this.pingInterval) clearInterval(this.pingInterval);
      if (this.onDisconnected) this.onDisconnected();
    });

    this.conn.on('error', (err) => {
      this.logStatus(`Connection error: ${err.message}`);
    });
  }

  // Toggle local ready state
  toggleReady(readyStatus = null) {
    this.localReady = (readyStatus !== null) ? readyStatus : !this.localReady;
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'ready', ready: this.localReady });
    }
    this.setChallengeState(this.localReady ? CHALLENGE_STATES.READY : CHALLENGE_STATES.RIVAL_CONNECTED);
    this.checkBothReady();
    return this.localReady;
  }

  checkBothReady() {
    if (this.localReady && this.remoteReady) {
      if (this.isHost) {
        // Host triggers synchronized countdown
        const now = performance.now();
        if (this.conn && this.conn.open) {
          this.conn.send({ type: 'countdown_start', serverTime: now });
        }
        this.startCountdown(now);
      }
    }
  }

  startCountdown(refTime = performance.now()) {
    this.setChallengeState(CHALLENGE_STATES.COUNTDOWN);
    this.countdownValue = 3;
    if (this.onCountdownTick) this.onCountdownTick(3);

    const interval = setInterval(() => {
      this.countdownValue--;
      if (this.countdownValue > 0) {
        if (this.onCountdownTick) this.onCountdownTick(this.countdownValue);
      } else {
        clearInterval(interval);
        if (this.onCountdownTick) this.onCountdownTick('¡GO!');
        this.setChallengeState(CHALLENGE_STATES.RACING);
      }
    }, 1000);
  }

  sendTelemetry(telemetry) {
    if (!this.isConnected || !this.conn || !this.conn.open || !telemetry) return;

    this.conn.send({
      type: 'telemetry',
      x: telemetry.x,
      y: telemetry.y,
      cam_x: telemetry.cam_x,
      cam_y: telemetry.cam_y,
      state: telemetry.state,
      facing: telemetry.facing,
      powerup: telemetry.powerup,
      world: telemetry.world,
      level: telemetry.level,
      finished: telemetry.finished,
      t: performance.now()
    });

    if (telemetry.finished && this.challengeState === CHALLENGE_STATES.RACING) {
      this.setChallengeState(CHALLENGE_STATES.FINISHED);
      this.conn.send({
        type: 'finished',
        x: telemetry.x,
        finished: true
      });
    }
  }

  handleTelemetry(packet) {
    this.targetState = packet;
    this.lastPacketTime = performance.now();

    if (!this.remoteState) {
      this.remoteState = { ...packet };
    }

    if (this.onGhostData) {
      this.onGhostData(this.getInterpolatedGhost());
    }
  }

  // Linear interpolation (lerp) for buttery-smooth 60fps ghost rendering
  getInterpolatedGhost() {
    if (!this.targetState) return null;
    if (!this.remoteState) {
      this.remoteState = { ...this.targetState };
      return this.remoteState;
    }

    const lerpFactor = 0.35;
    this.remoteState.x += (this.targetState.x - this.remoteState.x) * lerpFactor;
    this.remoteState.y += (this.targetState.y - this.remoteState.y) * lerpFactor;
    this.remoteState.state = this.targetState.state;
    this.remoteState.facing = this.targetState.facing;
    this.remoteState.powerup = this.targetState.powerup;
    this.remoteState.world = this.targetState.world;
    this.remoteState.level = this.targetState.level;
    this.remoteState.finished = this.targetState.finished;

    return this.remoteState;
  }

  sendGameSwitch(newGameId) {
    this.gameId = newGameId;
    if (this.isConnected && this.conn && this.conn.open) {
      this.conn.send({ type: 'game_switch', gameId: newGameId });
    }
  }

  requestRematch() {
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'rematch' });
    }
    this.resetForRematch();
  }

  resetForRematch() {
    this.localReady = false;
    this.remoteReady = false;
    this.targetState = null;
    this.remoteState = null;
    this.setChallengeState(CHALLENGE_STATES.RIVAL_CONNECTED);
  }

  disconnect() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
    this.remoteState = null;
    this.targetState = null;
    this.setChallengeState(CHALLENGE_STATES.LOBBY);
  }
}
