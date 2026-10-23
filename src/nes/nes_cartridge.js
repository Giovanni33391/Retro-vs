// nes_cartridge.js - iNES ROM parser for Mapper 0 (NROM)
export class NesCartridge {
  constructor(romBuffer) {
    const bytes = new Uint8Array(romBuffer);
    if (bytes[0] !== 0x4E || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1A) {
      throw new Error("Invalid NES ROM header: missing 'NES\\x1A'");
    }

    this.prgBanks = bytes[4]; // 16KB units
    this.chrBanks = bytes[5]; // 8KB units
    const flags6 = bytes[6];
    const flags7 = bytes[7];

    this.mirroring = (flags6 & 0x01) ? "VERTICAL" : "HORIZONTAL";
    if (flags6 & 0x08) {
      this.mirroring = "FOUR_SCREEN";
    }

    this.mapper = ((flags7 & 0xF0) | (flags6 >> 4));
    const hasTrainer = (flags6 & 0x04) !== 0;
    let offset = 16 + (hasTrainer ? 512 : 0);

    const prgSize = this.prgBanks * 16384;
    this.prgRom = bytes.slice(offset, offset + prgSize);
    offset += prgSize;

    const chrSize = this.chrBanks > 0 ? this.chrBanks * 8192 : 8192;
    if (this.chrBanks > 0) {
      this.chrRom = bytes.slice(offset, offset + chrSize);
    } else {
      // CHR RAM
      this.chrRom = new Uint8Array(8192);
      this.isChrRam = true;
    }

    console.log(`[Cartridge] Loaded Mapper ${this.mapper}, PRG: ${this.prgBanks * 16}KB, CHR: ${this.chrBanks * 8}KB, Mirroring: ${this.mirroring}`);
  }

  // CPU Memory Read ($8000 - $FFFF)
  readPrg(addr) {
    const offset = addr - 0x8000;
    if (this.prgBanks === 1) {
      // 16KB mirrored in both $8000-$BFFF and $C000-$FFFF
      return this.prgRom[offset % 16384];
    } else {
      // 32KB NROM-256
      return this.prgRom[offset % 32768];
    }
  }

  writePrg(addr, val) {
    // NROM has no PRG RAM writes (read-only)
  }

  // PPU Memory Read ($0000 - $1FFF)
  readChr(addr) {
    return this.chrRom[addr & 0x1FFF];
  }

  writeChr(addr, val) {
    if (this.isChrRam) {
      this.chrRom[addr & 0x1FFF] = val;
    }
  }
}
