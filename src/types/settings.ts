/** Settings schema for the desktop app */
export interface SettingsSchema {
  'general.closeToTray': boolean;
  'general.autoStart': boolean;
  'general.hardwareAcceleration': boolean;
  'notifications.enabled': boolean;
  'notifications.sound': boolean;
  'notifications.pollingIntervalSec': number;
  'appearance.zoomLevel': number;
  'keybinds.overrides': Record<string, string>;
  'quicknav.slot1.path': string;
  'quicknav.slot1.label': string;
  'quicknav.slot2.path': string;
  'quicknav.slot2.label': string;
  'quicknav.slot3.path': string;
  'quicknav.slot3.label': string;
  'quicknav.slot4.path': string;
  'quicknav.slot4.label': string;
  'quicknav.slot5.path': string;
  'quicknav.slot5.label': string;
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
  'keybinds.overrides': {},
  'quicknav.slot1.path': '',
  'quicknav.slot1.label': '',
  'quicknav.slot2.path': '',
  'quicknav.slot2.label': '',
  'quicknav.slot3.path': '',
  'quicknav.slot3.label': '',
  'quicknav.slot4.path': '',
  'quicknav.slot4.label': '',
  'quicknav.slot5.path': '',
  'quicknav.slot5.label': '',
};

export type SettingsKey = keyof SettingsSchema;
