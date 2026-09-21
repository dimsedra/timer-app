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
