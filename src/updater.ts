import { autoUpdater, type UpdateInfo } from 'electron-updater';
import { app, shell, Notification, BrowserWindow } from 'electron';
import * as path from 'path';

import { APP_CONFIG } from './types/config';

let updateInterval: ReturnType<typeof setInterval> | null = null;
let hasWillQuitHandler = false;

function clearUpdatePolling(): void {
  if (!updateInterval) return;
  clearInterval(updateInterval);
  updateInterval = null;
}

function startUpdatePolling(): void {
  clearUpdatePolling();
  autoUpdater.checkForUpdates();
  updateInterval = setInterval(() => {
    autoUpdater.checkForUpdates();
  }, APP_CONFIG.UPDATE_INTERVAL_MS);

  if (!hasWillQuitHandler) {
    app.on('will-quit', clearUpdatePolling);
    hasWillQuitHandler = true;
  }
}

/** Whether the current Linux build supports auto-update (AppImage only) */
function isAutoUpdateSupported(): boolean {
  if (process.platform === 'win32' || process.platform === 'darwin') return true;
  // Linux: only AppImage supports auto-update
  return !!process.env.APPIMAGE;
}

/** Initialize the auto-updater with event handlers */
export function initAutoUpdater(): void {
  // Don't check in dev mode (no packaged app)
  if (!app.isPackaged) return;

  if (!isAutoUpdateSupported()) {
    // For non-AppImage Linux targets, use manual check
    initManualUpdateCheck();
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    showUpdateNotification(
      'Update verfügbar',
      `Version ${info.version} wird heruntergeladen…`,
    );
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    showUpdateNotification(
      'Update bereit',
      `Version ${info.version} wird beim nächsten Neustart installiert.`,
    );
  });

  autoUpdater.on('error', (error: Error) => {
    console.error('Auto-updater error:', error.message);
  });

  // Check for updates immediately, then periodically
  startUpdatePolling();
}

/** For Linux formats without auto-update: check for new version and show notification with link */
function initManualUpdateCheck(): void {
  autoUpdater.autoDownload = false;

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    const notification = new Notification({
      title: 'Update verfügbar',
      body: `Version ${info.version} ist verfügbar. Klicke hier zum Download.`,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    });

    notification.on('click', () => {
      shell.openExternal(APP_CONFIG.RELEASES_URL);
    });

    notification.show();
  });

  autoUpdater.on('error', (error: Error) => {
    console.error('Update-check error:', error.message);
  });

  startUpdatePolling();
}

function showUpdateNotification(title: string, body: string): void {
  const notification = new Notification({
    title,
    body,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  notification.on('click', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (!win.isVisible()) win.show();
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  notification.show();
}
