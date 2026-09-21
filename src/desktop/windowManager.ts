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
        // Compact mini window height scales slightly with active timers (min 110, max 260)
        const computedHeight = Math.min(260, Math.max(110, 50 + activeTimerCount * 55));
        await this.appWindow.setSize(new LogicalSize(240, computedHeight));
        await this.appWindow.setAlwaysOnTop(true);
      } else {
        await this.appWindow.setSize(new LogicalSize(380, 520));
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
