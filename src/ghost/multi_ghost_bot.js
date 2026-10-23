// multi_ghost_bot.js - Autonomous Speedrun Practice Bots for SMB1, SMW, Sonic 1, 2, 3&K
import { GAME_IDS } from '../profiles/game_profiles.js';
import { GhostBot as Smb1Bot } from './ghost_bot.js';

// Super Mario World Speedrun Bot
export class SmwBot {
  constructor() {
    this.reset();
  }

  reset() {
    this.jumpTimer = 0;
    this.cooldown = 0;
  }

  update(snesRunner) {
    if (!snesRunner || !snesRunner.wram) return;
    const x = snesRunner.getWord(0x0094);
    const finished = snesRunner.wram[0x1493] > 0;
    if (finished) return;

    // Obstacle jump locations in Yoshi's Island 1
    const jumpPoints = [
      [300, 320],   // Chargin' Chuck 1
      [750, 770],   // First pipe / Rex
      [1200, 1220], // Banzai Bill approach
      [1800, 1820], // Second pipe gap
      [2350, 2370], // Rex cluster
      [2850, 2870], // Final platform
      [3450, 3480]  // Leap into goal tape
    ];

    let needJump = false;
    for (const [jx0, jx1] of jumpPoints) {
      if (x >= jx0 && x <= jx1 && this.cooldown === 0 && snesRunner.isGrounded) {
        needJump = true;
        break;
      }
    }

    if (needJump && this.jumpTimer === 0) {
      this.jumpTimer = 16;
      this.cooldown = 20;
    }

    if (this.cooldown > 0) this.cooldown--;

    // Always hold Right (button 7) + Run Y (button 1)
    snesRunner.buttonDown(1, 7); // Right
    snesRunner.buttonDown(1, 1); // Run Y

    if (this.jumpTimer > 0) {
      snesRunner.buttonDown(1, 0); // Jump B
      this.jumpTimer--;
    } else {
      snesRunner.buttonUp(1, 0);
    }
  }
}

// Sega Genesis Sonic Speedrun Bot (Sonic 1, 2, 3&K)
export class GenesisSonicBot {
  constructor() {
    this.reset();
  }

  reset() {
    this.jumpTimer = 0;
    this.spindashState = 0;
    this.cooldown = 0;
  }

  update(genesisRunner) {
    if (!genesisRunner || !genesisRunner.ram) return;
    const isSonic1 = (genesisRunner.gameId === GAME_IDS.SONIC1);
    const objBase = isSonic1 ? 0xD000 : 0xB000;
    const xOffset = (genesisRunner.gameId === GAME_IDS.SONIC3K) ? 0x10 : 0x08;
    const x = genesisRunner.getWord(objBase + xOffset);
    const signpost = genesisRunner.ram[0xF7C8];
    if (signpost > 0) return;

    // Green Hill / Emerald Hill jump coordinates
    const jumpZones = [
      [800, 830],    // Motobug
      [2100, 2140],  // Gap before loop
      [3900, 3940],  // Spikes
      [5800, 5840],  // High ledge spring
      [7600, 7640],  // Crabmeat
      [9200, 9240]   // Final slope jump before signpost
    ];

    let needJump = false;
    for (const [jx0, jx1] of jumpZones) {
      if (x >= jx0 && x <= jx1 && this.cooldown === 0 && genesisRunner.isGrounded) {
        needJump = true;
        break;
      }
    }

    if (needJump && this.jumpTimer === 0) {
      this.jumpTimer = 18;
      this.cooldown = 25;
    }

    if (this.cooldown > 0) this.cooldown--;

    // High momentum speedrun: Hold Right (btn 7)
    genesisRunner.buttonDown(1, 7);

    // Initial Spindash Rev (start of act)
    if (x < 180 && this.spindashState < 8) {
      genesisRunner.buttonDown(1, 5); // Down
      genesisRunner.buttonDown(1, 2); // C button
      this.spindashState++;
      return;
    } else if (this.spindashState >= 8 && x < 250) {
      genesisRunner.buttonUp(1, 5); // Release Down to unleash Spindash!
      genesisRunner.buttonUp(1, 2);
    }

    if (this.jumpTimer > 0) {
      genesisRunner.buttonDown(1, 0); // Jump A
      this.jumpTimer--;
    } else {
      genesisRunner.buttonUp(1, 0);
    }
  }
}

// Master Unified Multi-Game Ghost Bot
export class MultiGhostBot {
  constructor(gameId = GAME_IDS.SMB1) {
    this.gameId = gameId;
    this.bots = {
      [GAME_IDS.SMB1]: new Smb1Bot(),
      [GAME_IDS.SMW]: new SmwBot(),
      [GAME_IDS.SONIC1]: new GenesisSonicBot(),
      [GAME_IDS.SONIC2]: new GenesisSonicBot(),
      [GAME_IDS.SONIC3K]: new GenesisSonicBot()
    };
  }

  setGame(gameId) {
    this.gameId = gameId;
    this.reset();
  }

  reset() {
    if (this.bots[this.gameId]) {
      this.bots[this.gameId].reset();
    }
  }

  update(runner) {
    if (!runner) return;
    const bot = this.bots[this.gameId] || this.bots[GAME_IDS.SMB1];
    bot.update(runner);
  }
}
