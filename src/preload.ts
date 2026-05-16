import { ipcRenderer } from 'electron';

// IPC channel names inlined (sandboxed preloads can't require relative modules)
const IPC_CHANNELS = {
  SHOW_NOTIFICATION: 'show-notification',
  UPDATE_BADGE: 'update-badge',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET: 'settings:set',
} as const;

// Listen for notification requests from the main world (injected via executeJavaScript).
// contextIsolation prevents direct prototype patches, but postMessage events cross the boundary.
window.addEventListener('message', (event) => {
  if (!event.data || !event.data.type) return;

  if (event.data.type === '__electron_notification__') {
    ipcRenderer.send(IPC_CHANNELS.SHOW_NOTIFICATION, {
      title: event.data.title,
      body: event.data.body,
      icon: event.data.icon,
    });
    ipcRenderer.send(IPC_CHANNELS.UPDATE_BADGE);
  }

  // Settings: get all settings
  if (event.data.type === '__electron_settings_get__') {
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL).then((settings) => {
      window.postMessage({ type: '__electron_settings_data__', settings }, '*');
    });
  }

  // Settings: set a single setting
  if (event.data.type === '__electron_settings_set__') {
    ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, {
      key: event.data.key,
      value: event.data.value,
    }).then((result) => {
      window.postMessage({ type: '__electron_settings_updated__', ...result }, '*');
    });
  }
});
