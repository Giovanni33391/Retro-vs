# Super Mario Bros: Speedrun VS (Ghost Runner Online & Web)

A high-performance HTML5 / Canvas NES speedrun racing game designed for low-latency P2P online multiplayer and offline bot practice.

## Features

- **Exclusive Ghost Runner Layout**: Native 256x280 resolution (256x40 top telemetry & timer HUD + 256x240 authentic NES viewport). Scaled pixel-perfect with integer aspect-ratio.
- **Translucent Ghost Rival**: Luigi runs in the same frame as a 50% opacity translucent ghost with authentic NES green/white palettes.
- **Off-Screen Directional Tracking**: Dynamic retro badges (`[L] ▶ +X px` or `◀ [L] -X px`) indicate the rival's relative distance whenever they leave the visible camera screen.
- **WebRTC DataChannel P2P Multiplayer**: Lag-free, serverless 60Hz telemetry synchronization with PeerJS signaling (`/?room=1234` or direct room codes).
- **Autonomous Speedrun Bot**: Reactive AI player for offline practice across World 1-1 through 1-4, handling pit jumps, platform timing, and Bowser's bridge axe.
- **Full NES 6502 + PPU + APU Emulation**: 60 FPS gameplay with authentic 8-bit sound effects and music.
- **Mobile & Touch Friendly**: On-screen responsive D-Pad, B (Run), and A (Jump) virtual controls.
- **Vercel Ready**: Pre-configured with `vercel.json` and optimized Vite static build for instantaneous deployment.

---

## Getting Started

### Local Development

```bash
# Install dependencies
npm install

# Start Vite dev server (usually http://localhost:5173)
npm run dev

# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Deploying to Vercel

### Option 1: Vercel CLI (1-command deploy)
```bash
npx vercel
```

### Option 2: GitHub / Vercel Dashboard
1. Push this folder to a GitHub repository.
2. Import the repository in [vercel.com](https://vercel.com).
3. Vercel will automatically detect `vite` as the framework preset and deploy `dist/` with the included `vercel.json` routing and caching headers.

---

## Controls

| Action | Keyboard | Touch / Gamepad |
|---|---|---|
| **Move Left / Right** | `◀` / `▶` or `A` / `D` | Virtual D-Pad |
| **Crouch / Down** | `▼` or `S` | Virtual Down |
| **Run / Fireball (B)** | `Z` or `J` | Button B |
| **Jump (A)** | `X` or `K` | Button A |
| **Start / Pause** | `Enter` | START |
| **Select** | `Shift` | SELECT |
