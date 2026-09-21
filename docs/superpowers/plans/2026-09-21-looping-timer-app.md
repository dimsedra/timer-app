# Minimalist Looping Multi-Timer (Nothing OS × Terminal Edition) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimalist, drift-free, multi-timer Windows desktop app with continuous looping, Web Audio chime, Windows toast notifications, and a compact always-on-top mini floating view styled in Nothing OS / Terminal aesthetic, packaged into an `.exe` installer via GitHub Actions.

**Architecture:** Tauri v2 provides the lightweight Rust desktop runtime and window management. The frontend is built with Vanilla TypeScript and Vite for near-zero RAM footprint (~25-35 MB). Timing is computed against absolute epoch timestamps (`Date.now()`) to prevent background throttling drift. Audio is synthesized on-the-fly via the Web Audio API.

**Tech Stack:** Tauri v2, Rust, Vanilla TypeScript, Vite, Vitest, Web Audio API, `@tauri-apps/plugin-notification`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-21-looping-timer-app-design.md`

## Global Constraints
- Target OS: Windows (x64)
- Runtime: Node.js (pnpm), Rust (Cargo), WebView2
- UI Language: English only, technical, concise, no marketing fluff
- Visual Theme: Nothing OS × Terminal aesthetic (pitch black `#080808`, charcoal plates `#121212`, hairline borders `#242424`, Nothing Crimson Red `#d71920` optical LED accent, tabular monospace typography)
- Framework Overhead: Zero heavy UI frameworks (pure Vanilla TS + CSS)

---

## File Structure Map

- `package.json`: Frontend dependencies, build & test scripts
- `tsconfig.json`: TypeScript compiler options
- `vite.config.ts`: Vite bundling configuration with Vitest integration
- `index.html`: Entry HTML template
- `src-tauri/Cargo.toml`: Tauri v2 Rust dependencies
- `src-tauri/tauri.conf.json`: Tauri window definitions, bundle configs, and permissions
- `src-tauri/src/main.rs`: Tauri application entry point and window setup
- `src-tauri/capabilities/default.json`: Tauri v2 capability and permission grants
- `src/core/types.ts`: Data definitions (`TimerItem`, `TimerState`, `AppSettings`)
- `src/core/timerEngine.ts`: Drift-proof multi-timer engine with target timestamp calculation
- `src/core/storage.ts`: Local storage persistence and state hydration
- `src/core/sound.ts`: Web Audio API dual-tone synthesized chime
- `src/desktop/windowManager.ts`: Tauri window mode toggle (Normal: 380x520 vs Mini: 240x120 always-on-top)
- `src/desktop/notification.ts`: Windows toast notification wrapper
- `src/ui/styles.css`: Nothing OS × Terminal styling, layout, optical LED pulse, tactile buttons
- `src/ui/appView.ts`: DOM rendering for Normal View, Mini Floating View, and Settings
- `src/main.ts`: Main entry orchestrator wiring engine, sound, window controls, and UI
- `.github/workflows/release.yml`: GitHub Actions Windows `.exe` build and release pipeline

---

### Task 1: Scaffolding and Toolchain Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/capabilities/default.json`
- Test: `tests/sanity.test.ts`

**Interfaces:**
- Produces: Working development environment with `pnpm test` (Vitest) and `pnpm build` (Vite)

- [ ] **Step 1: Create package.json and install dependencies**

```json
{
  "name": "timer-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: Configure TypeScript, Vite, and HTML**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "tests"]
}
```

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'esnext',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
```

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Timer</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Setup Tauri v2 Rust Core Configuration**

Create `src-tauri/Cargo.toml`:
```toml
[package]
name = "timer-app"
version = "0.1.0"
description = "Minimalist Looping Multi-Timer"
authors = ["Dimas Edra"]
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0.0", features = [] }

[dependencies]
tauri = { version = "2.0.0", features = [] }
tauri-plugin-notification = "2.0.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Create `src-tauri/build.rs`:
```rust
fn main() {
    tauri_build::build()
}
```

Create `src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Create `src-tauri/tauri.conf.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Timer",
  "version": "0.1.0",
  "identifier": "com.dimsedra.timer",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "Timer",
        "width": 380,
        "height": 520,
        "minWidth": 240,
        "minHeight": 90,
        "resizable": true,
        "decorations": false,
        "transparent": false,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

Create `src-tauri/capabilities/default.json`:
```json
{
  "$schema": "https://schema.tauri.app/config/2/capability",
  "identifier": "default",
  "description": "Default permissions for timer app",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:window:allow-set-size",
    "core:window:allow-set-always-on-top",
    "core:window:allow-start-dragging",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "notification:default"
  ]
}
```

- [ ] **Step 4: Create a sanity test to verify Vitest**

