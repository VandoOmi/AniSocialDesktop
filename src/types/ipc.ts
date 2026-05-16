/** IPC channel names as const for type-safe messaging */
export const IPC_CHANNELS = {
  SHOW_NOTIFICATION: 'show-notification',
  UPDATE_BADGE: 'update-badge',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET: 'settings:set',
  KEYBINDS_GET_ACTIONS: 'keybinds:get-actions',
  KEYBINDS_RECORDING_START: 'keybinds:recording-start',
  KEYBINDS_RECORDING_STOP: 'keybinds:recording-stop',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Payload for the show-notification IPC message */
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
}
