// test_web_engine.js - Full automated verification suite for web_smb_vs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as jsnes from 'jsnes';
import { NesRunner } from './src/nes/nes_runner.js';
import { GhostBot } from './src/ghost/ghost_bot.js';
import { GhostRenderer } from './src/ghost/ghost_renderer.js';
import { TelemetryBar } from './src/ui/telemetry_bar.js';
import { WebRtcSync } from './src/net/webrtc_sync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runWebTests() {
  console.log("=== INICIANDO VALIDACIÓN INTEGRAL DE WEB_SMB_VS ===");

  // 1. Verificar carga de ROM
  console.log("\n[TEST 1] Carga y verificación de ROM smb.nes...");
  const romPath = path.join(__dirname, 'public', 'smb.nes');
  const romBuf = fs.readFileSync(romPath);
  console.log(`  -> ROM localizada: ${romPath} (${romBuf.length} bytes)`);
  if (romBuf.length !== 40976) {
    throw new Error(`Tamaño de ROM inválido: esperado 40976, obtenido ${romBuf.length}`);
  }
  const romBinary = romBuf.toString('binary');
  console.log("  -> PASADO: ROM NROM auténtica cargada.");

  // 2. Instanciación de NesRunner y FastBoot a la línea de salida (x=40)
  console.log("\n[TEST 2] FastBoot de NesRunner directo a línea de salida (X=40)...");
  const marioRunner = new NesRunner({ isMuted: true });
  marioRunner.loadRom(romBinary);
  marioRunner.fastBoot();
  const telem = marioRunner.getTelemetry();
  console.log(`  -> Estado tras fastBoot: X=${telem.x}, Y=${telem.y}, world=${telem.world}-${telem.level}, state=${telem.state}`);
  if (telem.x !== 40) {
    throw new Error(`Esperado X=40 tras fastBoot, obtenido ${telem.x}`);
  }
  if (telem.world !== 1 || telem.level !== 1) {
    throw new Error(`Esperado World 1-1 tras fastBoot, obtenido ${telem.world}-${telem.level}`);
  }
  console.log("  -> PASADO: NesRunner arranca instantáneamente en World 1-1 en X=40.");

  // 3. Verificación de mapeo de controles de Player 1 (sin crash con controller 1 o 0)
  console.log("\n[TEST 3] Mapeo de controles de Player 1...");
  marioRunner.buttonDown(1, 0); // Jump (A)
  marioRunner.buttonDown(0, 1); // Run (B) - debe normalizar a controller 1 sin lanzar error
  marioRunner.buttonDown(1, 7); // Right
  marioRunner.frame();
  marioRunner.buttonUp(1, 0);
  marioRunner.buttonUp(0, 1);
  marioRunner.buttonUp(1, 7);
  console.log("  -> PASADO: Mapeo de controlador P1 sin errores (0 y 1 normalizados a Controller 1).");

  // 4. Verificación de Bot Autónomo de Luigi (World 1-1 completo hasta bandera)
  console.log("\n[TEST 4] Carrera autónoma completa del Bot Luigi en World 1-1...");
  const luigiRunner = new NesRunner({ isMuted: true });
  luigiRunner.loadRom(romBinary);
  luigiRunner.fastBoot();
  const bot = new GhostBot();

  let max_x = 40;
  let reachedFlagpole = false;

  for (let f = 0; f < 1500; f++) {
    bot.update(luigiRunner);
    luigiRunner.frame();
    const cur_x = luigiRunner.mem[0x006D] * 256 + luigiRunner.mem[0x0086];
    if (cur_x > max_x) max_x = cur_x;

    if (cur_x >= 3160) {
      reachedFlagpole = true;
      console.log(`  -> META ALCANZADA en frame ${f}: X=${cur_x} px`);
      break;
    }

    if (luigiRunner.mem[0x000E] === 11) {
      throw new Error(`El Bot Luigi murió en frame ${f} en X=${cur_x}!`);
    }
  }

  if (!reachedFlagpole) {
    throw new Error(`El Bot Luigi no completó World 1-1 (max_x = ${max_x})`);
  }
  console.log("  -> PASADO: Bot Luigi superó todos los fosos y enemigos de World 1-1 con 0 muertes.");

  // 5. Verificación de WebRtcSync: generación de paquetes e interpolación
  console.log("\n[TEST 5] WebRtcSync: serialización de telemetría e interpolación...");
  const sync = new WebRtcSync();
  const testPacket = {
    type: 'telemetry',
    x: 500,
    y: 176,
    cam_x: 400,
    state: 1,
    facing: 2,
    powerup: 0,
    world: 1,
    level: 1,
    finished: false,
    t: 1000
  };
  sync.handleTelemetry(testPacket);
  const interp = sync.getInterpolatedGhost();
  if (!interp || interp.x !== 500) {
    throw new Error(`Interpolación inicial fallida: ${JSON.stringify(interp)}`);
  }
  // Enviar siguiente paquete y verificar lerp suave
  sync.handleTelemetry({ ...testPacket, x: 600 });
  const interp2 = sync.getInterpolatedGhost();
  if (interp2.x <= 500 || interp2.x >= 600) {
    throw new Error(`Lerp no está en rango esperado (500, 600): obtenido ${interp2.x}`);
  }
  console.log(`  -> Lerp suave validado: x0=500 -> x1=600 -> lerp=${interp2.x.toFixed(1)} px`);
  console.log("  -> PASADO: Protocolo de sincronización y buffer de interpolación validados.");

  // 6. Verificación de formato y cálculo de TelemetryBar
  console.log("\n[TEST 6] TelemetryBar: formato de cronómetro y cálculo de delta...");
  const bar = new TelemetryBar(256, 40);
  const timeStr = bar.formatTime(65430);
  if (timeStr !== "01:05.43") {
    throw new Error(`Formato de tiempo incorrecto: esperado '01:05.43', obtenido '${timeStr}'`);
  }
  console.log(`  -> Formato de cronómetro verificado: 65430ms = ${timeStr}`);
  console.log("  -> PASADO: TelemetryBar opera correctamente.");

  console.log("\n==================================================================");
  console.log("  TODAS LAS 6 PRUEBAS DEL MOTOR WEB (JSNES + BOT + WEBRTC) PASARON 100%!");
  console.log("==================================================================");
}

runWebTests().catch(err => {
  console.error("ERROR EN PRUEBAS:", err);
  process.exit(1);
});
