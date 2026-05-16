import { ipcRenderer } from 'electron';

// IPC channel names inlined (sandboxed preloads can't require relative modules)
const IPC_CHANNELS = {
  SHOW_NOTIFICATION: 'show-notification',
  UPDATE_BADGE: 'update-badge',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET: 'settings:set',
  KEYBINDS_GET_ACTIONS: 'keybinds:get-actions',
  KEYBINDS_RECORDING_START: 'keybinds:recording-start',
  KEYBINDS_RECORDING_STOP: 'keybinds:recording-stop',
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

  // Keybinds: get all actions with effective accelerators
  if (event.data.type === '__electron_keybinds_get__') {
    ipcRenderer.invoke(IPC_CHANNELS.KEYBINDS_GET_ACTIONS).then((actions) => {
      window.postMessage({ type: '__electron_keybinds_data__', actions }, '*');
    });
  }

  // Keybinds: start recording (disables menu accelerators)
  if (event.data.type === '__electron_keybinds_recording_start__') {
    ipcRenderer.send(IPC_CHANNELS.KEYBINDS_RECORDING_START);
  }

  // Keybinds: stop recording (re-enables menu accelerators)
  if (event.data.type === '__electron_keybinds_recording_stop__') {
    ipcRenderer.send(IPC_CHANNELS.KEYBINDS_RECORDING_STOP);
  }
});
