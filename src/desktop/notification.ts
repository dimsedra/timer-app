import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export class NotificationBridge {
  private hasPermission = false;

  async init(): Promise<void> {
    try {
      let permissionGranted = await isPermissionGranted();
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === 'granted';
      }
      this.hasPermission = permissionGranted;
    } catch {
      // In browser fallback or if plugin uninitialized
      this.hasPermission = false;
    }
  }

  async sendTimerFinished(label: string, isLooping: boolean): Promise<void> {
    const body = isLooping
      ? `${label} finished. Starting next cycle.`
      : `${label} finished.`;

    try {
      if (this.hasPermission) {
        sendNotification({
          title: 'Timer Finished',
          body,
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Finished', { body });
      }
    } catch (err) {
      console.warn('Notification failed to send:', err);
    }
  }
}
