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
