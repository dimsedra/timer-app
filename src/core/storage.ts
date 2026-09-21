import { TimerItem, AppSettings } from './types';

const TIMERS_KEY = 'timer_items_v1';
const SETTINGS_KEY = 'timer_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  toastNotifications: true,
  soundVolume: 0.8,
  alwaysOnTopMini: true,
  defaultChime: 'pulse',
  toastDuration: 'normal',
};

export class StorageManager {
  loadSettings(): AppSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (!data) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        defaultChime: parsed.defaultChime || DEFAULT_SETTINGS.defaultChime,
        toastDuration: parsed.toastDuration || DEFAULT_SETTINGS.toastDuration,
      };
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
            chime: 'global',
            toastOverride: 'global',
          },
        ];
      }
      const parsed: TimerItem[] = JSON.parse(data);
      // Ensure any running timers from previous session are safely loaded as paused
      // and ensure fallback for chime and toastOverride
      return parsed.map((t) => ({
        ...t,
        chime: t.chime ?? 'global',
        toastOverride: t.toastOverride ?? 'global',
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
      chime: t.chime ?? 'global',
      toastOverride: t.toastOverride ?? 'global',
      // Never store volatile endTimestamp to disk
      endTimestamp: null,
      state: t.state === 'running' ? 'paused' : t.state,
    }));
    localStorage.setItem(TIMERS_KEY, JSON.stringify(serialized));
  }
}
