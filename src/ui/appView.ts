import { TimerItem, AppSettings, ChimeType, ToastDuration, ToastOverride } from '../core/types';

export interface UpdateInfo {
  available: boolean;
  version?: string;
  isInstalling?: boolean;
  progress?: number;
  message?: string;
}

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
  onTestChime: (chime?: ChimeType) => void;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onPreviewChime?: (chime: ChimeType) => void;
  onUpdateTimerConfig?: (id: string, chime: 'global' | ChimeType, toastOverride: ToastOverride) => void;
}

export class AppView {
  private root: HTMLElement;
  private callbacks: AppViewCallbacks;
  private showSettings = false;
  private expandedTimerConfigs: Set<string> = new Set();
  private lastTimers: TimerItem[] = [];
  private lastSettings: AppSettings | null = null;
  private updateInfo: UpdateInfo = { available: false };
  private isMini = false;

  constructor(root: HTMLElement, callbacks: AppViewCallbacks) {
    this.root = root;
    this.callbacks = callbacks;
    this.initGlobalDelegation();
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(mins)}:${pad(secs)}`;
  }

  private initGlobalDelegation(): void {
    // Click delegation on root: ensures clicks never get lost on DOM updates
    this.root.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Close modal by clicking overlay outside card
      if (target.id === 'modal-overlay') {
        this.showSettings = false;
        if (this.lastSettings) this.render(this.lastTimers, this.lastSettings, this.isMini);
        return;
      }

      const button = target.closest('button');
      if (!button) return;

      if (button.id === 'titlebar-close') {
        this.callbacks.onClose();
        return;
      }
      if (button.id === 'titlebar-minimize') {
        this.callbacks.onMinimize();
        return;
      }
      if (button.id === 'btn-compact' || button.id === 'btn-expand') {
        this.callbacks.onToggleMini();
        return;
      }
      if (button.id === 'btn-settings') {
        this.showSettings = true;
        if (this.lastSettings) this.render(this.lastTimers, this.lastSettings, this.isMini);
        return;
      }
      if (button.id === 'btn-close-settings') {
        this.showSettings = false;
        if (this.lastSettings) this.render(this.lastTimers, this.lastSettings, this.isMini);
        return;
      }
      if (button.id === 'btn-test-chime') {
        const chime = (button.dataset.chime as ChimeType) || this.lastSettings?.defaultChime || 'pulse';
        if (this.callbacks.onPreviewChime) {
          this.callbacks.onPreviewChime(chime);
        } else {
          this.callbacks.onTestChime(chime);
        }
        return;
      }
      if (button.id === 'btn-check-update') {
        this.callbacks.onCheckUpdate();
        return;
      }
      if (button.id === 'btn-update-now') {
        this.callbacks.onInstallUpdate();
        return;
      }

      // Setting modal chime pill selector
      if (button.classList.contains('pill-chime-setting') && button.dataset.chime && this.lastSettings) {
        const chime = button.dataset.chime as ChimeType;
        this.callbacks.onSaveSettings({
          ...this.lastSettings,
          defaultChime: chime,
        });
        return;
      }

      // Setting modal toast duration pill selector
      if (button.classList.contains('pill-toast-dur') && button.dataset.duration && this.lastSettings) {
        const duration = button.dataset.duration as ToastDuration;
        this.callbacks.onSaveSettings({
          ...this.lastSettings,
          toastDuration: duration,
        });
        return;
      }

      // Action buttons (cards)
      const action = button.dataset.action;
      const id = button.dataset.id;
      if (action && id) {
        if (action === 'start') this.callbacks.onStart(id);
        if (action === 'pause') this.callbacks.onPause(id);
        if (action === 'reset') this.callbacks.onReset(id);
        if (action === 'loop') this.callbacks.onToggleLoop(id);
        if (action === 'delete') this.callbacks.onDelete(id);
        if (action === 'toggle-cfg') {
          if (this.expandedTimerConfigs.has(id)) {
            this.expandedTimerConfigs.delete(id);
          } else {
            this.expandedTimerConfigs.add(id);
          }
          if (this.lastSettings) this.render(this.lastTimers, this.lastSettings, this.isMini);
        }
        if (action === 'set-timer-chime') {
          const chimeVal = button.dataset.chimeVal as 'global' | ChimeType;
          const timer = this.lastTimers.find((t) => t.id === id);
          if (timer && this.callbacks.onUpdateTimerConfig) {
            this.callbacks.onUpdateTimerConfig(id, chimeVal, timer.toastOverride ?? 'global');
          }
        }
        if (action === 'preview-timer-chime') {
          const timer = this.lastTimers.find((t) => t.id === id);
          const chimeType = (timer?.chime && timer.chime !== 'global')
            ? timer.chime
            : (this.lastSettings?.defaultChime || 'pulse');
          if (this.callbacks.onPreviewChime) {
            this.callbacks.onPreviewChime(chimeType);
          } else {
            this.callbacks.onTestChime(chimeType);
          }
        }
        if (action === 'set-timer-toast') {
          const toastVal = button.dataset.toastVal as ToastOverride;
          const timer = this.lastTimers.find((t) => t.id === id);
          if (timer && this.callbacks.onUpdateTimerConfig) {
            this.callbacks.onUpdateTimerConfig(id, timer.chime ?? 'global', toastVal);
          }
        }
        return;
      }
    });

    // Form submit delegation
    this.root.addEventListener('submit', (e) => {
      const target = e.target as HTMLFormElement;
      if (target && target.id === 'form-add-timer') {
        e.preventDefault();
        const labelInput = target.querySelector<HTMLInputElement>('#input-label');
        const minsInput = target.querySelector<HTMLInputElement>('#input-mins');
        const secsInput = target.querySelector<HTMLInputElement>('#input-secs');
        const loopInput = target.querySelector<HTMLInputElement>('#input-loop');

        const label = labelInput?.value.trim() || '';
        const mins = parseInt(minsInput?.value || '0', 10) || 0;
        const secs = parseInt(secsInput?.value || '0', 10) || 0;
        const loop = loopInput ? loopInput.checked : true;

        if (mins <= 0 && secs <= 0) {
          minsInput?.focus();
          return;
        }

        this.callbacks.onAddTimer(label, mins, secs, loop);
        target.reset();
      }
    });

    // Inputs delegation for settings
    this.root.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (!target || !this.lastSettings) return;

      if (target.id === 'setting-toast') {
        this.callbacks.onSaveSettings({
          ...this.lastSettings,
          toastNotifications: target.checked,
        });
      }
    });

    this.root.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      if (!target || !this.lastSettings) return;

      if (target.id === 'setting-volume') {
        const vol = parseFloat(target.value);
        const valDisplay = this.root.querySelector('#volume-val');
        if (valDisplay) valDisplay.textContent = `${Math.round(vol * 100)}%`;
        this.callbacks.onSaveSettings({
          ...this.lastSettings,
          soundVolume: vol,
        });
      }
    });
  }

  setUpdateInfo(info: UpdateInfo): void {
    this.updateInfo = info;
    if (this.lastSettings) {
      this.render(this.lastTimers, this.lastSettings, this.isMini);
    }
  }

  /**
   * High-frequency tick updates (only updates numbers and active states in-place, ZERO DOM teardown)
   */
  updateTicks(timers: TimerItem[]): void {
    this.lastTimers = timers;
    const hasRunning = timers.some((t) => t.state === 'running');

    // Update titlebar LED without re-rendering titlebar
    const led = this.root.querySelector('.titlebar-led');
    if (led) {
      led.classList.toggle('active', hasRunning);
    }

    // Update digits & start/pause button for existing cards in place
    for (const t of timers) {
      const card = this.root.querySelector<HTMLElement>(`[data-timer-id="${t.id}"]`);
      if (card) {
        const digits = card.querySelector('.timer-digits');
        if (digits) {
          const timeStr = this.formatTime(t.remainingSeconds);
          if (digits.textContent !== timeStr) {
            digits.textContent = timeStr;
          }
        }

        const startPauseBtn = card.querySelector<HTMLButtonElement>('[data-action="start"], [data-action="pause"]');
        if (startPauseBtn) {
          const isRunning = t.state === 'running';
          const currentAction = startPauseBtn.dataset.action;
          if (isRunning && currentAction !== 'pause') {
            startPauseBtn.dataset.action = 'pause';
            startPauseBtn.className = 'btn';
            startPauseBtn.textContent = 'PAUSE';
          } else if (!isRunning && currentAction !== 'start') {
            startPauseBtn.dataset.action = 'start';
            startPauseBtn.className = 'btn btn-primary';
            startPauseBtn.textContent = 'START';
          }
        }
      }
    }
  }

  render(timers: TimerItem[], settings: AppSettings, isMini: boolean): void {
    this.lastTimers = timers;
    this.lastSettings = settings;
    this.isMini = isMini;

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
        <div style="padding: 24px 12px; text-align: center; color: var(--text-muted); font-size: 11px; letter-spacing: 0.08em;">
          NO ACTIVE TIMERS
        </div>
      `;
    } else {
      contentHtml = activeTimers
        .map(
          (t) => `
        <div class="timer-card" data-timer-id="${t.id}">
          <div class="timer-header">
            <span class="timer-label" title="${t.label}">${t.label}</span>
            <span class="badge-loop ${t.loop ? 'active' : ''}">
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
          </div>
        </div>
      `
        )
        .join('');
    }

    this.root.innerHTML = `
      <div class="titlebar">
        <div class="titlebar-title" data-tauri-drag-region>
          <div class="titlebar-led ${hasRunning ? 'active' : ''}"></div>
          MINI
        </div>
        <div class="titlebar-actions" data-tauri-drag-region="false">
          <button class="btn-icon" id="btn-expand" title="Expand to Normal View">[^]</button>
          <button class="btn-icon" id="titlebar-close" title="Close">x</button>
        </div>
      </div>
      <div class="container">${contentHtml}</div>
    `;
  }

  private renderNormal(timers: TimerItem[], settings: AppSettings, hasRunning: boolean): void {
    const timerCardsHtml = timers
      .map((t) => {
        const isConfigOpen = this.expandedTimerConfigs.has(t.id);
        const currentChime = t.chime ?? 'global';
        const currentToast = t.toastOverride ?? 'global';

        return `
      <div class="timer-card" data-timer-id="${t.id}">
        <div class="timer-header">
          <span class="timer-label" title="${t.label}">${t.label}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <button class="btn btn-cfg ${isConfigOpen ? 'active' : ''}" data-action="toggle-cfg" data-id="${t.id}" title="Toggle Timer Configuration">
              [CFG]
            </button>
            <button class="btn btn-loop ${t.loop ? 'active' : ''}" data-action="loop" data-id="${t.id}">
              LOOP [${t.loop ? 'ON' : 'OFF'}]
            </button>
          </div>
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
        ${
          isConfigOpen
            ? `
          <div class="timer-config-panel">
            <div class="config-row">
              <span class="config-label">CHIME</span>
              <div class="pill-group">
                <button class="pill-btn ${currentChime === 'global' ? 'active' : ''}" data-action="set-timer-chime" data-id="${t.id}" data-chime-val="global">GLOBAL</button>
                <button class="pill-btn ${currentChime === 'pulse' ? 'active' : ''}" data-action="set-timer-chime" data-id="${t.id}" data-chime-val="pulse">PULSE</button>
                <button class="pill-btn ${currentChime === 'digital' ? 'active' : ''}" data-action="set-timer-chime" data-id="${t.id}" data-chime-val="digital">DIGITAL</button>
                <button class="pill-btn ${currentChime === 'radar' ? 'active' : ''}" data-action="set-timer-chime" data-id="${t.id}" data-chime-val="radar">RADAR</button>
                <button class="pill-btn ${currentChime === 'alarm' ? 'active' : ''}" data-action="set-timer-chime" data-id="${t.id}" data-chime-val="alarm">ALARM</button>
                <button class="pill-btn" data-action="preview-timer-chime" data-id="${t.id}" title="Preview Chime">▶</button>
              </div>
            </div>
            <div class="config-row">
              <span class="config-label">TOAST</span>
              <div class="pill-group">
                <button class="pill-btn ${currentToast === 'global' ? 'active' : ''}" data-action="set-timer-toast" data-id="${t.id}" data-toast-val="global">GLOBAL</button>
                <button class="pill-btn ${currentToast === 'enabled' ? 'active' : ''}" data-action="set-timer-toast" data-id="${t.id}" data-toast-val="enabled">ON</button>
                <button class="pill-btn ${currentToast === 'disabled' ? 'active' : ''}" data-action="set-timer-toast" data-id="${t.id}" data-toast-val="disabled">OFF</button>
              </div>
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;
      })
      .join('');

    this.root.innerHTML = `
      <div class="titlebar">
        <div class="titlebar-title" data-tauri-drag-region>
          <div class="titlebar-led ${hasRunning ? 'active' : ''}"></div>
          TIMER // DESKTOP
        </div>
        <div class="titlebar-actions" data-tauri-drag-region="false">
          <button class="btn-icon" id="btn-compact" title="Switch to Mini Floating Mode">_[]</button>
          <button class="btn-icon" id="btn-settings" title="Settings">*</button>
          <button class="btn-icon" id="titlebar-minimize" title="Minimize">-</button>
          <button class="btn-icon" id="titlebar-close" title="Close">x</button>
        </div>
      </div>

      <div class="container">
        ${
          this.updateInfo.available
            ? `
          <div class="update-banner">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="update-led"></span>
              <span style="font-size: 11px; letter-spacing: 0.08em;">
                UPDATE AVAILABLE: v${this.updateInfo.version || ''}
              </span>
            </div>
            <button class="btn btn-update" id="btn-update-now" ${this.updateInfo.isInstalling ? 'disabled' : ''}>
              ${
                this.updateInfo.isInstalling
                  ? `DOWNLOADING ${this.updateInfo.progress || 0}%`
                  : 'UPDATE & RESTART'
              }
            </button>
          </div>
        `
            : ''
        }

        <div class="timer-list" style="display:flex; flex-direction:column; gap:12px;">
          ${timerCardsHtml}
        </div>

        <div class="add-section">
          <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 10px; letter-spacing: 0.08em;">
            + NEW TIMER
          </div>
          <form id="form-add-timer">
            <div class="form-row">
              <input type="text" id="input-label" class="input-field" placeholder="LABEL (OPTIONAL)" maxlength="24" />
              <input type="number" id="input-mins" class="input-field" placeholder="MIN" min="0" max="999" />
              <input type="number" id="input-secs" class="input-field" placeholder="SEC" min="0" max="59" />
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
  }

  private renderSettingsModal(settings: AppSettings): string {
    const chimes: ChimeType[] = ['pulse', 'digital', 'radar', 'alarm'];
    const activeChime = settings.defaultChime || 'pulse';
    const activeDuration = settings.toastDuration || 'normal';

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
                <span>TOAST DURATION</span>
              </div>
              <div class="pill-group">
                <button class="pill-btn pill-toast-dur ${activeDuration === 'normal' ? 'active' : ''}" data-duration="normal">NORMAL (~7S)</button>
                <button class="pill-btn pill-toast-dur ${activeDuration === 'long' ? 'active' : ''}" data-duration="long">LONG (~25S)</button>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span>VOLUME</span>
                <span id="volume-val">${Math.round(settings.soundVolume * 100)}%</span>
              </div>
              <input type="range" id="setting-volume" min="0" max="1" step="0.05" value="${settings.soundVolume}" style="accent-color: var(--accent-red); cursor: pointer;" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                <span>DEFAULT CHIME</span>
                <button class="btn" id="btn-test-chime" data-chime="${activeChime}" style="padding: 2px 8px; font-size: 10px;">TEST</button>
              </div>
              <div class="pill-group">
                ${chimes
                  .map(
                    (c) => `
                  <button class="pill-btn pill-chime-setting ${activeChime === c ? 'active' : ''}" data-chime="${c}">
                    ${c.toUpperCase()}
                  </button>
                `
                  )
                  .join('')}
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border); padding-top: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                <span style="color: var(--text-muted);">UPDATES</span>
                <span style="color: ${this.updateInfo.available ? 'var(--accent-red)' : 'var(--text-muted)'}; font-size: 10px;">
                  ${this.updateInfo.available ? `v${this.updateInfo.version} AVAILABLE` : 'UP TO DATE'}
                </span>
              </div>
              <button class="btn" id="btn-check-update" style="align-self: flex-start;">
                CHECK FOR UPDATES
              </button>
              ${
                this.updateInfo.message
                  ? `<div style="font-size: 10px; color: var(--text-muted);">${this.updateInfo.message}</div>`
                  : ''
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }
}