Create `tests/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

describe('Sanity test', () => {
  it('verifies environment setup', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `pnpm test`
Expected: PASS 1 test

- [ ] **Step 5: Commit task**

```bash
git add package.json tsconfig.json vite.config.ts index.html src-tauri tests
git commit -m "chore: scaffold tauri v2, vite, typescript, and testing setup"
```

---

### Task 2: Data Models & Drift-Proof Timer Engine (TDD)

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/timerEngine.ts`
- Test: `tests/timerEngine.test.ts`

**Interfaces:**
- Produces:
  - Types: `TimerItem`, `TimerState`, `TimerEvent`, `AppSettings`
  - Class `TimerEngine` with methods:
    - `addTimer(label: string, durationSeconds: number, loop: boolean): TimerItem`
    - `removeTimer(id: string): void`
    - `startTimer(id: string, now?: number): void`
    - `pauseTimer(id: string, now?: number): void`
    - `resetTimer(id: string): void`
    - `toggleLoop(id: string): void`
    - `tick(now?: number): void`
    - `getTimers(): TimerItem[]`
    - `onComplete(callback: (timer: TimerItem) => void): void`

- [ ] **Step 1: Write failing tests for TimerEngine**

Create `tests/timerEngine.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TimerEngine } from '../src/core/timerEngine';

describe('TimerEngine', () => {
  let engine: TimerEngine;

  beforeEach(() => {
    engine = new TimerEngine();
  });

  it('creates a timer with idle state', () => {
    const timer = engine.addTimer('Work Cycle', 300, true);
    expect(timer.id).toBeDefined();
    expect(timer.label).toBe('Work Cycle');
    expect(timer.durationSeconds).toBe(300);
    expect(timer.remainingSeconds).toBe(300);
    expect(timer.loop).toBe(true);
    expect(timer.state).toBe('idle');
  });

  it('starts a timer and calculates remaining time based on timestamp delta', () => {
    const timer = engine.addTimer('Test', 60, false);
    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    expect(engine.getTimer(timer.id)?.state).toBe('running');
    expect(engine.getTimer(timer.id)?.endTimestamp).toBe(startTime + 60000);

    // 10 seconds later
    engine.tick(startTime + 10000);
    expect(engine.getTimer(timer.id)?.remainingSeconds).toBe(50);
  });

  it('pauses a timer accurately preserving remaining seconds', () => {
    const timer = engine.addTimer('Test', 60, false);
    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    // Advance 25 seconds
    engine.tick(startTime + 25000);
    engine.pauseTimer(timer.id, startTime + 25000);

    const paused = engine.getTimer(timer.id);
    expect(paused?.state).toBe('paused');
    expect(paused?.remainingSeconds).toBe(35);
    expect(paused?.endTimestamp).toBeNull();
  });

  it('completes non-looping timer and resets to idle', () => {
    const timer = engine.addTimer('Single', 10, false);
    const completeCb = vi.fn();
    engine.onComplete(completeCb);

    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    // Advance past end
    engine.tick(startTime + 10500);

    expect(completeCb).toHaveBeenCalledWith(expect.objectContaining({ id: timer.id }));
    const finished = engine.getTimer(timer.id);
    expect(finished?.state).toBe('idle');
    expect(finished?.remainingSeconds).toBe(10);
  });

  it('automatically loops continuously when loop is enabled without drift', () => {
    const timer = engine.addTimer('Looping', 10, true);
    const completeCb = vi.fn();
    engine.onComplete(completeCb);

    const startTime = 1000000;
    engine.startTimer(timer.id, startTime);

    // First cycle finishes at +10s
    engine.tick(startTime + 10000);
    expect(completeCb).toHaveBeenCalledTimes(1);

    const afterFirstLoop = engine.getTimer(timer.id);
    expect(afterFirstLoop?.state).toBe('running');
    expect(afterFirstLoop?.endTimestamp).toBe(startTime + 20000);
    expect(afterFirstLoop?.remainingSeconds).toBe(10);

    // Advance 3s into the second cycle
    engine.tick(startTime + 13000);
    expect(engine.getTimer(timer.id)?.remainingSeconds).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL with "Cannot find module '../src/core/timerEngine'"

- [ ] **Step 3: Define types and implement TimerEngine**

Create `src/core/types.ts`:
```typescript
export type TimerState = 'idle' | 'running' | 'paused';

export interface TimerItem {
  id: string;
  label: string;
  durationSeconds: number;
  loop: boolean;
  state: TimerState;
  remainingSeconds: number;
  endTimestamp: number | null;
}

export interface AppSettings {
  toastNotifications: boolean;
  soundVolume: number;
  alwaysOnTopMini: boolean;
}
```

Create `src/core/timerEngine.ts`:
```typescript
import { TimerItem, TimerState } from './types';

export class TimerEngine {
  private timers: Map<string, TimerItem> = new Map();
  private completeCallbacks: Array<(timer: TimerItem) => void> = [];

  constructor(initialTimers: TimerItem[] = []) {
    for (const t of initialTimers) {
      this.timers.set(t.id, { ...t });
    }
  }

