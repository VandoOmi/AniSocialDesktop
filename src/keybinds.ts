import { getSetting } from './settings/store';

export interface KeybindAction {
  id: string;
  label: string;
  defaultAccelerator: string;
  category: 'navigation' | 'quicknav';
}

/** All available keybind actions with their defaults */
export const KEYBIND_ACTIONS: KeybindAction[] = [
  // Navigation
  { id: 'nav.reload', label: 'Neu laden', defaultAccelerator: 'CmdOrCtrl+R', category: 'navigation' },
  { id: 'nav.hardReload', label: 'Hard Reload', defaultAccelerator: 'CmdOrCtrl+Shift+R', category: 'navigation' },
  { id: 'nav.back', label: 'Zurück', defaultAccelerator: 'Alt+Left', category: 'navigation' },
  { id: 'nav.forward', label: 'Vor', defaultAccelerator: 'Alt+Right', category: 'navigation' },
  { id: 'nav.home', label: 'Startseite', defaultAccelerator: 'CmdOrCtrl+H', category: 'navigation' },
  { id: 'nav.fullscreen', label: 'Vollbild', defaultAccelerator: 'F11', category: 'navigation' },
  { id: 'nav.devtools', label: 'DevTools', defaultAccelerator: 'F12', category: 'navigation' },
  { id: 'nav.zoomIn', label: 'Zoom +', defaultAccelerator: 'CmdOrCtrl+=', category: 'navigation' },
  { id: 'nav.zoomOut', label: 'Zoom -', defaultAccelerator: 'CmdOrCtrl+-', category: 'navigation' },
  { id: 'nav.zoomReset', label: 'Zoom zurücksetzen', defaultAccelerator: 'CmdOrCtrl+0', category: 'navigation' },
  // Quick-Nav Slots
  { id: 'quicknav.slot1', label: 'Quick-Nav Slot 1', defaultAccelerator: 'CmdOrCtrl+1', category: 'quicknav' },
  { id: 'quicknav.slot2', label: 'Quick-Nav Slot 2', defaultAccelerator: 'CmdOrCtrl+2', category: 'quicknav' },
  { id: 'quicknav.slot3', label: 'Quick-Nav Slot 3', defaultAccelerator: 'CmdOrCtrl+3', category: 'quicknav' },
  { id: 'quicknav.slot4', label: 'Quick-Nav Slot 4', defaultAccelerator: 'CmdOrCtrl+4', category: 'quicknav' },
  { id: 'quicknav.slot5', label: 'Quick-Nav Slot 5', defaultAccelerator: 'CmdOrCtrl+5', category: 'quicknav' },
];

/** Get the effective accelerator for an action (user override or default) */
export function getEffectiveAccelerator(actionId: string): string {
  const overrides = getSetting('keybinds.overrides');
  if (overrides[actionId]) return overrides[actionId];
  const action = KEYBIND_ACTIONS.find((a) => a.id === actionId);
  return action?.defaultAccelerator ?? '';
}

/** Get the default accelerator for an action */
export function getDefaultAccelerator(actionId: string): string {
  const action = KEYBIND_ACTIONS.find((a) => a.id === actionId);
  return action?.defaultAccelerator ?? '';
}

/** Find conflicting action if the given accelerator is already used */
export function findConflict(actionId: string, accelerator: string): KeybindAction | null {
  if (!accelerator) return null;
  const normalized = accelerator.toLowerCase();
  for (const action of KEYBIND_ACTIONS) {
    if (action.id === actionId) continue;
    const effective = getEffectiveAccelerator(action.id).toLowerCase();
    if (effective === normalized) return action;
  }
  return null;
}

/** Get all actions with their effective accelerators (for sending to renderer) */
export function getActionsWithAccelerators(): Array<KeybindAction & { effectiveAccelerator: string }> {
  return KEYBIND_ACTIONS.map((action) => ({
    ...action,
    effectiveAccelerator: getEffectiveAccelerator(action.id),
  }));
}
