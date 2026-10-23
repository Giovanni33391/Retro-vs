// ghost_bot.js - Autonomous Speedrun Bot for NES Super Mario Bros (Luigi Ghost Rival)
// Direct port of the proven desktop speedrun heuristics from emu_race_engine.py
// Capable of flawlessly navigating World 1-1, 1-2, 1-3, and 1-4.

export class GhostBot {
  constructor() {
    this.reset();
  }

  reset() {
    this._bot_jump_hold = 0;
    this._bot_jump_cooldown = 0;
    this._bot_prev_x = 40;
    this._bot_prev_air = 0;
    this._bot_stuck_counter = 0;
  }

  update(nesRunner) {
    if (!nesRunner || !nesRunner.mem) return;
    const mem = nesRunner.mem;

    const sub = mem[0x000E];
    const air = mem[0x001D]; // 0=ground, 1=jump, 2=fall, 3=flagpole
    const x = mem[0x006D] * 256 + mem[0x0086];
    const y = mem[0x00CE];

    // Reset bot states during loading / death / spawning
    if ([0, 4, 5, 6, 7, 11].includes(sub)) {
      this._bot_jump_hold = 0;
      this._bot_jump_cooldown = 0;
      this._bot_stuck_counter = 0;
      this._bot_prev_air = 0;
      this._bot_prev_x = 40;
      return;
    }

    const w_l = (mem[0x075F] || 0) + 1;
    const l_l = Math.max(1, Math.min(4, (mem[0x075C] || 0) + 1));
    const area_l = mem[0x074E];
    const is_underground_1_2 = (w_l === 1 && l_l === 2 && area_l === 2);

    // Landing detection: release A button immediately on ground contact
    if (air === 0 && this._bot_prev_air !== 0) {
      this._bot_jump_hold = 0;
      if (!(w_l === 1 && (l_l === 3 || l_l === 4))) {
        this._bot_jump_cooldown = 2;
      }
    }
    this._bot_prev_air = air;

    // Stuck counter (against blocks or pipes while grounded)
    if (x === this._bot_prev_x && sub === 8 && air === 0) {
      this._bot_stuck_counter++;
    } else {
      this._bot_stuck_counter = 0;
    }
    this._bot_prev_x = x;

    // If currently entering a pipe (sub === 2), hold right
    if (sub === 2) {
      this.applyInputs(nesRunner, 0x80);
      return;
    }

    let need_jump = false;
    let jump_strength = 28;

    // -----------------------------------------------------------------
    // World 1-3 Mushroom Platform Heuristics
    // -----------------------------------------------------------------
    if (w_l === 1 && l_l === 3) {
      const rules_1_3 = [
        [244, 260, 14],   // Jump over pit 1 to elevator at x=345, y=160
        [340, 356, 14],   // Jump from elevator 1 to tall mushroom
        [499, 515, 14],   // Jump to intermediate platform at x=600, y=96
        [600, 620, 18],   // Jump from x=600 to high mushroom at x=645, y=32
        [644, 654, 6],    // Short hop over two Goombas on mushroom
        [730, 745, 28],   // Full jump from x=730 to solid ground at x=946, y=128
        [1000, 1018, 28], // Jump to first scale lift at x=1111, y=112
        [1130, 1138, 28], // Jump from scale 1 over Paratroopa to x=1285, y=64
        [1295, 1306, 28], // Jump over pit to platform at x=1476, y=112
        [1500, 1512, 10], // Hop to ledge at x=1615, y=144
        [1615, 1628, 24], // Jump to platform at x=1675, y=80
        [1690, 1705, 20], // Jump over Hammer Bro at x=1721 to ground at x=1875, y=112
        [1900, 1912, 16], // Jump over final pit to ground at x=2058, y=176
        [2065, 2078, 26], // Jump over second Hammer Bro at x=2101 to stair base
        [2185, 2200, 26]  // Jump onto stairs
      ];
      for (const [rx0, rx1, rhold] of rules_1_3) {
        if (rx0 <= x && x <= rx1 && air === 0 && this._bot_jump_hold === 0 && this._bot_jump_cooldown === 0) {
          need_jump = true;
          jump_strength = rhold;
          break;
        }
      }
      if (x >= 2200 && air === 0 && this._bot_jump_hold === 0 && this._bot_jump_cooldown === 0) {
        need_jump = true;
        jump_strength = 26;
      }
    }
    // -----------------------------------------------------------------
    // World 1-4 Bowser Castle Heuristics
    // -----------------------------------------------------------------
    else if (w_l === 1 && l_l === 4) {
      const rules_1_4 = [
        [175, 200, 26],   // Lava pit 1
        [390, 415, 12],   // Hop to middle platform
        [490, 508, 26],   // Lava pit 2
        [1190, 1205, 20], // Lava pit 3
        [1315, 1332, 20], // Lava pit 4
        [1445, 1460, 20], // Lava pit 5
        [1820, 1845, 26], // Pit before Bowser
        [1940, 1960, 26], // Approach leap
        [2220, 2245, 26]  // Final leap over Bowser to axe
      ];
      for (const [rx0, rx1, rhold] of rules_1_4) {
        if (rx0 <= x && x <= rx1 && air === 0 && this._bot_jump_hold === 0 && this._bot_jump_cooldown === 0) {
          need_jump = true;
          jump_strength = rhold;
          break;
        }
      }
      // Bowser fireball reaction
      if (!need_jump && air === 0 && this._bot_jump_hold === 0 && this._bot_jump_cooldown === 0) {
        for (let s = 0; s < 5; s++) {
          if (mem[0x000F + s] !== 0) {
            const eid = mem[0x0016 + s];
            if (eid === 21) { // Bowser fireball
              const ex = mem[0x006E + s] * 256 + mem[0x0087 + s];
              const ey = mem[0x00CF + s];
              const dist = ex - x;
              if (dist > 15 && dist < 65 && Math.abs(ey - y) < 40 && x >= 1500 && x < 1800) {
                need_jump = true;
                jump_strength = 22;
                break;
              }
            }
          }
        }
      }
    }
    // -----------------------------------------------------------------
    // World 1-2 Underground Heuristics
    // -----------------------------------------------------------------
    else if (is_underground_1_2) {
      // Horizontal exit pipe tunnel: run straight right
      if (2640 <= x && x <= 2700) {
        this.applyInputs(nesRunner, 0x80 | 0x02);
        return;
      }

      let piranha_hazard = false;
      for (let s = 0; s < 5; s++) {
        if (mem[0x000F + s] !== 0) {
          const ex = mem[0x006E + s] * 256 + mem[0x0087 + s];
          const ey = mem[0x00CF + s];
          if ((1640 <= ex && ex <= 1670 && ey < 150 && x < 1650) ||
              (1735 <= ex && ex <= 1765 && ey < 140 && x < 1745) ||
              (1830 <= ex && ex <= 1860 && ey < 160 && x < 1840)) {
            piranha_hazard = true;
            break;
          }
        }
      }

      if (395 <= x && x <= 412 && air === 0) {
        need_jump = true;
        jump_strength = 26;
      } else if (880 <= x && x <= 890 && air === 0) {
        need_jump = true;
        jump_strength = 6;
      } else if (1140 <= x && x <= 1150 && air === 0) {
        need_jump = true;
        jump_strength = 20;
      } else if ((1254 <= x && x <= 1263 || 1895 <= x && x <= 1903 || 1958 <= x && x <= 1967 || 2165 <= x && x <= 2175 || 2400 <= x && x <= 2414) && air === 0) {
        need_jump = true;
        jump_strength = 28;
      } else if ((2235 <= x && x <= 2265 || 2445 <= x && x <= 2480) && air === 0) {
        need_jump = true;
        jump_strength = 28;
      } else if ((2085 <= x && x <= 2105 || 2140 <= x && x <= 2185) && air === 0) {
        need_jump = true;
        jump_strength = 28;
      } else if (this._bot_stuck_counter > 2 && air === 0) {
        if (!piranha_hazard) { need_jump = true; jump_strength = 28; }
      } else if ((1645 <= x && x <= 1675 || 1740 <= x && x <= 1770 || 1835 <= x && x <= 1865) && air === 0 && y < 160) {
        if (!piranha_hazard) { need_jump = true; jump_strength = 28; }
      } else {
        for (let s = 0; s < 5; s++) {
          if (mem[0x000F + s] !== 0) {
            const eid = mem[0x0016 + s];
            if (eid >= 36 || eid === 13) continue;
            const ex = mem[0x006E + s] * 256 + mem[0x0087 + s];
            const ey = mem[0x00CF + s];
            const dist = ex - x;
            if (-16 <= (y - ey) && (y - ey) <= 50) {
              if (840 <= x && x < 932) {}
              else if (1130 <= x && x < 1182) {}
              else if (5 < dist && dist < 42 && air === 0) {
                need_jump = true;
                jump_strength = 16;
                break;
              }
            }
          }
        }
      }
    }
    // -----------------------------------------------------------------
    // Overworld (World 1-1) Heuristics
    // -----------------------------------------------------------------
    else {
      if (this._bot_stuck_counter > 2 && air === 0) need_jump = true;
      if (615 <= x && x <= 638 && air === 0 && y < 160) need_jump = true;

      const pits = [[1104, 1136], [1376, 1424], [2448, 2480]];
      for (const [p_start, p_end] of pits) {
        if (p_start - 55 <= x && x <= p_start - 5 && air === 0) {
          need_jump = true;
          break;
        }
      }

      for (let s = 0; s < 5; s++) {
        if (mem[0x000F + s] !== 0) {
          const eid = mem[0x0016 + s];
          if (eid >= 36 || eid === 13) continue;
          const ex = mem[0x006E + s] * 256 + mem[0x0087 + s];
          const dist = ex - x;
          if (5 < dist && dist < 45 && air === 0) {
            need_jump = true;
            break;
          }
        }
      }

      if ((2110 <= x && x <= 2200 || 2880 <= x && x <= 3080) && air === 0) {
        if (this._bot_jump_cooldown === 0) need_jump = true;
      }
    }

    if (this._bot_jump_cooldown > 0) this._bot_jump_cooldown--;

    if (need_jump && this._bot_jump_hold === 0 && this._bot_jump_cooldown === 0 && air === 0) {
      this._bot_jump_hold = jump_strength;
    }

    let act = 0x80 | 0x02; // Always run Right (0x80) + B button (0x02)
    if (this._bot_jump_hold > 0) {
      act |= 0x01; // A button (Jump)
      this._bot_jump_hold--;
    }
    this.applyInputs(nesRunner, act);
  }

  applyInputs(runner, byteVal) {
    // Controller 1 buttons in jsnes:
    // 7: Right, 6: Left, 5: Down, 4: Up, 3: Start, 2: Select, 1: B, 0: A
    if (byteVal & 0x80) runner.buttonDown(1, 7); else runner.buttonUp(1, 7);
    if (byteVal & 0x40) runner.buttonDown(1, 6); else runner.buttonUp(1, 6);
    if (byteVal & 0x20) runner.buttonDown(1, 5); else runner.buttonUp(1, 5);
    if (byteVal & 0x10) runner.buttonDown(1, 4); else runner.buttonUp(1, 4);
    if (byteVal & 0x08) runner.buttonDown(1, 3); else runner.buttonUp(1, 3);
    if (byteVal & 0x04) runner.buttonDown(1, 2); else runner.buttonUp(1, 2);
    if (byteVal & 0x02) runner.buttonDown(1, 1); else runner.buttonUp(1, 1);
    if (byteVal & 0x01) runner.buttonDown(1, 0); else runner.buttonUp(1, 0);
  }
}
