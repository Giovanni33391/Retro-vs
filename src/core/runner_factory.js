// runner_factory.js - Modular Runner Factory for Multi-System Emulation
import { GAME_IDS } from '../profiles/game_profiles.js';
import { NesRunner } from './nes_runner.js';
import { SnesRunner } from './snes_runner.js';
import { GenesisRunner } from './genesis_runner.js';

export function createRunner(gameId, options = {}) {
  switch (gameId) {
    case GAME_IDS.SMB1:
      return new NesRunner(options);

    case GAME_IDS.SMW:
      return new SnesRunner(options);

    case GAME_IDS.SONIC1:
    case GAME_IDS.SONIC2:
    case GAME_IDS.SONIC3K:
      return new GenesisRunner({ ...options, gameId });

    default:
      console.warn(`[RunnerFactory] Unknown gameId '${gameId}', defaulting to SMB1.`);
      return new NesRunner(options);
  }
}
