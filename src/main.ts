import './ui/styles.css';
import { TimerEngine } from './core/timerEngine';
import { StorageManager } from './core/storage';
import { SoundSynthesizer } from './core/sound';
import { WindowManager } from './desktop/windowManager';
import { NotificationBridge } from './desktop/notification';
import { AppUpdater } from './desktop/updater';
import { AppView } from './ui/appView';

async function bootstrap() {
  const appRoot = document.getElementById('app');
  if (!appRoot) throw new Error('App root element not found');

  const storage = new StorageManager();
  const sound = new SoundSynthesizer();
  const windowManager = new WindowManager();
  const notifications = new NotificationBridge();
  const updater = new AppUpdater();

  await notifications.init();

  let settings = storage.loadSettings();
  const initialTimers = storage.loadTimers();
  const engine = new TimerEngine(initialTimers);

  // Interval completion trigger
  engine.onComplete((timer) => {
    sound.playChime(settings.soundVolume);
    if (settings.toastNotifications) {
      notifications.sendTimerFinished(timer.label, timer.loop);
    }
  });

  const renderCurrent = () => {
    appView.render(engine.getTimers(), settings, windowManager.isMiniMode);
  };

  const appView = new AppView(appRoot, {
    onStart: (id) => {
      engine.startTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onPause: (id) => {
      engine.pauseTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onReset: (id) => {
      engine.resetTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onToggleLoop: (id) => {
      engine.toggleLoop(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onDelete: (id) => {
      engine.removeTimer(id);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onAddTimer: (label, mins, secs, loop) => {
      const totalSeconds = mins * 60 + secs;
      if (totalSeconds <= 0) return;
      engine.addTimer(label, totalSeconds, loop);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onToggleMini: async () => {
      const activeCount = engine.getTimers().filter((t) => t.state === 'running' || t.state === 'paused').length;
      await windowManager.toggleMiniMode(activeCount || 1);
      renderCurrent();
    },
    onMinimize: async () => {
      await windowManager.minimize();
    },
    onClose: async () => {
      storage.saveTimers(engine.getTimers());
      await windowManager.close();
    },
    onSaveSettings: (newSettings) => {
      settings = newSettings;
      storage.saveSettings(settings);
      renderCurrent();
    },
    onTestChime: () => {
      sound.preview(settings.soundVolume);
    },
    onCheckUpdate: async () => {
      appView.setUpdateInfo({ available: false, message: 'CHECKING...' });
      const status = await updater.checkForUpdates();
      if (status.available) {
        appView.setUpdateInfo({ available: true, version: status.version });
      } else {
        appView.setUpdateInfo({ available: false, message: 'LATEST VERSION INSTALLED' });
      }
    },
    onInstallUpdate: async () => {
      try {
        appView.setUpdateInfo({ available: true, isInstalling: true, progress: 0 });
        await updater.installUpdate((percent) => {
          appView.setUpdateInfo({ available: true, isInstalling: true, progress: percent });
        });
      } catch (err) {
        console.error('Update failed:', err);
        appView.setUpdateInfo({ available: true, isInstalling: false, message: 'UPDATE FAILED' });
      }
    },
  });

  // Regular tick loop (200ms tick for responsive UI updates without cpu strain)
  setInterval(() => {
    const hasRunning = engine.getTimers().some((t) => t.state === 'running');
    if (hasRunning) {
      engine.tick();
      renderCurrent();
    }
  }, 200);

  // Initial render
  renderCurrent();

  // Check for updates on startup
  updater.checkForUpdates().then((status) => {
    if (status.available) {
      appView.setUpdateInfo({ available: true, version: status.version });
    }
  }).catch(() => {});
}

bootstrap().catch(console.error);