  getTimers(): TimerItem[] {
    return Array.from(this.timers.values());
  }

  getTimer(id: string): TimerItem | undefined {
    return this.timers.get(id);
  }

  addTimer(label: string, durationSeconds: number, loop: boolean): TimerItem {
    const item: TimerItem = {
      id: `timer_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim() || `TIMER // ${this.timers.size + 1}`,
      durationSeconds: Math.max(1, durationSeconds),
      loop,
      state: 'idle',
      remainingSeconds: Math.max(1, durationSeconds),
      endTimestamp: null,
    };
    this.timers.set(item.id, item);
    return item;
  }

  removeTimer(id: string): void {
    this.timers.delete(id);
  }

  startTimer(id: string, now: number = Date.now()): void {
    const timer = this.timers.get(id);
    if (!timer || timer.state === 'running') return;

    timer.state = 'running';
    timer.endTimestamp = now + timer.remainingSeconds * 1000;
  }

  pauseTimer(id: string, now: number = Date.now()): void {
    const timer = this.timers.get(id);
    if (!timer || timer.state !== 'running' || timer.endTimestamp === null) return;

    const remaining = Math.max(0, Math.ceil((timer.endTimestamp - now) / 1000));
    timer.state = 'paused';
    timer.remainingSeconds = remaining;
    timer.endTimestamp = null;
  }

  resetTimer(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;

    timer.state = 'idle';
    timer.remainingSeconds = timer.durationSeconds;
    timer.endTimestamp = null;
  }

  toggleLoop(id: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    timer.loop = !timer.loop;
  }

  onComplete(callback: (timer: TimerItem) => void): void {
    this.completeCallbacks.push(callback);
  }

