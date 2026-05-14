import { ipcRenderer } from 'electron';

// IPC channel names inlined (sandboxed preloads can't require relative modules)
const IPC_CHANNELS = {
  SHOW_NOTIFICATION: 'show-notification',
  UPDATE_BADGE: 'update-badge',
} as const;

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
}

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
// Executed at top-level so it runs before any page scripts (preload runs first)
function NotificationOverride(this: NotificationMock, title: string, options: NotificationOptions = {}): void {
  const payload: NotificationPayload = {
    title,
    body: options.body || '',
    icon: options.icon || undefined,
  };

  ipcRenderer.send(IPC_CHANNELS.SHOW_NOTIFICATION, payload);
  ipcRenderer.send(IPC_CHANNELS.UPDATE_BADGE);

  // Return a minimal mock so calling code doesn't break
  this.title = title;
  this.body = options.body || '';
  this.onclick = null;
  this.onclose = null;
  this.onerror = null;
  this.close = () => {};
}

(NotificationOverride as unknown as { permission: string }).permission = 'granted';

(NotificationOverride as unknown as { requestPermission: (cb?: (permission: string) => void) => Promise<string> }).requestPermission = function (cb) {
  if (cb) cb('granted');
  return Promise.resolve('granted');
};

Object.defineProperty(window, 'Notification', {
  value: NotificationOverride,
  writable: false,
  configurable: false,
});

// --- Mock Push API ---
// Electron has no built-in push service (like FCM in Chrome).
// Since the desktop app is always running in the tray, the page stays loaded
// and receives real-time notifications via the normal Notification API.
// The PushManager mock is injected into the main world via executeJavaScript
// in main.ts because contextIsolation prevents prototype patches from preload.
