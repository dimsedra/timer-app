# System Design Specification: Minimalist Looping Multi-Timer (Windows Desktop)

- **Date:** 2026-09-21
- **Target Platform:** Windows (x64)
- **Tech Stack:** Tauri v2, Rust, Vanilla TypeScript, Vite, Web Audio API

---

## 1. Overview & Goals

This application is a lightweight, single-purpose Windows desktop timer app designed for minimal resource consumption (RAM and CPU) while running continuously in the background.

Key requirements:
1. **Multi-Timer Management:** Users can define and run multiple independent timers that persist across app restarts until explicitly deleted.
2. **Independent Continuous Looping:** Each individual timer can be configured to loop continuously. When a loop finishes, it plays an audio chime, fires an optional system notification, and immediately restarts countdown without interruption.
3. **Drift-Proof Background Execution:** Timer calculations are based on absolute target timestamps (`Date.now()`), remaining accurate even when minimized, unfocused, or throttled by the OS.
4. **Dual Presentation Modes:**
   - **Normal View:** Full management interface (~380x520 px) to add, view, control, configure, and delete timers.
   - **Mini Floating View:** Compact, borderless, always-on-top overlay (~240x110 px dynamic) displaying only active (running/paused) timers with quick controls and instant restoration to normal view.
5. **Clean English-Only UI:** Minimalist, generous spacing, monospaced tabular countdown figures, zero extraneous animations or fluff.
6. **Automated Windows Distribution:** Packaged into an `.exe` installer (NSIS) via GitHub Actions releases.

---

## 2. Architecture & Components

```
+-------------------------------------------------------------+
|                     Tauri v2 (Rust Core)                   |
|  - Window creation, sizing, and position management         |
|  - Always-on-top toggle & borderless mini window control    |
|  - Native Windows Toast Notification Plugin integration      |
+-------------------------------------------------------------+
                              | (IPC / Tauri JS API)
+-------------------------------------------------------------+
|                 Frontend (Vanilla TS + Vite)                |
|                                                             |
|  +---------------------+        +------------------------+  |
|  |    Timer Engine     |        |   Audio Synthesizer    |  |
|  | - Timestamp delta   |------->| - Web Audio API        |  |
|  | - Drift-free ticks  |        | - Dual-tone sine chime |  |
|  | - Looping logic     |        +------------------------+  |
|  +---------------------+                                    |
|             |                                               |
|             v                                               |
|  +---------------------+        +------------------------+  |
|  |   Storage Manager   |        |   Window Controller    |  |
|  | - Local persistence|        | - Normal <-> Mini mode |  |
|  | - User settings     |        | - Always-on-top toggle |  |
|  +---------------------+        +------------------------+  |
|             |                                               |
|             v                                               |
|  +-------------------------------------------------------+  |
|  |                      UI Renderer                      |  |
|  | - Normal View: Timer cards, Add Timer, Settings modal |  |
|  | - Mini View: Compact active timers & quick actions   |  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

### 2.1 Tauri Backend (Rust)
- **Window Management:** Main window configured in `tauri.conf.json`. Exposes commands or uses the `@tauri-apps/api/window` client APIs for:
  - Switching between normal size (`380x520`) and compact mini size (`240x110` or dynamic height based on active timers).
  - Toggling `setAlwaysOnTop(true / false)`.
  - Handling window dragging via `data-tauri-drag-region`.
- **Plugins:** `@tauri-apps/plugin-notification` to send native Windows toast notifications.

### 2.2 Storage Layer
Data is serialized to `localStorage` under standard schema keys:
- `timer_items_v1`: Array of `TimerItem` objects.
- `timer_settings_v1`: Global app preferences (`toastEnabled: boolean`, `soundVolume: number`, `alwaysOnTopDefault: boolean`).

### 2.3 Timer Data Model

```typescript
export type TimerState = 'idle' | 'running' | 'paused';

export interface TimerItem {
  id: string;                 // UUID / timestamp-based ID
  label: string;              // e.g. "Focus Cycle", "5 Min Interval"
  durationSeconds: number;    // Configured duration (e.g. 300 for 5m)
  loop: boolean;              // Per-timer continuous looping flag
  state: TimerState;          // Current execution state
  remainingSeconds: number;   // Seconds left in current cycle
  endTimestamp: number | null;// Absolute epoch ms when the active interval ends
}

