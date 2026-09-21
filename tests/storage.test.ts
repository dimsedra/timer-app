import { describe, it, expect, beforeEach } from 'vitest';
import { StorageManager, DEFAULT_SETTINGS } from '../src/core/storage';
import { TimerItem } from '../src/core/types';

// Polyfill localStorage in node environment if missing or incomplete
const storageStore = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageStore.get(key) ?? null,
  setItem: (key: string, value: string) => { storageStore.set(key, String(value)); },
  removeItem: (key: string) => { storageStore.delete(key); },
  clear: () => { storageStore.clear(); },
  get length() { return storageStore.size; },
  key: (i: number) => Array.from(storageStore.keys())[i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
  writable: true,
});

describe('StorageManager', () => {
  let storage: StorageManager;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageManager();
  });

  it('loads default settings when storage is empty', () => {
    const settings = storage.loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
    expect(settings.defaultChime).toBe('pulse');
    expect(settings.toastDuration).toBe('normal');
  });

  it('saves and loads settings with chime and toastDuration', () => {
    storage.saveSettings({
      toastNotifications: false,
      soundVolume: 0.5,
      alwaysOnTopMini: true,
      defaultChime: 'radar',
      toastDuration: 'long',
    });

    const loaded = storage.loadSettings();
    expect(loaded.toastNotifications).toBe(false);
    expect(loaded.soundVolume).toBe(0.5);
    expect(loaded.defaultChime).toBe('radar');
    expect(loaded.toastDuration).toBe('long');
  });

  it('falls back missing settings to defaults safely', () => {
    // Simulate legacy storage missing defaultChime and toastDuration
    localStorage.setItem('timer_settings_v1', JSON.stringify({
      toastNotifications: true,
      soundVolume: 0.7,
    }));

    const loaded = storage.loadSettings();
    expect(loaded.defaultChime).toBe('pulse');
    expect(loaded.toastDuration).toBe('normal');
    expect(loaded.soundVolume).toBe(0.7);
  });

  it('saves and loads timers with paused/idle state sanitized and per-timer fallback', () => {
    const timers: TimerItem[] = [
      {
        id: 't1',
        label: 'Focus',
        durationSeconds: 300,
        loop: true,
        state: 'running', // running timer saved to disk should restore safely
        remainingSeconds: 200,
        endTimestamp: 999999999,
        chime: 'digital',
        toastOverride: 'enabled',
      },
    ];

    storage.saveTimers(timers);
    const loaded = storage.loadTimers();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('t1');
    expect(loaded[0].state).toBe('paused'); // restored as paused
    expect(loaded[0].endTimestamp).toBeNull();
    expect(loaded[0].chime).toBe('digital');
    expect(loaded[0].toastOverride).toBe('enabled');
  });

  it('loads timers and provides fallback chime and toastOverride if missing', () => {
    // Legacy timer stored without chime or toastOverride
    localStorage.setItem('timer_items_v1', JSON.stringify([
      {
        id: 't_legacy',
        label: 'Legacy',
        durationSeconds: 60,
        loop: false,
        state: 'idle',
        remainingSeconds: 60,
      }
    ]));

    const loaded = storage.loadTimers();
    expect(loaded[0].chime).toBe('global');
    expect(loaded[0].toastOverride).toBe('global');
  });
});
