import { ipcRenderer } from 'electron';
import { IPC_CHANNELS, type NotificationPayload } from './types/ipc';

interface NotificationOptions {
  body?: string;
  icon?: string;
  [key: string]: unknown;
}

interface NotificationMock {
  title: string;
  body: string;
  onclick: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close: () => void;
}

// Override the browser Notification API to forward notifications to Electron's native system
window.addEventListener('DOMContentLoaded', () => {
  // Always report that notifications are granted (we handle them natively)
  function NotificationOverride(this: NotificationMock, title: string, options: NotificationOptions = {}): void {
    const payload: NotificationPayload = {
      title,
      body: options.body || '',
      icon: options.icon || undefined,
    };

    ipcRenderer.send(IPC_CHANNELS.SHOW_NOTIFICATION, payload);

    // Return a minimal mock so calling code doesn't break
    this.title = title;
    this.body = options.body || '';
    this.onclick = null;
    this.onclose = null;
    this.onerror = null;
    this.close = () => {};
  }

  (NotificationOverride as unknown as { permission: string }).permission = 'granted';

  (NotificationOverride as unknown as { requestPermission: () => Promise<string> }).requestPermission = function () {
    return Promise.resolve('granted');
  };

  Object.defineProperty(window, 'Notification', {
    value: NotificationOverride,
    writable: false,
    configurable: false,
  });
});