export interface AppSettings {
  toastNotifications: boolean;// Global toggle for Windows toast (default: true)
  soundVolume: number;        // 0.0 to 1.0 (default: 0.8)
  alwaysOnTopMini: boolean;   // Automatically pin on top in mini mode (default: true)
}
```

---

## 3. Timer Engine & Execution Logic

### 3.1 Background Drift-Free Timing
To ensure accuracy when the app is in the background or minimized:
1. When a timer starts or resumes:
   $$\text{endTimestamp} = \text{Date.now()} + (\text{remainingSeconds} \times 1000)$$
2. A single high-frequency tick loop (`setInterval` or `requestAnimationFrame` at 200ms interval) checks:
   $$\text{remaining} = \max\left(0, \left\lceil \frac{\text{endTimestamp} - \text{Date.now()}}{1000} \right\rceil\right)$$
3. If $\text{Date.now()} \ge \text{endTimestamp}$:
   - Trigger interval completion handler.
   - If `timer.loop === true`:
     - Play synthesized audio chime.
     - Dispatch native Windows toast (if enabled).
     - Instantly calculate next cycle:
       $$\text{timer.endTimestamp} = \text{Date.now()} + (\text{timer.durationSeconds} \times 1000)$$
       $$\text{timer.remainingSeconds} = \text{timer.durationSeconds}$$
     - Continue counting down without stopping.
   - If `timer.loop === false`:
     - Play synthesized audio chime.
     - Dispatch native Windows toast (if enabled).
     - Set `timer.state = 'idle'`, `timer.remainingSeconds = timer.durationSeconds`, `timer.endTimestamp = null`.

### 3.2 Web Audio Synthesizer
- Built using native browser `AudioContext`.
- Emits a smooth, discreet 2-tone melodic chime:
  - Tone 1: 784 Hz (G5) for 120ms with smooth exponential gain decay.
  - Tone 2: 1046.5 Hz (C6) for 240ms with smooth exponential gain decay.
- Zero audio files on disk; avoids external asset loading failures.

---

## 4. User Interface Specification

### 4.1 Visual Design Language (Nothing OS × Terminal Aesthetic)
- **Aesthetic Direction:**
  - Heavily inspired by **Nothing OS** (NDot / industrial retro-futurism) fused with a clean, high-precision **Terminal interface**.
  - Stark monochrome elegance: deep true-black canvas, crisp white tabular typography, and the iconic Nothing crimson-red accent for active states.
  - Completely anti-AI-slop: zero mushy gradients, zero blur shadows, no rounded candy pills. Every pixel feels like calibrated instrument hardware.
- **Palette & Contrast:**
  - Canvas: Pure pitch black (`--bg: #080808`).
  - Card Surfaces: Tactile dark charcoal plates (`--surface: #121212`, `--surface-hover: #1a1a1a`).
  - Hairline Borders & Dividers: Clean industrial outlines (`--border: #242424`) with subtle dotted/dashed technical dividers.
  - Text & Monospace Figures: Stark crisp white (`--text-primary: #f5f5f5`) and muted technical gray (`--text-muted: #737373`).
  - Iconic Accent: Nothing Crimson Red (`--accent-red: #d71920` / `#e11d24`) used deliberately as an optical status LED dot (e.g., active timer pulse, loop indicator), bringing immediate visual identity.
- **Typography & Technical Layout:**
  - Fonts: Monospaced terminal font family (`'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace`) with tabular numerical alignment (`font-variant-numeric: tabular-nums`).
  - Labels & Headers: Uppercase technical notation (`TIMER // 01`, `LOOP [ON/OFF]`, `STATUS: RUNNING`, `RESET [ESC]`).
  - Digits: Large, bold, hyper-legible terminal countdown readout (`05:00`).
- **Tactile Microinteractions:**
  - Instantaneous, clicky response (80ms–100ms transitions).
  - Buttons styled like physical hardware toggles / terminal keycaps (bordered plates with crisp inset depression on active click).
  - Subtle breathing LED dot animation in Nothing Crimson Red when a timer is actively counting down.
- **Copy:**
  - Minimalist, technical, concise English:
  - Actions: `START`, `PAUSE`, `RESET`, `DELETE`, `+ NEW TIMER`, `COMPACT`, `SETTINGS`.

### 4.2 Views
1. **Normal View (~380 × 520 px):**
   - **Header:** Clean titlemark ("Timer"), Compact mode trigger button, and Settings icon button.
   - **Timer Cards:** Spaced deliberately with generous breathing room. Each card features:
     - Header: Timer label + understated "Loop" toggle.
     - Centerpiece: Prominent, steady tabular countdown display (`MM:SS` or `HH:MM:SS`).
     - Footer: Action buttons (`Start` / `Pause`, `Reset`, and a subtle `Delete` trigger).
   - **Add Timer Section:** Compact, focused drawer or inline form with clean inputs for duration (minutes, seconds) and a loop checkbox.
   - **Settings Drawer/Modal:** Clean overlay with toggles for Windows Toast notifications, volume slider, and a chime preview button.
2. **Mini Floating View (~240 × 110 px dynamic):**
   - Seamless, borderless always-on-top window with dedicated drag bar.
   - Strictly displays only timers in `running` or `paused` state. Idle timers are hidden to keep desktop real estate uncluttered.
   - Compact row presentation: Label, bold tabular countdown, mini play/pause control, and an "Expand" button to restore the full window.
   - If no timers are active: Calm fallback state ("No active timers") with an Expand button.

---

## 5. Build, Packaging, & CI/CD Pipeline

### 5.1 Local Tooling
- `pnpm` for package management.
- `vite` for fast TypeScript bundling.
- `@tauri-apps/cli` v2 for native desktop builds.

### 5.2 GitHub Actions Workflow (`.github/workflows/release.yml`)
- Triggered on tag push (`v*.*.*`) or manual dispatch.
- Runner: `windows-latest`.
- Steps:
  1. Checkout repository.
  2. Setup Node.js & Rust stable.
  3. Install dependencies via `pnpm install`.
  4. Run unit tests (`vitest`).
  5. Run `tauri-apps/tauri-action` to compile the release binary and generate NSIS installer (`.exe`).
  6. Automatically upload the `.exe` artifact to GitHub Releases.

---

## 6. Testing Strategy

1. **Unit Tests (Vitest):**
   - Timing calculation accuracy & drift resilience.
   - Loop transition: verifies that continuous loop correctly resets remaining seconds and schedules the next timestamp without accumulating drift.
   - State mutations (`start`, `pause`, `reset`, `delete`).
   - Storage serialization and schema migration.
2. **Integration & Manual Verification:**
   - Window resize and always-on-top toggle testing in local Tauri dev environment.
   - Background audio playback verification when app is minimized or unfocused.