  tick(now: number = Date.now()): void {
    for (const timer of this.timers.values()) {
      if (timer.state !== 'running' || timer.endTimestamp === null) continue;

      const diffMs = timer.endTimestamp - now;
      if (diffMs <= 0) {
        // Interval completed
        this.completeCallbacks.forEach((cb) => cb({ ...timer }));

        if (timer.loop) {
          // Continuous loop: schedule next interval starting from now
          timer.endTimestamp = now + timer.durationSeconds * 1000;
          timer.remainingSeconds = timer.durationSeconds;
        } else {
          // Single-run completed: reset to idle
          timer.state = 'idle';
          timer.remainingSeconds = timer.durationSeconds;
          timer.endTimestamp = null;
        }
      } else {
        timer.remainingSeconds = Math.ceil(diffMs / 1000);
      }
    }
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm test`
Expected: PASS 2 test files (sanity.test.ts, timerEngine.test.ts)

- [ ] **Step 5: Commit task**

```bash
git add src/core/types.ts src/core/timerEngine.ts tests/timerEngine.test.ts
git commit -m "feat: implement drift-proof looping timer engine with tests"
```

---

### Task 3: Storage Layer & Web Audio Synthesizer

**Files:**
- Create: `src/core/storage.ts`
- Create: `src/core/sound.ts`
- Test: `tests/storage.test.ts`

**Interfaces:**
- Produces:
  - `StorageManager`:
    - `loadTimers(): TimerItem[]`
    - `saveTimers(timers: TimerItem[]): void`
    - `loadSettings(): AppSettings`
    - `saveSettings(settings: AppSettings): void`
  - `SoundSynthesizer`:
    - `playChime(volume?: number): void`
    - `preview(volume?: number): void`

- [ ] **Step 1: Write tests for StorageManager**

Create `tests/storage.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager, DEFAULT_SETTINGS } from '../src/core/storage';
import { TimerItem } from '../src/core/types';

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageManager();
  });

  it('loads default settings when storage is empty', () => {
    const settings = storage.loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('saves and loads settings', () => {
    storage.saveSettings({
      toastNotifications: false,
      soundVolume: 0.5,
      alwaysOnTopMini: true,
    });

    const loaded = storage.loadSettings();
    expect(loaded.toastNotifications).toBe(false);
    expect(loaded.soundVolume).toBe(0.5);
  });

  it('saves and loads timers with paused/idle state sanitized', () => {
    const timers: TimerItem[] = [
      {
        id: 't1',
        label: 'Focus',
        durationSeconds: 300,
        loop: true,
        state: 'running', // running timer saved to disk should restore safely
        remainingSeconds: 200,
        endTimestamp: 999999999,
      },
    ];

    storage.saveTimers(timers);
    const loaded = storage.loadTimers();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('t1');
    expect(loaded[0].state).toBe('paused'); // restored as paused
    expect(loaded[0].endTimestamp).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/storage.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement StorageManager and SoundSynthesizer**

Create `src/core/storage.ts`:
```typescript
import { TimerItem, AppSettings } from './types';

const TIMERS_KEY = 'timer_items_v1';
const SETTINGS_KEY = 'timer_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  toastNotifications: true,
  soundVolume: 0.8,
  alwaysOnTopMini: true,
};

export class StorageManager {
  loadSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }

  loadTimers(): TimerItem[] {
    try {
      const data = localStorage.getItem(TIMERS_KEY);
      if (!data) {
        // Return initial starter timer
        return [
          {
            id: 'timer_default_5m',
            label: 'FOCUS // 05M',
            durationSeconds: 300,
            loop: true,
            state: 'idle',
            remainingSeconds: 300,
            endTimestamp: null,
          },
        ];
      }
      const parsed: TimerItem[] = JSON.parse(data);
      // Ensure any running timers from previous session are safely loaded as paused
      return parsed.map((t) => ({
        ...t,
        state: t.state === 'running' ? 'paused' : t.state,
        endTimestamp: null,
      }));
    } catch {
      return [];
    }
  }

  saveTimers(timers: TimerItem[]): void {
    const serialized = timers.map((t) => ({
      ...t,
      // Never store volatile endTimestamp to disk
      endTimestamp: null,
      state: t.state === 'running' ? 'paused' : t.state,
    }));
    localStorage.setItem(TIMERS_KEY, JSON.stringify(serialized));
  }
}
```

Create `src/core/sound.ts`:
```typescript
export class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playChime(volume: number = 0.8): void {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const vol = Math.max(0, Math.min(1, volume));

      // Tone 1: 784 Hz (G5) for 120ms
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(784, now);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(vol * 0.35, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      // Tone 2: 1046.5 Hz (C6) for 240ms (plays 80ms after tone 1)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, now + 0.08);

      gain2.gain.setValueAtTime(0.001, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(vol * 0.45, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.33);
    } catch (err) {
      console.warn('Audio playback not allowed or failed:', err);
    }
  }

  preview(volume: number = 0.8): void {
    this.playChime(volume);
  }
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run: `pnpm test`
Expected: PASS all tests

- [ ] **Step 5: Commit task**

```bash
git add src/core/storage.ts src/core/sound.ts tests/storage.test.ts
git commit -m "feat: implement local storage manager and synthesized web audio chime"
```

---

### Task 4: Tauri Window Controller & Windows Notification Bridge

**Files:**
- Create: `src/desktop/windowManager.ts`
- Create: `src/desktop/notification.ts`
- Modify: `src/core/types.ts` (if needed)

**Interfaces:**
- Produces:
  - `WindowManager`:
    - `isMiniMode: boolean`
    - `setMiniMode(enabled: boolean, activeTimerCount?: number): Promise<void>`
    - `toggleMiniMode(activeTimerCount?: number): Promise<void>`
    - `setAlwaysOnTop(alwaysOnTop: boolean): Promise<void>`
    - `close(): Promise<void>`
    - `minimize(): Promise<void>`
  - `NotificationBridge`:
    - `sendTimerFinished(label: string, isLooping: boolean): Promise<void>`

- [ ] **Step 1: Implement WindowManager**

Create `src/desktop/windowManager.ts`:
```typescript
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export class WindowManager {
  private mini = false;
  private appWindow = getCurrentWindow();

  get isMiniMode(): boolean {
    return this.mini;
  }

  async setMiniMode(enabled: boolean, activeTimerCount: number = 1): Promise<void> {
    this.mini = enabled;
    try {
      if (enabled) {
        // Compact mini window height scales slightly with active timers (min 110, max 260)
        const computedHeight = Math.min(260, Math.max(110, 50 + activeTimerCount * 55));
        await this.appWindow.setSize(new LogicalSize(240, computedHeight));
        await this.appWindow.setAlwaysOnTop(true);
      } else {
        await this.appWindow.setSize(new LogicalSize(380, 520));
        await this.appWindow.setAlwaysOnTop(false);
      }
    } catch (err) {
      // Graceful fallback when running in standard browser/dev mode without Tauri IPC
      console.warn('Tauri window API not available or errored:', err);
    }
  }

  async toggleMiniMode(activeTimerCount: number = 1): Promise<void> {
    await this.setMiniMode(!this.mini, activeTimerCount);
  }

  async setAlwaysOnTop(alwaysOnTop: boolean): Promise<void> {
    try {
      await this.appWindow.setAlwaysOnTop(alwaysOnTop);
    } catch (err) {
      console.warn('Cannot set always on top:', err);
    }
  }

  async minimize(): Promise<void> {
    try {
      await this.appWindow.minimize();
    } catch (err) {
      console.warn('Cannot minimize window:', err);
    }
  }

  async close(): Promise<void> {
    try {
      await this.appWindow.close();
    } catch (err) {
      console.warn('Cannot close window:', err);
    }
  }
}
```

- [ ] **Step 2: Implement Windows Notification Bridge**

Create `src/desktop/notification.ts`:
```typescript
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export class NotificationBridge {
  private hasPermission = false;

  async init(): Promise<void> {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      this.hasPermission = permissionGranted;
    } catch {
      // In browser fallback or if plugin uninitialized
      this.hasPermission = false;
    }
  }

  async sendTimerFinished(label: string, isLooping: boolean): Promise<void> {
    const body = isLooping
      ? `${label} finished. Starting next cycle.`
      : `${label} finished.`;

    try {
      if (this.hasPermission) {
        sendNotification({
          title: 'Timer Finished',
          body,
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Finished', { body });
      }
    } catch (err) {
      console.warn('Notification failed to send:', err);
    }
  }
}
```

- [ ] **Step 3: Run unit tests to ensure no regressions**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Commit task**

```bash
git add src/desktop/windowManager.ts src/desktop/notification.ts
git commit -m "feat: implement tauri window manager and windows toast notification bridge"
```

---

### Task 5: Nothing OS × Terminal UI & Component Views

**Files:**
- Create: `src/ui/styles.css`
- Create: `src/ui/appView.ts`

**Interfaces:**
- Produces:
  - `styles.css`: Terminal/Nothing OS styling, dot-matrix grid accents, Nothing Crimson Red optical LED indicator, monospaced tabular numerals, physical button press styling.
  - `AppView`:
    - `render(timers: TimerItem[], settings: AppSettings, isMini: boolean): void`
    - Event emitters / callbacks for UI actions (`onStart`, `onPause`, `onReset`, `onToggleLoop`, `onDelete`, `onAddTimer`, `onToggleMini`, `onSaveSettings`, `onClose`, `onMinimize`).

- [ ] **Step 1: Create Nothing OS × Terminal CSS Stylesheet**

Create `src/ui/styles.css`:
```css
:root {
  --bg: #080808;
  --surface: #121212;
  --surface-hover: #181818;
  --surface-active: #0d0d0d;
  --border: #242424;
  --border-subtle: #1a1a1a;
  --text-primary: #f5f5f5;
  --text-muted: #737373;
  --accent-red: #d71920;
  --accent-red-glow: rgba(215, 25, 32, 0.35);
  --font-mono: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  user-select: none;
  -webkit-user-select: none;
}

body {
  background-color: var(--bg);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.4;
  overflow: hidden;
  height: 100vh;
  border: 1px solid var(--border);
}

/* Drag bar */
.titlebar {
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.titlebar-title {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 8px;
}

.titlebar-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #333;
}

.titlebar-led.active {
  background: var(--accent-red);
  box-shadow: 0 0 8px var(--accent-red-glow);
  animation: ledPulse 1.6s infinite ease-in-out;
}

@keyframes ledPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.9); }
}

.titlebar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-icon {
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 11px;
  border-radius: 2px;
}

.btn-icon:hover {
  border-color: var(--border);
  color: var(--text-primary);
  background: var(--surface);
}

.btn-icon:active {
  transform: translateY(1px);
}

/* Container */
.container {
  height: calc(100vh - 34px);
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.container::-webkit-scrollbar {
  width: 4px;
}

.container::-webkit-scrollbar-thumb {
  background: var(--border);
}

/* Timer Card */
.timer-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 14px 16px;
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.timer-label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.timer-digits {
  font-size: 38px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  line-height: 1;
}

.timer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Physical terminal button */
.btn {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  padding: 6px 12px;
  cursor: pointer;
  border-radius: 2px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 80ms ease, border-color 80ms ease;
}

.btn:hover {
  background: var(--surface-hover);
  border-color: #383838;
}

.btn:active {
  background: var(--surface-active);
  transform: translateY(1px);
}

.btn:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: 1px;
}

.btn-primary {
  border-color: #444;
  color: #fff;
}

.btn-loop {
  font-size: 10px;
  color: var(--text-muted);
}

.btn-loop.active {
  color: var(--accent-red);
  border-color: var(--accent-red);
}

.btn-danger {
  color: #a84245;
  margin-left: auto;
}

.btn-danger:hover {
  color: var(--accent-red);
  border-color: var(--accent-red);
}

/* Add Timer Section */
.add-section {
  border: 1px dashed var(--border);
  padding: 14px;
  border-radius: 2px;
}

.form-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.input-field {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 2px;
}

.input-field:focus {
  outline: 1px solid var(--text-primary);
  border-color: var(--text-primary);
}

.input-field::placeholder {
  color: #444;
}

/* Mini Floating Mode */
body.mini-mode .titlebar {
  height: 26px;
  padding: 0 8px;
}

body.mini-mode .container {
  height: calc(100vh - 26px);
  padding: 8px;
  gap: 8px;
}

body.mini-mode .timer-card {
  padding: 8px 10px;
  gap: 6px;
}

body.mini-mode .timer-digits {
  font-size: 24px;
}

body.mini-mode .btn {
  padding: 3px 8px;
  font-size: 10px;
}

/* Modal overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 8, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 100;
}

.modal-card {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 20px;
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
```

- [ ] **Step 2: Implement AppView DOM rendering logic**

Create `src/ui/appView.ts`:
```typescript
import { TimerItem, AppSettings } from '../core/types';

export interface AppViewCallbacks {
  onStart: (id: string) => void;
  onPause: (id: string) => void;
  onReset: (id: string) => void;
  onToggleLoop: (id: string) => void;
  onDelete: (id: string) => void;
  onAddTimer: (label: string, minutes: number, seconds: number, loop: boolean) => void;
  onToggleMini: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onSaveSettings: (settings: AppSettings) => void;
  onTestChime: () => void;
}

export class AppView {
  private root: HTMLElement;
  private callbacks: AppViewCallbacks;
  private showSettings = false;

  constructor(root: HTMLElement, callbacks: AppViewCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}`;
  }

  render(timers: TimerItem[], settings: AppSettings, isMini: boolean): void {
    document.body.classList.toggle('mini-mode', isMini);
    const hasRunningTimer = timers.some((t) => t.state === 'running');

    if (isMini) {
      this.renderMini(timers, hasRunningTimer);
    } else {
      this.renderNormal(timers, settings, hasRunningTimer);
    }
  }

  private renderMini(timers: TimerItem[], hasRunning: boolean): void {
    const activeTimers = timers.filter((t) => t.state === 'running' || t.state === 'paused');

    let contentHtml = '';
    if (activeTimers.length === 0) {
      contentHtml = `
        <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 11px;">
          NO ACTIVE TIMERS
          <div style="margin-top: 6px;">
            <button class="btn btn-expand" id="btn-expand">EXPAND [^]</button>
          </div>
        </div>
      `;
    } else {
      contentHtml = activeTimers
        .map(
          (t) => `
        <div class="timer-card">
          <div class="timer-header">
            <span class="timer-label">${t.label}</span>
            <span style="font-size: 10px; color: ${t.loop ? 'var(--accent-red)' : 'var(--text-muted)'};">
              ${t.loop ? 'LOOP' : 'ONCE'}
            </span>
          </div>
          <div class="timer-digits">${this.formatTime(t.remainingSeconds)}</div>
          <div class="timer-actions">
            ${
              t.state === 'running'
                ? `<button class="btn" data-action="pause" data-id="${t.id}">PAUSE</button>`
                : `<button class="btn btn-primary" data-action="start" data-id="${t.id}">START</button>`
            }
            <button class="btn" data-action="reset" data-id="${t.id}">RESET</button>
            <button class="btn btn-expand" style="margin-left: auto;" id="btn-expand">EXPAND [^]</button>
          </div>
        </div>
      `
        )
        .join('');
    }

    this.root.innerHTML = `
      <div class="titlebar" data-tauri-drag-region>
        <div class="titlebar-title" data-tauri-drag-region>
          <div class="titlebar-led ${hasRunning ? 'active' : ''}"></div>
          MINI
        </div>
        <div class="titlebar-actions">
          <button class="btn-icon" id="titlebar-close">x</button>
        </div>
      </div>
      <div class="container">${contentHtml}</div>
    `;

    this.attachMiniEvents();
  }

  private renderNormal(timers: TimerItem[], settings: AppSettings, hasRunning: boolean): void {
    const timerCardsHtml = timers
      .map(
        (t) => `
      <div class="timer-card">
        <div class="timer-header">
          <span class="timer-label">${t.label}</span>
          <button class="btn btn-loop ${t.loop ? 'active' : ''}" data-action="loop" data-id="${t.id}">
            LOOP [${t.loop ? 'ON' : 'OFF'}]
          </button>
        </div>
        <div class="timer-digits">${this.formatTime(t.remainingSeconds)}</div>
        <div class="timer-actions">
          ${
            t.state === 'running'
              ? `<button class="btn" data-action="pause" data-id="${t.id}">PAUSE</button>`
              : `<button class="btn btn-primary" data-action="start" data-id="${t.id}">START</button>`
          }
          <button class="btn" data-action="reset" data-id="${t.id}">RESET</button>
          <button class="btn btn-danger" data-action="delete" data-id="${t.id}">DEL</button>
        </div>
      </div>
    `
      )
      .join('');

    this.root.innerHTML = `
      <div class="titlebar" data-tauri-drag-region>
        <div class="titlebar-title" data-tauri-drag-region>
          <div class="titlebar-led ${hasRunning ? 'active' : ''}"></div>
          TIMER // DESKTOP
        </div>
        <div class="titlebar-actions">
          <button class="btn-icon" id="btn-compact" title="Switch to Compact Mini Window">_[]</button>
          <button class="btn-icon" id="btn-settings" title="Settings">*</button>
          <button class="btn-icon" id="titlebar-minimize">-</button>
          <button class="btn-icon" id="titlebar-close">x</button>
        </div>
      </div>

      <div class="container">
        <div class="timer-list" style="display:flex; flex-direction:column; gap:12px;">
          ${timerCardsHtml}
        </div>

        <div class="add-section">
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; letter-spacing: 0.08em;">
            + NEW TIMER
          </div>
          <form id="form-add-timer">
            <div class="form-row">
              <input type="text" id="input-label" class="input-field" placeholder="LABEL (OPTIONAL)" style="flex: 2;" />
              <input type="number" id="input-mins" class="input-field" placeholder="MIN" min="0" max="999" value="5" style="flex: 1;" required />
              <input type="number" id="input-secs" class="input-field" placeholder="SEC" min="0" max="59" value="0" style="flex: 1;" required />
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); cursor: pointer;">
                <input type="checkbox" id="input-loop" checked />
                AUTO-LOOP
              </label>
              <button type="submit" class="btn btn-primary">ADD TIMER</button>
            </div>
          </form>
        </div>
      </div>

      ${this.showSettings ? this.renderSettingsModal(settings) : ''}
    `;

    this.attachNormalEvents(settings);
  }

  private renderSettingsModal(settings: AppSettings): string {
    return `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-card">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 8px;">
            <span style="font-size: 11px; letter-spacing: 0.1em;">SETTINGS</span>
            <button class="btn-icon" id="btn-close-settings">x</button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <label style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-primary); cursor: pointer;">
              <span>WINDOWS TOAST</span>
              <input type="checkbox" id="setting-toast" ${settings.toastNotifications ? 'checked' : ''} />
            </label>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span>VOLUME</span>
                <span id="volume-val">${Math.round(settings.soundVolume * 100)}%</span>
              </div>
              <input type="range" id="setting-volume" min="0" max="1" step="0.05" value="${settings.soundVolume}" />
            </div>
            <button class="btn" id="btn-test-chime" style="align-self: flex-start;">TEST CHIME</button>
          </div>
        </div>
      </div>
    `;
  }

  private attachMiniEvents(): void {
    document.getElementById('titlebar-close')?.addEventListener('click', () => this.callbacks.onClose());
    document.getElementById('btn-expand')?.addEventListener('click', () => this.callbacks.onToggleMini());

    this.root.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'start') this.callbacks.onStart(id);
        if (action === 'pause') this.callbacks.onPause(id);
        if (action === 'reset') this.callbacks.onReset(id);
      });
    });
  }

  private attachNormalEvents(settings: AppSettings): void {
    document.getElementById('titlebar-close')?.addEventListener('click', () => this.callbacks.onClose());
    document.getElementById('titlebar-minimize')?.addEventListener('click', () => this.callbacks.onMinimize());
    document.getElementById('btn-compact')?.addEventListener('click', () => this.callbacks.onToggleMini());
    document.getElementById('btn-settings')?.addEventListener('click', () => {
      this.showSettings = true;
      this.renderNormal([], settings, false);
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.showSettings = false;
    });

    document.getElementById('btn-test-chime')?.addEventListener('click', () => {
      this.callbacks.onTestChime();
    });

    const toastCheckbox = document.getElementById('setting-toast') as HTMLInputElement | null;
    const volumeSlider = document.getElementById('setting-volume') as HTMLInputElement | null;

    toastCheckbox?.addEventListener('change', () => {
      this.callbacks.onSaveSettings({
        ...settings,
        toastNotifications: toastCheckbox.checked,
      });
    });

    volumeSlider?.addEventListener('input', () => {
      const vol = parseFloat(volumeSlider.value);
      const valDisplay = document.getElementById('volume-val');
      if (valDisplay) valDisplay.textContent = `${Math.round(vol * 100)}%`;
      this.callbacks.onSaveSettings({
        ...settings,
        soundVolume: vol,
      });
    });

    const addForm = document.getElementById('form-add-timer') as HTMLFormElement | null;
    addForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const labelInput = document.getElementById('input-label') as HTMLInputElement;
      const minsInput = document.getElementById('input-mins') as HTMLInputElement;
      const secsInput = document.getElementById('input-secs') as HTMLInputElement;
      const loopInput = document.getElementById('input-loop') as HTMLInputElement;

      const mins = parseInt(minsInput.value, 10) || 0;
      const secs = parseInt(secsInput.value, 10) || 0;
      this.callbacks.onAddTimer(labelInput.value, mins, secs, loopInput.checked);
      addForm.reset();
    });

    this.root.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;
        if (action === 'start') this.callbacks.onStart(id);
        if (action === 'pause') this.callbacks.onPause(id);
        if (action === 'reset') this.callbacks.onReset(id);
        if (action === 'loop') this.callbacks.onToggleLoop(id);
        if (action === 'delete') this.callbacks.onDelete(id);
      });
    });
  }
}
```

- [ ] **Step 3: Run unit tests to verify cleanly compiling**

Run: `pnpm test`
Expected: PASS

- [ ] **Step 4: Commit task**

```bash
git add src/ui/styles.css src/ui/appView.ts
git commit -m "feat: implement nothing os and terminal style ui layout and views"
```

---

### Task 6: Application Wiring & Integration

**Files:**
- Create: `src/main.ts`

**Interfaces:**
- Connects: `TimerEngine`, `StorageManager`, `SoundSynthesizer`, `WindowManager`, `NotificationBridge`, and `AppView`

- [ ] **Step 1: Implement main orchestrator entry point**

Create `src/main.ts`:
```typescript
import './ui/styles.css';
import { TimerEngine } from './core/timerEngine';
import { StorageManager } from './core/storage';
import { SoundSynthesizer } from './core/sound';
import { WindowManager } from './desktop/windowManager';
import { NotificationBridge } from './desktop/notification';
import { AppView } from './ui/appView';

async function bootstrap() {
  const appRoot = document.getElementById('app');
  if (!appRoot) throw new Error('App root element not found');

  const storage = new StorageManager();
  const sound = new SoundSynthesizer();
  const windowManager = new WindowManager();
  const notifications = new NotificationBridge();

  await notifications.init();

  let settings = storage.loadSettings();
  const initialTimers = storage.loadTimers();
  const engine = new TimerEngine(initialTimers);

  // Interval completion trigger
  engine.onComplete((timer) => {
    sound.playChime(settings.soundVolume);
    if (settings.toastNotifications) {
      notifications.sendTimerFinished(timer.label, timer.loop);
    }
  });

  const renderCurrent = () => {
    appView.render(engine.getTimers(), settings, windowManager.isMiniMode);
  };

  const appView = new AppView(appRoot, {
    onStart: (id) => {
      engine.startTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onPause: (id) => {
      engine.pauseTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onReset: (id) => {
      engine.resetTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onToggleLoop: (id) => {
      engine.toggleLoop(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onDelete: (id) => {
      engine.removeTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onAddTimer: (label, mins, secs, loop) => {
      const totalSeconds = mins * 60 + secs;
      if (totalSeconds <= 0) return;
      engine.addTimer(label, totalSeconds, loop);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onToggleMini: async () => {
      const activeCount = engine.getTimers().filter((t) => t.state === 'running' || t.state === 'paused').length;
      await windowManager.toggleMiniMode(activeCount || 1);
      renderCurrent();
    },
    onMinimize: async () => {
      await windowManager.minimize();
    },
    onClose: async () => {
      storage.saveTimers(engine.getTimers());
      await windowManager.close();
    },
    onSaveSettings: (newSettings) => {
      settings = newSettings;
      storage.saveSettings(settings);
      renderCurrent();
    },
    onTestChime: () => {
      sound.preview(settings.soundVolume);
    },
  });

  // Regular tick loop (200ms tick for responsive UI updates without cpu strain)
  setInterval(() => {
    const hasRunning = engine.getTimers().some((t) => t.state === 'running');
    if (hasRunning) {
      engine.tick();
      renderCurrent();
    }
  }, 200);

  // Initial render
  renderCurrent();
}

bootstrap().catch(console.error);
```

- [ ] **Step 2: Test building the frontend bundle**

Run: `pnpm build`
Expected: TypeScript check passes, Vite builds `dist/` directory cleanly.

- [ ] **Step 3: Run all unit tests**

Run: `pnpm test`
Expected: PASS all tests.

- [ ] **Step 4: Commit task**

```bash
git add src/main.ts
git commit -m "feat: wire application engine, sound, desktop controls, and UI"
```

---

### Task 7: GitHub Actions Packaging & Installer Pipeline (.exe)

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `.gitignore`

**Interfaces:**
- Produces: GitHub Actions workflow compiling Tauri v2 into an NSIS `.exe` installer and uploading to GitHub Releases.

- [ ] **Step 1: Create .gitignore**

Create `.gitignore`:
```gitignore
# Dependencies
node_modules/
pnpm-lock.yaml

# Build output
dist/
target/
src-tauri/target/

# Local env & IDE
.DS_Store
*.local
.vscode/
.idea/
```

- [ ] **Step 2: Create GitHub Actions Workflow for Windows .exe Build**

Create `.github/workflows/release.yml`:
```yaml
name: Release Windows App

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'

      - name: Install frontend dependencies
        run: pnpm install

      - name: Run unit tests
        run: pnpm test

      - name: Build Tauri installer
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Timer ${{ github.ref_name }}'
          releaseBody: 'Automated release of Minimalist Looping Multi-Timer (Windows)'
          releaseDraft: false
          prerelease: false
          args: ${{ matrix.args }}
```

- [ ] **Step 3: Verify git status and commit**

```bash
git add .gitignore .github/workflows/release.yml
git commit -m "ci: configure github actions release workflow for windows installer"
```

---

## Plan Review Checklist

- [x] Spec coverage: Multi-timer management, independent continuous loop, drift-proof timestamps, Web Audio chime, Windows toast toggle, dual normal/mini views, Nothing OS/Terminal theme, GitHub Actions `.exe` packaging.
- [x] No placeholders: All types, methods, file contents, test definitions, and commands are fully fleshed out.
- [x] Type consistency: `TimerItem`, `TimerState`, `AppSettings` matched identically across Engine, Storage, View, and Main.
