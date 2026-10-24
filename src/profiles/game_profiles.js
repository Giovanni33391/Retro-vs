// game_profiles.js - Speedrun Profiles and Memory Maps for Supported Games
// Supported: Super Mario Bros (NES), Super Mario World (SNES), Sonic 1, 2, 3&K (Genesis)

export const GAME_IDS = {
  SMB1: 'smb1',
  SMW: 'smw',
  SONIC1: 'sonic1',
  SONIC2: 'sonic2',
  SONIC3K: 'sonic3k'
};

export const GAME_PROFILES = {
  [GAME_IDS.SMB1]: {
    id: GAME_IDS.SMB1,
    name: 'Super Mario Bros.',
    shortName: 'SMB1',
    system: 'nes',
    systemName: 'Nintendo Entertainment System',
    systemBadge: 'NES 8-BIT',
    year: '1985',
    hero: 'MARIO [YOU]',
    rival: 'MARIO [RIVAL / BOT]',
    heroColor: '#FC3800',
    rivalColor: '#D82800',
    extensions: ['.nes'],
    defaultRom: '/smb.nes',
    width: 256,
    height: 240,
    headerHeight: 40,
    totalCanvasHeight: 280,
    trackLength: 3200, // World 1-1 flagpole
    controlsType: 'nes', // D-pad + B + A + Start + Select
    stageName: (telem) => `W${telem.world || 1}-${telem.level || 1}`,
    parseTelemetry: (mem) => {
      if (!mem) return null;
      const page = mem[0x006D] || 0;
      const subX = mem[0x0086] || 0;
      const x = page * 256 + subX;
      const y = mem[0x00CE] || 0;
      const camPage = mem[0x071A] || 0;
      const camSubX = mem[0x071C] || 0;
      const cam_x = camPage * 256 + camSubX;
      const cam_y = 0;
      const world = (mem[0x075F] || 0) + 1;
      const level = (mem[0x075C] || 0) + 1;
      const state = mem[0x001D] || 0; // 0=ground, 1=walk, 2=jump, 3=flagpole
      const isFacingLeft = (mem[0x0033] === 2 || mem[0x0045] === 2);
      const facing = isFacingLeft ? 1 : 2; // 1=left, 2=right
      const powerup = mem[0x0756] || 0;
      const sub = mem[0x000E] || 0;
      const isDead = (sub === 6 || mem[0x0770] === 2 || y > 230);
      const finished = (state === 3) || (level === 1 && x >= 3160) || (level === 4 && x >= 2250);

      return {
        gameId: GAME_IDS.SMB1,
        x,
        y,
        cam_x,
        cam_y,
        world,
        level,
        state,
        facing,
        powerup,
        isDead,
        finished
      };
    }
  },

  [GAME_IDS.SMW]: {
    id: GAME_IDS.SMW,
    name: 'Super Mario World',
    shortName: 'SMW',
    system: 'snes',
    systemName: 'Super Nintendo Entertainment System',
    systemBadge: 'SNES 16-BIT',
    year: '1990',
    hero: 'MARIO [YOU]',
    rival: 'MARIO [RIVAL / BOT]',
    heroColor: '#FC2810',
    rivalColor: '#D82800',
    extensions: ['.sfc', '.smc'],
    defaultRom: null,
    width: 256,
    height: 224,
    headerHeight: 40,
    totalCanvasHeight: 264,
    trackLength: 3550, // Yoshi's Island 1 Goal Tape
    controlsType: 'snes', // D-pad + Y + B + X + A + L + R + Start + Select
    stageName: (telem) => `YI-${telem.level || 1}`,
    parseTelemetry: (wram) => {
      if (!wram) return null;
      // WRAM offsets: $7E:0094 (X pos 16-bit), $7E:0096 (Y pos 16-bit)
      const x = (wram[0x0094] || 0) | ((wram[0x0095] || 0) << 8);
      const y = (wram[0x0096] || 0) | ((wram[0x0097] || 0) << 8);
      const cam_x = (wram[0x001A] || 0) | ((wram[0x001B] || 0) << 8);
      const cam_y = (wram[0x001C] || 0) | ((wram[0x001D] || 0) << 8);
      const level = (wram[0x010B] || 0) + 1; // Yoshi's Island 1 = 1
      const state = wram[0x0071] || 0; // Mario action
      const facing = (wram[0x0076] === 0) ? 1 : 2; // 0=left, 1=right -> 1=left, 2=right
      const powerup = wram[0x0019] || 0; // 0=small, 1=super, 2=cape, 3=fire
      const endTimer = wram[0x1493] || 0;
      const finished = endTimer > 0 || x >= 3550;

      return {
        gameId: GAME_IDS.SMW,
        x,
        y,
        cam_x,
        cam_y,
        world: 1,
        level,
        state,
        facing,
        powerup,
        finished
      };
    }
  },

  [GAME_IDS.SONIC1]: {
    id: GAME_IDS.SONIC1,
    name: 'Sonic the Hedgehog',
    shortName: 'SONIC 1',
    system: 'genesis',
    systemName: 'Sega Genesis / Mega Drive',
    systemBadge: 'GENESIS 16-BIT',
    year: '1991',
    hero: 'Sonic',
    rival: 'Tails',
    heroColor: '#0070EC',
    rivalColor: '#FCA000',
    extensions: ['.bin', '.md', '.gen'],
    defaultRom: null,
    width: 320,
    height: 224,
    headerHeight: 40,
    totalCanvasHeight: 264,
    trackLength: 10600, // Green Hill Zone 1 Signpost (~0x2960 = 10592 px)
    controlsType: 'genesis', // D-pad + A + B + C + Start
    stageName: (telem) => {
      const zones = ['GHZ', 'MZ', 'SYZ', 'LZ', 'SLZ', 'SBZ', 'FZ'];
      const zoneName = zones[telem.world - 1] || 'ZONE';
      return `${zoneName}-${telem.level || 1}`;
    },
    parseTelemetry: (ram) => {
      if (!ram) return null;
      // Sonic 1 Player Object at $D000: X at $D008 (word), Y at $D00C (word)
      const x = ((ram[0xD008] || 0) << 8) | (ram[0xD009] || 0);
      const y = ((ram[0xD00C] || 0) << 8) | (ram[0xD00D] || 0);
      const cam_x = ((ram[0xF700] || 0) << 8) | (ram[0xF701] || 0);
      const cam_y = ((ram[0xF704] || 0) << 8) | (ram[0xF705] || 0);
      const world = (ram[0xFE10] || 0) + 1; // Zone
      const level = (ram[0xFE11] || 0) + 1; // Act
      const status = ram[0xD022] || 0;
      const facing = (status & 0x01) ? 1 : 2; // bit 0: 1=left, 0=right
      const inAir = (status & 0x02) ? 1 : 0;
      const anim = ram[0xD01C] || 0; // 0=walk, 1=run, 2=roll
      const signpost = ram[0xF7C8] || 0;
      const finished = signpost > 0 || (world === 1 && x >= 10590);

      return {
        gameId: GAME_IDS.SONIC1,
        x,
        y,
        cam_x,
        cam_y,
        world,
        level,
        state: inAir ? 2 : (anim === 2 ? 3 : (anim === 1 ? 1 : 0)),
        facing,
        powerup: 0,
        finished
      };
    }
  },

  [GAME_IDS.SONIC2]: {
    id: GAME_IDS.SONIC2,
    name: 'Sonic the Hedgehog 2',
    shortName: 'SONIC 2',
    system: 'genesis',
    systemName: 'Sega Genesis / Mega Drive',
    systemBadge: 'GENESIS 16-BIT',
    year: '1992',
    hero: 'Sonic',
    rival: 'Tails',
    heroColor: '#0070EC',
    rivalColor: '#FCA000',
    extensions: ['.bin', '.md', '.gen'],
    defaultRom: null,
    width: 320,
    height: 224,
    headerHeight: 40,
    totalCanvasHeight: 264,
    trackLength: 10600, // Emerald Hill Zone 1 Signpost (~0x2950)
    controlsType: 'genesis',
    stageName: (telem) => {
      const zones = ['EHZ', 'CPZ', 'ARZ', 'CNZ', 'HTZ', 'MCZ', 'OOZ', 'MPZ', 'SCZ', 'WFZ', 'DEZ'];
      const zoneName = zones[telem.world - 1] || 'EHZ';
      return `${zoneName}-${telem.level || 1}`;
    },
    parseTelemetry: (ram) => {
      if (!ram) return null;
      // Sonic 2 Player 1 Object at $B000: X at $B008, Y at $B00C
      const x = ((ram[0xB008] || 0) << 8) | (ram[0xB009] || 0);
      const y = ((ram[0xB00C] || 0) << 8) | (ram[0xB00D] || 0);
      const cam_x = ((ram[0xEE00] || 0) << 8) | (ram[0xEE01] || 0);
      const cam_y = ((ram[0xEE04] || 0) << 8) | (ram[0xEE05] || 0);
      const world = (ram[0xFE10] || 0) + 1; // Zone
      const level = (ram[0xFE11] || 0) + 1; // Act
      const status = ram[0xB022] || 0;
      const facing = (status & 0x01) ? 1 : 2;
      const inAir = (status & 0x02) ? 1 : 0;
      const anim = ram[0xB01C] || 0;
      const signpost = ram[0xF7C8] || 0;
      const finished = signpost > 0 || (world === 1 && x >= 10580);

      return {
        gameId: GAME_IDS.SONIC2,
        x,
        y,
        cam_x,
        cam_y,
        world,
        level,
        state: inAir ? 2 : (anim === 2 ? 3 : (anim === 1 ? 1 : 0)),
        facing,
        powerup: 0,
        finished
      };
    }
  },

  [GAME_IDS.SONIC3K]: {
    id: GAME_IDS.SONIC3K,
    name: 'Sonic 3 & Knuckles',
    shortName: 'SONIC 3&K',
    system: 'genesis',
    systemName: 'Sega Genesis / Mega Drive',
    systemBadge: 'GENESIS 16-BIT',
    year: '1994',
    hero: 'Sonic',
    rival: 'Knuckles',
    heroColor: '#0070EC',
    rivalColor: '#E42020',
    extensions: ['.bin', '.md', '.gen'],
    defaultRom: null,
    width: 320,
    height: 224,
    headerHeight: 40,
    totalCanvasHeight: 264,
    trackLength: 11200, // Angel Island Zone 1 Signpost (~0x2B80)
    controlsType: 'genesis',
    stageName: (telem) => {
      const zones = ['AIZ', 'HCZ', 'MGZ', 'CNZ', 'ICZ', 'LBZ', 'MHZ', 'FBZ', 'SOZ', 'LRZ', 'SSZ', 'DEZ'];
      const zoneName = zones[telem.world - 1] || 'AIZ';
      return `${zoneName}-${telem.level || 1}`;
    },
    parseTelemetry: (ram) => {
      if (!ram) return null;
      // Sonic 3 Player 1 at $B000: X at $B010 (or $B008), Y at $B014 (or $B00C)
      let x = ((ram[0xB010] || 0) << 8) | (ram[0xB011] || 0);
      if (x === 0) x = ((ram[0xB008] || 0) << 8) | (ram[0xB009] || 0);
      let y = ((ram[0xB014] || 0) << 8) | (ram[0xB015] || 0);
      if (y === 0) y = ((ram[0xB00C] || 0) << 8) | (ram[0xB00D] || 0);

      const cam_x = ((ram[0xEE00] || 0) << 8) | (ram[0xEE01] || 0);
      const cam_y = ((ram[0xEE04] || 0) << 8) | (ram[0xEE05] || 0);
      const world = (ram[0xFE10] || 0) + 1; // Zone
      const level = (ram[0xFE11] || 0) + 1; // Act
      const status = ram[0xB02A] || ram[0xB022] || 0;
      const facing = (status & 0x01) ? 1 : 2;
      const inAir = (status & 0x02) ? 1 : 0;
      const anim = ram[0xB020] || ram[0xB01C] || 0;
      const signpost = ram[0xF7C8] || 0;
      const finished = signpost > 0 || (world === 1 && x >= 11150);

      return {
        gameId: GAME_IDS.SONIC3K,
        x,
        y,
        cam_x,
        cam_y,
        world,
        level,
        state: inAir ? 2 : (anim === 2 ? 3 : (anim === 1 ? 1 : 0)),
        facing,
        powerup: 0,
        finished
      };
    }
  }
};

