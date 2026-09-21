import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateStatus {
  available: boolean;
  version?: string;
  body?: string;
}

export class AppUpdater {
  private currentUpdate: Update | null = null;

  async checkForUpdates(): Promise<UpdateStatus> {
    try {
      const update = await check();
      if (update && update.available) {
        this.currentUpdate = update;
        return {
          available: true,
          version: update.version,
          body: update.body || undefined,
        };
      }
      this.currentUpdate = null;
      return { available: false };
    } catch (err) {
      console.warn('Update check not available or failed:', err);
      this.currentUpdate = null;
      return { available: false };
    }
  }

  async installUpdate(onProgress?: (percent: number) => void): Promise<void> {
    if (!this.currentUpdate) {
      throw new Error('No update ready for installation');
    }

    try {
      let downloaded = 0;
      let totalLength = 0;

      await this.currentUpdate.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            totalLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (totalLength > 0 && onProgress) {
              const percent = Math.min(100, Math.round((downloaded / totalLength) * 100));
              onProgress(percent);
            }
            break;
          case 'Finished':
            if (onProgress) onProgress(100);
            break;
        }
      });

      // Relaunch into the newly installed version automatically
      await relaunch();
    } catch (err) {
      console.error('Failed to download and install update:', err);
      throw err;
    }
  }
}
