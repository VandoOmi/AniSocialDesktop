import { ipcRenderer } from 'electron';

// IPC channel names inlined (sandboxed preloads can't require relative modules)
const IPC_CHANNELS = {
  SHOW_NOTIFICATION: 'show-notification',
  UPDATE_BADGE: 'update-badge',
} as const;

// Listen for notification requests from the main world (injected via executeJavaScript).
// contextIsolation prevents direct prototype patches, but postMessage events cross the boundary.
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === '__electron_notification__') {
    ipcRenderer.send(IPC_CHANNELS.SHOW_NOTIFICATION, {
      title: event.data.title,
      body: event.data.body,
      icon: event.data.icon,
    });
    ipcRenderer.send(IPC_CHANNELS.UPDATE_BADGE);
  }
});
