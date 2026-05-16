import { SETTINGS_DEFAULTS } from './types/settings';
import { KEYBIND_ACTIONS } from './keybinds';

/**
 * Settings injection script for the AniSocial /settings page.
 * Injects a "Programm" tab into the existing tab bar with app-specific settings.
 * Uses a declarative registry — add a new setting by adding one object to SETTINGS_REGISTRY.
 */
export function getSettingsInjectionScript(): string {
  const defaultsJson = JSON.stringify(SETTINGS_DEFAULTS);
  const keybindActionsJson = JSON.stringify(KEYBIND_ACTIONS);

  return `
(function() {
  'use strict';

  // Only run on /settings page
  if (window.location.pathname !== '/settings') return;

  // Prevent double-injection
  if (document.querySelector('[data-electron-settings-tab]')) return;

  // --- Declarative Settings Registry ---
  // To add a new setting: add an object here. Types: 'toggle', 'number', 'select'
  // Icons: Lucide SVG markup strings (18x18 for section headers, 20x20 for items)
  var ICONS = {
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    bell: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path></svg>',
    sun: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sun" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>',
    minimize: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-minus-square text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M8 12h8"></path></svg>',
    power: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-power text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><path d="M12 2v10"></path><path d="M18.4 6.6a9 9 0 1 1-12.8 0"></path></svg>',
    gpu: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cpu text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><rect width="16" height="16" x="4" y="4" rx="2"></rect><rect width="6" height="6" x="9" y="9" rx="1"></rect><path d="M15 2v2"></path><path d="M15 20v2"></path><path d="M2 15h2"></path><path d="M2 9h2"></path><path d="M20 15h2"></path><path d="M20 9h2"></path><path d="M9 2v2"></path><path d="M9 20v2"></path></svg>',
    bellRing: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell-ring text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><path d="M10.268 21a2 2 0 0 0 3.464 0"></path><path d="M22 8c0-2.3-.8-4.3-2-6"></path><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path><path d="M4 2C2.8 3.7 2 5.7 2 8"></path></svg>',
    volume: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-2 text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"></path><path d="M16 9a5 5 0 0 1 0 6"></path><path d="M19.364 18.364a9 9 0 0 0 0-12.728"></path></svg>',
    timer: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-timer text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><line x1="10" x2="14" y1="2" y2="2"></line><line x1="12" x2="15" y1="14" y2="11"></line><circle cx="12" cy="14" r="8"></circle></svg>',
    zoomIn: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-zoom-in text-text-secondary sm:mt-1 flex-shrink-0" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" x2="16.65" y1="21" y2="16.65"></line><line x1="11" x2="11" y1="8" y2="14"></line><line x1="8" x2="14" y1="11" y2="11"></line></svg>'
  };

  var SETTINGS_REGISTRY = [
    {
      section: 'Allgemein',
      sectionIcon: ICONS.settings,
      items: [
        { key: 'general.closeToTray', label: 'In Tray minimieren', description: 'App wird beim Schließen nicht beendet, sondern im Tray versteckt.', type: 'toggle', icon: ICONS.minimize },
        { key: 'general.autoStart', label: 'Autostart', description: 'App beim Systemstart automatisch starten.', type: 'toggle', icon: ICONS.power },
        { key: 'general.hardwareAcceleration', label: 'Hardware-Beschleunigung', description: 'GPU-Beschleunigung für bessere Performance. Neustart erforderlich.', type: 'toggle', icon: ICONS.gpu, requiresRestart: true },
      ]
    },
    {
      section: 'Benachrichtigungen',
      sectionIcon: ICONS.bell,
      items: [
        { key: 'notifications.enabled', label: 'Desktop-Benachrichtigungen', description: 'Desktop-Benachrichtigungen für neue Aktivitäten anzeigen.', type: 'toggle', icon: ICONS.bellRing },
        { key: 'notifications.sound', label: 'Benachrichtigungston', description: 'Ton bei neuen Benachrichtigungen abspielen.', type: 'toggle', icon: ICONS.volume },
        { key: 'notifications.pollingIntervalSec', label: 'Abfrage-Intervall', description: 'Wie oft nach neuen Benachrichtigungen geprüft wird (in Sekunden).', type: 'number', min: 10, max: 300, step: 5, icon: ICONS.timer },
      ]
    },
    {
      section: 'Darstellung',
      sectionIcon: ICONS.sun,
      items: [
        { key: 'appearance.zoomLevel', label: 'Zoom-Stufe', description: 'Zoom-Level der Anzeige. 0 = Standard.', type: 'number', min: -3, max: 3, step: 0.5, icon: ICONS.zoomIn },
      ]
    }
  ];

  // --- Quick-Nav Slots (rendered separately) ---
  var QUICKNAV_SLOTS = [
    { pathKey: 'quicknav.slot1.path', labelKey: 'quicknav.slot1.label', slot: 1 },
    { pathKey: 'quicknav.slot2.path', labelKey: 'quicknav.slot2.label', slot: 2 },
    { pathKey: 'quicknav.slot3.path', labelKey: 'quicknav.slot3.label', slot: 3 },
    { pathKey: 'quicknav.slot4.path', labelKey: 'quicknav.slot4.label', slot: 4 },
    { pathKey: 'quicknav.slot5.path', labelKey: 'quicknav.slot5.label', slot: 5 },
  ];

  // --- Keybind Actions (from main process) ---
  var KEYBIND_ACTIONS_DATA = ${keybindActionsJson};

  // --- SVG Icon (Lucide "monitor") ---
  var MONITOR_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-monitor md:w-[18px] md:h-[18px]" aria-hidden="true"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" x2="16" y1="21" y2="21"></line><line x1="12" x2="12" y1="17" y2="21"></line></svg>';

  // --- State ---
  var currentSettings = {};
  var settingsLoaded = false;

  // --- Communication with Preload ---
  function requestSettings() {
    window.postMessage({ type: '__electron_settings_get__' }, '*');
  }

  function saveSetting(key, value) {
    window.postMessage({ type: '__electron_settings_set__', key: key, value: value }, '*');
    currentSettings[key] = value;
  }

  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === '__electron_settings_data__') {
      currentSettings = event.data.settings;
      settingsLoaded = true;
      renderSettingsPanel();
    }
    if (event.data && event.data.type === '__electron_settings_updated__') {
      currentSettings[event.data.key] = event.data.value;
    }
  });

  // --- Tab Injection ---
  function injectTab() {
    var tablist = document.querySelector('div[role="tablist"][aria-label="Einstellungen"]');
    if (!tablist) return;
    if (tablist.querySelector('[data-electron-settings-tab]')) return;

    var tab = document.createElement('button');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.setAttribute('aria-label', 'Programm');
    tab.setAttribute('data-electron-settings-tab', 'true');
    tab.className = 'flex items-center justify-center gap-2 px-3 md:px-4 py-3 font-medium transition-colors relative flex-shrink-0 whitespace-nowrap cursor-pointer text-text-secondary hover:text-text-primary';
    tab.innerHTML = MONITOR_ICON + '<span class="hidden md:inline">Programm</span>';

    tab.addEventListener('click', function() {
      activateProgrammTab(tablist, tab);
    });

    tablist.appendChild(tab);
  }

  function activateProgrammTab(tablist, tab) {
    // Deactivate all other tabs
    var allTabs = tablist.querySelectorAll('button[role="tab"]');
    allTabs.forEach(function(t) {
      t.setAttribute('aria-selected', 'false');
      t.className = 'flex items-center justify-center gap-2 px-3 md:px-4 py-3 font-medium transition-colors relative flex-shrink-0 whitespace-nowrap cursor-pointer text-text-secondary hover:text-text-primary';
      // Remove underline indicators
      var indicator = t.querySelector('.bg-accent-primary');
      if (indicator) indicator.remove();
    });

    // Activate our tab
    tab.setAttribute('aria-selected', 'true');
    tab.className = 'flex items-center justify-center gap-2 px-3 md:px-4 py-3 font-medium transition-colors relative flex-shrink-0 whitespace-nowrap cursor-pointer text-accent-primary';
    var indicator = document.createElement('div');
    indicator.className = 'absolute bottom-0 left-0 right-0 h-0.5 bg-accent-primary';
    tab.appendChild(indicator);

    // Replace content panel
    showSettingsPanel(tablist);
  }

  function showSettingsPanel(tablist) {
    // Find the content area (sibling after the tablist, or parent's next relevant child)
    var container = tablist.parentElement;
    if (!container) return;

    // Remove existing content panels (everything after tablist within the container)
    var children = Array.from(container.children);
    var tablistIndex = children.indexOf(tablist);
    for (var i = tablistIndex + 1; i < children.length; i++) {
      children[i].style.display = 'none';
    }

    // Create or show our panel
    var panel = container.querySelector('[data-electron-settings-panel]');
    if (!panel) {
      panel = document.createElement('div');
      panel.setAttribute('data-electron-settings-panel', 'true');
      panel.className = 'space-y-6';
      container.appendChild(panel);
    }
    panel.style.display = '';

    if (!settingsLoaded) {
      panel.innerHTML = '<div class="text-text-secondary text-center py-8">Einstellungen werden geladen...</div>';
      requestSettings();
    } else {
      renderSettingsPanel();
    }
  }

  function renderSettingsPanel() {
    var panel = document.querySelector('[data-electron-settings-panel]');
    if (!panel) return;
    if (panel.style.display === 'none') return;

    var html = '';

    SETTINGS_REGISTRY.forEach(function(section) {
      html += '<div class="bg-bg-elevated rounded-md border border-line p-4 sm:p-6">';
      html += '<h2 class="text-base sm:text-xl font-semibold text-text-primary mb-4 flex items-start sm:items-center gap-2 min-w-0">';
      html += section.sectionIcon;
      html += '<span lang="de" class="min-w-0 hyphens-auto">' + section.section + '</span>';
      html += '</h2>';
      html += '<div class="space-y-4">';

      section.items.forEach(function(item) {
        var value = currentSettings[item.key];
        if (value === undefined) value = getDefault(item.key);

        html += '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-bg-surface rounded-md border border-white/[0.04]">';
        html += '<div class="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 flex-1 min-w-0">';
        if (item.icon) {
          html += item.icon;
        }
        html += '<div class="min-w-0">';
        html += '<h3 class="text-text-primary font-medium">' + item.label + '</h3>';
        if (item.description) {
          html += '<p class="text-sm text-text-secondary mt-1">' + item.description + '</p>';
        }
        html += '</div>';
        html += '</div>';

        html += '<div class="flex-shrink-0 self-start sm:self-auto">';
        if (item.type === 'toggle') {
          html += renderToggle(item.key, value);
        } else if (item.type === 'number') {
          html += renderNumberInput(item.key, value, item.min, item.max, item.step);
        }
        html += '</div>';

        html += '</div>';
      });

      html += '</div>';
      html += '</div>';
    });

    // --- Quick-Navigation Section ---
    html += '<div class="bg-bg-elevated rounded-md border border-line p-4 sm:p-6">';
    html += '<h2 class="text-base sm:text-xl font-semibold text-text-primary mb-4 flex items-start sm:items-center gap-2 min-w-0">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"></path><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"></path><path d="M12 3v6"></path></svg>';
    html += '<span lang="de" class="min-w-0 hyphens-auto">Quick-Navigation</span>';
    html += '</h2>';
    html += '<p class="text-sm text-text-secondary mb-4">Belege bis zu 5 Slots mit beliebigen Seiten-Pfaden. Nutze die Tastenkürzel (Standard: Strg+1 bis Strg+5) um schnell dorthin zu navigieren.</p>';
    html += '<div class="space-y-3">';

    QUICKNAV_SLOTS.forEach(function(slot) {
      var pathVal = currentSettings[slot.pathKey] || '';
      var labelVal = currentSettings[slot.labelKey] || '';
      html += '<div class="flex flex-col sm:flex-row gap-2 p-3 bg-bg-surface rounded-md border border-white/[0.04]">';
      html += '<div class="flex items-center gap-2 flex-shrink-0 w-16"><span class="text-text-secondary text-sm font-medium">Slot ' + slot.slot + '</span></div>';
      html += '<input type="text" data-quicknav-label="' + slot.labelKey + '" value="' + escapeAttr(labelVal) + '" placeholder="Label" class="flex-1 min-w-0 px-3 py-1.5 rounded-md border border-line bg-bg-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30">';
      html += '<input type="text" data-quicknav-path="' + slot.pathKey + '" value="' + escapeAttr(pathVal) + '" placeholder="/notifications" class="flex-1 min-w-0 px-3 py-1.5 rounded-md border border-line bg-bg-elevated text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary/30">';
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    // --- Tastenkürzel Section ---
    html += '<div class="bg-bg-elevated rounded-md border border-line p-4 sm:p-6">';
    html += '<h2 class="text-base sm:text-xl font-semibold text-text-primary mb-4 flex items-start sm:items-center gap-2 min-w-0">';
    html += '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 8h.01"></path><path d="M12 12h.01"></path><path d="M14 8h.01"></path><path d="M16 12h.01"></path><path d="M18 8h.01"></path><path d="M6 8h.01"></path><path d="M7 16h10"></path><path d="M8 12h.01"></path><rect width="20" height="16" x="2" y="4" rx="2"></rect></svg>';
    html += '<span lang="de" class="min-w-0 hyphens-auto">Tastenkürzel</span>';
    html += '</h2>';
    html += '<p class="text-sm text-text-secondary mb-4">Klicke auf ein Tastenkürzel um es neu zu belegen. Drücke Escape zum Abbrechen oder Entf/Backspace zum Entfernen. Einzelne Buchstaben ohne Modifier (Strg/Alt/Shift) sind nicht erlaubt.</p>';
    html += '<div class="space-y-2">';

    var overrides = currentSettings['keybinds.overrides'] || {};
    KEYBIND_ACTIONS_DATA.forEach(function(action) {
      var effective = overrides[action.id] || action.defaultAccelerator;
      var isOverridden = !!overrides[action.id];
      html += '<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-bg-surface rounded-md border border-white/[0.04]">';
      html += '<div class="min-w-0"><span class="text-text-primary text-sm font-medium">' + action.label + '</span>';
      html += '<span class="text-xs text-text-secondary ml-2">(' + (action.category === 'quicknav' ? 'Quick-Nav' : 'Navigation') + ')</span></div>';
      html += '<div class="flex items-center gap-2 flex-shrink-0">';
      html += '<button type="button" data-keybind-action="' + action.id + '" class="keybind-btn px-3 py-1.5 rounded-md border border-line bg-bg-elevated text-text-primary text-sm font-mono cursor-pointer hover:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/30 transition-colors min-w-[120px] text-center">' + formatAccelerator(effective) + '</button>';
      if (isOverridden) {
        html += '<button type="button" data-keybind-reset="' + action.id + '" class="text-xs text-text-secondary hover:text-accent-primary cursor-pointer transition-colors" title="Zurücksetzen">↺</button>';
      }
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    // Version info
    html += '<div class="text-center text-xs text-text-secondary py-2">AniSocial Desktop</div>';

    panel.innerHTML = html;

    // Bind event listeners
    bindEvents(panel);
  }

  function renderToggle(key, value) {
    var checked = value ? 'checked' : '';
    return '<label class="relative inline-flex items-center cursor-pointer flex-shrink-0">' +
      '<input type="checkbox" data-settings-key="' + key + '" ' + checked + ' class="sr-only peer">' +
      '<div class="w-11 h-6 bg-line peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary/30 rounded-full peer peer-checked:after:translate-x-full after:content-[\\'\\'] after:absolute after:top-[2px] after:left-[2px] after:bg-bg-elevated after:border after:border-line after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary peer-checked:after:bg-white peer-checked:after:border-accent-primary"></div>' +
      '</label>';
  }

  function renderNumberInput(key, value, min, max, step) {
    return '<input type="number" data-settings-key="' + key + '" value="' + value + '" ' +
      'min="' + (min !== undefined ? min : '') + '" ' +
      'max="' + (max !== undefined ? max : '') + '" ' +
      'step="' + (step !== undefined ? step : 1) + '" ' +
      'class="w-20 px-3 py-1.5 rounded-md border border-line bg-bg-elevated text-text-primary text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent-primary/30">';
  }

  var SETTINGS_DEFAULTS = ${defaultsJson};
  function getDefault(key) {
    return SETTINGS_DEFAULTS[key];
  }

  function escapeAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function formatAccelerator(accel) {
    if (!accel) return '<span class="text-text-secondary italic">Nicht belegt</span>';
    return accel
      .replace(/CmdOrCtrl/g, 'Strg')
      .replace(/Ctrl/g, 'Strg')
      .replace(/Shift/g, '⇧')
      .replace(/Alt/g, 'Alt')
      .replace(/Left/g, '←')
      .replace(/Right/g, '→')
      .replace(/Up/g, '↑')
      .replace(/Down/g, '↓')
      .replace(/\\+/g, ' + ');
  }

  // Active keybind recording state
  var recordingActionId = null;
  var recordingBtn = null;

  function stopRecording() {
    if (recordingBtn) {
      var overrides = currentSettings['keybinds.overrides'] || {};
      var action = KEYBIND_ACTIONS_DATA.find(function(a) { return a.id === recordingActionId; });
      var effective = (overrides[recordingActionId] || (action ? action.defaultAccelerator : ''));
      recordingBtn.innerHTML = formatAccelerator(effective);
      recordingBtn.classList.remove('border-accent-primary', 'ring-2', 'ring-accent-primary/30');
    }
    recordingActionId = null;
    recordingBtn = null;
    document.removeEventListener('keydown', handleEscapeCancel, true);
    // Re-enable menu accelerators
    window.postMessage({ type: '__electron_keybinds_recording_stop__' }, '*');
  }

  // Only handle Escape/Delete/Backspace locally (these don't get captured by before-input-event)
  function handleEscapeCancel(e) {
    if (!recordingActionId) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      stopRecording();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      var overrides = currentSettings['keybinds.overrides'] || {};
      var newOverrides = Object.assign({}, overrides);
      delete newOverrides[recordingActionId];
      saveSetting('keybinds.overrides', newOverrides);
      stopRecording();
      renderSettingsPanel();
      return;
    }
  }

  // Handle captured accelerator from main process (via before-input-event)
  function handleCapturedAccelerator(accel) {
    if (!recordingActionId) return;

    // Check for conflicts
    var overrides = currentSettings['keybinds.overrides'] || {};
    var conflict = null;
    KEYBIND_ACTIONS_DATA.forEach(function(a) {
      if (a.id === recordingActionId) return;
      var eff = (overrides[a.id] || a.defaultAccelerator).toLowerCase();
      if (eff === accel.toLowerCase()) conflict = a;
    });

    if (conflict) {
      recordingBtn.innerHTML = '<span class="text-red-400 text-xs">Konflikt: ' + escapeAttr(conflict.label) + '</span>';
      setTimeout(function() {
        if (recordingBtn && recordingActionId) {
          recordingBtn.innerHTML = '<span class="text-accent-primary animate-pulse">Eingabe...</span>';
        }
      }, 1500);
      return;
    }

    // Save override
    var newOverrides = Object.assign({}, overrides);
    newOverrides[recordingActionId] = accel;
    saveSetting('keybinds.overrides', newOverrides);
    stopRecording();
    renderSettingsPanel();
  }

  // Listen for captured keybinds from main process
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === '__electron_keybind_captured__') {
      handleCapturedAccelerator(event.data.accelerator);
    }
  });

  function bindEvents(panel) {
    // Toggle switches
    var checkboxes = panel.querySelectorAll('input[type="checkbox"][data-settings-key]');
    checkboxes.forEach(function(cb) {
      cb.addEventListener('change', function() {
        saveSetting(cb.getAttribute('data-settings-key'), cb.checked);
      });
    });

    // Number inputs
    var numberInputs = panel.querySelectorAll('input[type="number"][data-settings-key]');
    numberInputs.forEach(function(input) {
      input.addEventListener('change', function() {
        var val = parseFloat(input.value);
        if (!isNaN(val)) {
          saveSetting(input.getAttribute('data-settings-key'), val);
        }
      });
    });

    // Quick-Nav path inputs
    var pathInputs = panel.querySelectorAll('input[data-quicknav-path]');
    pathInputs.forEach(function(input) {
      input.addEventListener('change', function() {
        var val = input.value.trim();
        // Ensure path starts with / if not empty
        if (val && val.charAt(0) !== '/') val = '/' + val;
        saveSetting(input.getAttribute('data-quicknav-path'), val);
      });
    });

    // Quick-Nav label inputs
    var labelInputs = panel.querySelectorAll('input[data-quicknav-label]');
    labelInputs.forEach(function(input) {
      input.addEventListener('change', function() {
        saveSetting(input.getAttribute('data-quicknav-label'), input.value.trim());
      });
    });

    // Keybind buttons — start recording on click
    var keybindBtns = panel.querySelectorAll('button[data-keybind-action]');
    keybindBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        // Stop any previous recording
        stopRecording();
        recordingActionId = btn.getAttribute('data-keybind-action');
        recordingBtn = btn;
        btn.innerHTML = '<span class="text-accent-primary animate-pulse">Eingabe...</span>';
        btn.classList.add('border-accent-primary', 'ring-2', 'ring-accent-primary/30');
        // Tell main process to capture keys via before-input-event
        window.postMessage({ type: '__electron_keybinds_recording_start__' }, '*');
        document.addEventListener('keydown', handleEscapeCancel, true);
      });
    });

    // Keybind reset buttons
    var resetBtns = panel.querySelectorAll('button[data-keybind-reset]');
    resetBtns.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var actionId = btn.getAttribute('data-keybind-reset');
        var overrides = currentSettings['keybinds.overrides'] || {};
        var newOverrides = Object.assign({}, overrides);
        delete newOverrides[actionId];
        saveSetting('keybinds.overrides', newOverrides);
        renderSettingsPanel();
      });
    });
  }

  // --- Restore original panels when a native tab is clicked ---
  function observeTabClicks() {
    var tablist = document.querySelector('div[role="tablist"][aria-label="Einstellungen"]');
    if (!tablist) return;

    tablist.addEventListener('click', function(e) {
      var tab = e.target.closest('button[role="tab"]');
      if (!tab || tab.hasAttribute('data-electron-settings-tab')) return;

      // A native tab was clicked — hide our panel, restore original panels
      var container = tablist.parentElement;
      if (!container) return;

      var panel = container.querySelector('[data-electron-settings-panel]');
      if (panel) panel.style.display = 'none';

      var children = Array.from(container.children);
      var tablistIndex = children.indexOf(tablist);
      for (var i = tablistIndex + 1; i < children.length; i++) {
        if (!children[i].hasAttribute('data-electron-settings-panel')) {
          children[i].style.display = '';
        }
      }
    });
  }

  // --- MutationObserver: Re-inject if React re-renders the tablist ---
  function setupObserver() {
    var observer = new MutationObserver(function() {
      if (window.location.pathname !== '/settings') return;
      var tablist = document.querySelector('div[role="tablist"][aria-label="Einstellungen"]');
      if (tablist && !tablist.querySelector('[data-electron-settings-tab]')) {
        injectTab();
        observeTabClicks();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Init ---
  function init() {
    injectTab();
    observeTabClicks();
    setupObserver();
    // Pre-fetch settings so they're ready when user clicks the tab
    requestSettings();
  }

  // Wait for the tablist to appear (Next.js may render after DOMContentLoaded)
  if (document.querySelector('div[role="tablist"][aria-label="Einstellungen"]')) {
    init();
  } else {
    var initObserver = new MutationObserver(function() {
      if (document.querySelector('div[role="tablist"][aria-label="Einstellungen"]')) {
        initObserver.disconnect();
        init();
      }
    });
    initObserver.observe(document.body, { childList: true, subtree: true });
  }
})();
`;
}
