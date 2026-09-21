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
  private lastTimers: TimerItem[] = [];
  private lastSettings: AppSettings | null = null;

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
    this.lastTimers = timers;
    this.lastSettings = settings;

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
        <div class="timer-card">
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
      <div class="titlebar" data-tauri-drag-region>
        <div class="titlebar-title" data-tauri-drag-region>
          <div class="titlebar-led ${hasRunning ? 'active' : ''}"></div>
          MINI
        </div>
        <div class="titlebar-actions">
          <button class="btn-icon" id="btn-expand" title="Expand to Normal View">[^]</button>
          <button class="btn-icon" id="titlebar-close" title="Close">x</button>
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
          <span class="timer-label" title="${t.label}">${t.label}</span>
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
          <button class="btn-icon" id="btn-compact" title="Switch to Mini Floating Mode">_[]</button>
          <button class="btn-icon" id="btn-settings" title="Settings">*</button>
          <button class="btn-icon" id="titlebar-minimize" title="Minimize">-</button>
          <button class="btn-icon" id="titlebar-close" title="Close">x</button>
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
              <input type="text" id="input-label" class="input-field" placeholder="LABEL (OPTIONAL)" maxlength="24" />
              <input type="number" id="input-mins" class="input-field" placeholder="MIN" min="0" max="999" value="5" required />
              <input type="number" id="input-secs" class="input-field" placeholder="SEC" min="0" max="59" value="0" required />
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
              <input type="range" id="setting-volume" min="0" max="1" step="0.05" value="${settings.soundVolume}" style="accent-color: var(--accent-red); cursor: pointer;" />
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
      if (this.lastSettings) {
        this.renderNormal(this.lastTimers, this.lastSettings, this.lastTimers.some((t) => t.state === 'running'));
      }
    });

    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.showSettings = false;
      if (this.lastSettings) {
        this.renderNormal(this.lastTimers, this.lastSettings, this.lastTimers.some((t) => t.state === 'running'));
      }
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
