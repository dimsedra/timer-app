import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export type WindowMode = 'normal' | 'mini' | 'float';

export class WindowManager {
  private mode: WindowMode = 'normal';
  private appWindow = getCurrentWindow();

  get currentMode(): WindowMode {
    return this.mode;
  }

  get isMiniMode(): boolean {
    return this.mode === 'mini';
  }

  get isFloatMode(): boolean {
    return this.mode === 'float';
  }

  async setMode(targetMode: WindowMode, activeTimerCount = 1): Promise<void> {
    this.mode = targetMode;
    try {
      if (targetMode === 'float') {
        await this.appWindow.setSize(new LogicalSize(124, 48));
        await this.appWindow.setAlwaysOnTop(true);
      } else if (targetMode === 'mini') {
        const count = Math.max(1, activeTimerCount);
        const computedHeight = Math.min(360, 48 + count * 106);
        await this.appWindow.setSize(new LogicalSize(280, computedHeight));
        await this.appWindow.setAlwaysOnTop(true);
      } else {
        await this.appWindow.setSize(new LogicalSize(360, 420));
        await this.appWindow.setAlwaysOnTop(false);
      }
    } catch (err) {
      console.warn('Tauri window API not available or errored:', err);
    }
  }

  async setMiniMode(enabled: boolean, activeTimerCount = 1): Promise<void> {
    await this.setMode(enabled ? 'mini' : 'normal', activeTimerCount);
  }

  async toggleMiniMode(activeTimerCount = 1): Promise<void> {
    await this.setMode(this.mode === 'mini' ? 'normal' : 'mini', activeTimerCount);
  }

  async toggleFloatMode(): Promise<void> {
    await this.setMode(this.mode === 'float' ? 'normal' : 'float');
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
