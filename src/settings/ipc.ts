import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../types/ipc';
import type { SettingsKey, SettingsSchema } from '../types/settings';
import { getSettings, setSetting } from './store';
import { getActionsWithAccelerators } from '../keybinds';

export function initSettingsIpc(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
    return getSettings();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, (_event, payload: { key: SettingsKey; value: SettingsSchema[SettingsKey] }) => {
    setSetting(payload.key, payload.value as any);
    return { key: payload.key, value: payload.value };
  });

  ipcMain.handle(IPC_CHANNELS.KEYBINDS_GET_ACTIONS, () => {
    return getActionsWithAccelerators();
  });
}
