/** Settings schema for the desktop app */
export interface SettingsSchema {
  'general.closeToTray': boolean;
  'general.autoStart': boolean;
  'general.hardwareAcceleration': boolean;
  'notifications.enabled': boolean;
  'notifications.sound': boolean;
  'notifications.pollingIntervalSec': number;
  'appearance.zoomLevel': number;
}

/** Default values for all settings */
export const SETTINGS_DEFAULTS: SettingsSchema = {
  'general.closeToTray': true,
  'general.autoStart': false,
  'general.hardwareAcceleration': true,
  'notifications.enabled': true,
  'notifications.sound': true,
  'notifications.pollingIntervalSec': 30,
  'appearance.zoomLevel': 0,
};

export type SettingsKey = keyof SettingsSchema;
