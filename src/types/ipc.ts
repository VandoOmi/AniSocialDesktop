/** IPC channel names as const for type-safe messaging */
export const IPC_CHANNELS = {
  SHOW_NOTIFICATION: 'show-notification',
  UPDATE_BADGE: 'update-badge',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

/** Payload for the show-notification IPC message */
export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
}
