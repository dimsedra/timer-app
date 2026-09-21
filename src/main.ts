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

  // Micro-staggered audio queue (~150ms delay between consecutive chimes)
  const soundQueue: Array<{ chime: import('./core/types').ChimeType; volume: number }> = [];
  let isPlayingSound = false;

  const processSoundQueue = () => {
    if (isPlayingSound || soundQueue.length === 0) return;
    isPlayingSound = true;
    const next = soundQueue.shift()!;
    sound.playChime(next.chime, next.volume);
    setTimeout(() => {
      isPlayingSound = false;
      processSoundQueue();
    }, 150);
  };

  const enqueueChime = (chime: import('./core/types').ChimeType, volume: number) => {
    soundQueue.push({ chime, volume });
    processSoundQueue();
  };

  // Interval completion trigger
  engine.onComplete((timer) => {
    const chime = timer.chime && timer.chime !== 'global' ? timer.chime : settings.defaultChime;
    enqueueChime(chime, settings.soundVolume);

    const shouldToast =
      timer.toastOverride === 'enabled'
        ? true
        : timer.toastOverride === 'disabled'
        ? false
        : settings.toastNotifications;

    if (shouldToast) {
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
    onAddTimer: (label, hrs, mins, secs, loop) => {
      const totalSeconds = hrs * 3600 + mins * 60 + secs;
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
    onTestChime: (chime) => {
      sound.preview(chime || settings.defaultChime, settings.soundVolume);
    },
    onPreviewChime: (chime) => {
      sound.preview(chime, settings.soundVolume);
    },
    onUpdateTimerConfig: (id, chime, toastOverride) => {
      engine.updateConfig(id, chime, toastOverride);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onRenameTimer: (id, newLabel) => {
      engine.renameTimer(id, newLabel);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
    },
    onUpdateTimerDuration: (id, newTotalSeconds) => {
      engine.updateTimerDuration(id, newTotalSeconds);
      storage.saveTimers(engine.getTimers());
      renderCurrent();
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

  // Regular tick loop (200ms tick for responsive in-place UI updates without DOM recreation)
  setInterval(() => {
    const hasRunning = engine.getTimers().some((t) => t.state === 'running');
    if (hasRunning) {
      engine.tick();
      appView.updateTicks(engine.getTimers());
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

