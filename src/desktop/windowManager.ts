import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export class WindowManager {
  private mini = false;
  private appWindow = getCurrentWindow();

  get isMiniMode(): boolean {
    return this.mini;
  }

  async setMiniMode(enabled: boolean, activeTimerCount: number = 1): Promise<void> {
    this.mini = enabled;
    try {
      if (enabled) {
        // Mini mode: width 280px, height dynamically tailored to active timer count (min 154px, max 360px)
        const count = Math.max(1, activeTimerCount);
        const computedHeight = Math.min(360, 48 + count * 106);
        await this.appWindow.setSize(new LogicalSize(280, computedHeight));
        await this.appWindow.setAlwaysOnTop(true);
      } else {
        await this.appWindow.setSize(new LogicalSize(360, 420));
        await this.appWindow.setAlwaysOnTop(false);
      }
    } catch (err) {
      // Graceful fallback when running in standard browser/dev mode without Tauri IPC
      console.warn('Tauri window API not available or errored:', err);
    }
  }

  async toggleMiniMode(activeTimerCount: number = 1): Promise<void> {
    await this.setMiniMode(!this.mini, activeTimerCount);
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
