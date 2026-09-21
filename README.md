# TIMER // DESKTOP

A minimalist, drift-proof looping multi-timer for Windows built with Tauri v2, Rust, and TypeScript. Designed with a Nothing OS × Terminal hardware aesthetic.

---

## Highlights

- **Multi-Timer Engine:** Run multiple independent timers simultaneously with optional auto-looping.
- **Drift-Proof Precision:** Timestamp delta tracking via `performance.now()` / `Date.now()` prevents drift even across OS sleep or background throttling.
- **Flexible Durations:** Full support for Hours, Minutes, and Seconds (`HR`, `MIN`, `SEC`) with dynamic `HH:MM:SS` formatting.
- **Synthesized Audio Presets:** Zero external audio assets. 4 procedural chimes (`Pulse`, `Digital`, `Radar`, `Alarm`) generated on-the-fly using the Web Audio API.
- **Micro-Stagger Audio Queue:** Smooth 150ms playback queue prevents audio clipping or distortion when multiple timers complete simultaneously.
- **Hierarchical Settings:** Set global defaults with granular per-timer overrides (`[CFG]`) for custom chimes and toast notifications.
- **Inline Title Editing:** Click any timer label directly or update it inside the config panel to rename.
- **Native Windows Toast:** Native desktop notifications with customizable banner duration (`Normal ~7s` vs `Long ~25s`).
- **Mini Floating Mode:** Compact Picture-in-Picture widget with always-on-top pinning and smooth GPU-accelerated micro transitions.
- **In-App Updater:** Integrated updater automatically checks GitHub Releases for seamless 1-click updates.

---

## Design Philosophy

- **Monochrome & Crimson:** Pure `#080808` canvas, `#121212` surfaces, `#242424` hairline borders, and `#d71920` crimson status accents.
- **Tabular Monospace Typography:** Strict tabular figures prevent horizontal jitter during timer countdowns.
- **Zero Bloat:** Lightweight footprint (~15 MB installed), low CPU and RAM consumption.

---

## Installation

Download the latest Windows installer (`.exe`) from the [GitHub Releases](https://github.com/dimsedra/timer-app/releases) page.

---

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [pnpm](https://pnpm.io/)
- [Rust](https://www.rust-lang.org/tools/install) (latest stable)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/dimsedra/timer-app.git
cd timer-app

# Install dependencies
pnpm install

# Run dev mode (hot-reloading Vite frontend + Tauri native shell)
pnpm tauri dev

# Run unit tests
pnpm test

# Build frontend production bundle
pnpm build
```

---

## License

MIT