export function getGameProfile(gameId) {
  return GAME_PROFILES[gameId] || GAME_PROFILES[GAME_IDS.SMB1];
}

export function getAllGameProfiles() {
  return Object.values(GAME_PROFILES);
}

export function detectGameFromFileName(fileName, buffer = null) {
  if (!fileName) return GAME_IDS.SMB1;
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.nes')) {
    return GAME_IDS.SMB1;
  }

  if (lower.endsWith('.sfc') || lower.endsWith('.smc')) {
    return GAME_IDS.SMW;
  }

  if (lower.endsWith('.bin') || lower.endsWith('.md') || lower.endsWith('.gen')) {
    if (lower.includes('sonic 3') || lower.includes('sonic3') || lower.includes('knuckles')) {
      return GAME_IDS.SONIC3K;
    }
    if (lower.includes('sonic 2') || lower.includes('sonic2')) {
      return GAME_IDS.SONIC2;
    }
    if (lower.includes('sonic 1') || lower.includes('sonic1') || lower.includes('sonic')) {
      return GAME_IDS.SONIC1;
    }

    // Inspect Genesis ROM header at offset 0x120 - 0x150 for game title
    if (buffer && buffer.length > 0x150) {
      let headerText = '';
      for (let i = 0x120; i < 0x150; i++) {
        const byte = buffer[i] || (typeof buffer.charCodeAt === 'function' ? buffer.charCodeAt(i) : 0);
        if (byte >= 32 && byte <= 126) headerText += String.fromCharCode(byte);
      }
      const upper = headerText.toUpperCase();
      if (upper.includes('SONIC 3') || upper.includes('KNUCKLES')) return GAME_IDS.SONIC3K;
      if (upper.includes('SONIC 2')) return GAME_IDS.SONIC2;
      if (upper.includes('SONIC')) return GAME_IDS.SONIC1;
    }

    return GAME_IDS.SONIC1;
  }

  return GAME_IDS.SMB1;
}
