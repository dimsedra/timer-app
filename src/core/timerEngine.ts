import { TimerItem } from './types';

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
      chime: 'global',
      toastOverride: 'global',
    };
    this.timers.set(item.id, item);
    return item;
  }

  removeTimer(id: string): void {
    this.timers.delete(id);
  }

  updateConfig(id: string, chime: 'global' | import('./types').ChimeType, toastOverride: import('./types').ToastOverride): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    timer.chime = chime;
    timer.toastOverride = toastOverride;
  }

  renameTimer(id: string, newLabel: string): void {
    const timer = this.timers.get(id);
    if (!timer) return;
    const trimmed = newLabel.trim();
    if (trimmed) {
      timer.label = trimmed;
    }
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
