export type TimerState = 'idle' | 'running' | 'paused';
export type ChimeType = 'pulse' | 'digital' | 'radar' | 'alarm';
export type ToastDuration = 'normal' | 'long';
export type ToastOverride = 'global' | 'enabled' | 'disabled';

export interface TimerItem {
  id: string;
  label: string;
  durationSeconds: number;
  loop: boolean;
  state: TimerState;
  remainingSeconds: number;
  endTimestamp: number | null;
  chime?: 'global' | ChimeType;
  toastOverride?: ToastOverride;
}

export interface AppSettings {
  toastNotifications: boolean;
  soundVolume: number;
  alwaysOnTopMini: boolean;
  defaultChime: ChimeType;
  toastDuration: ToastDuration;
}
