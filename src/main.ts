import {
  app,
  BrowserWindow,
  shell,
  Menu,
  Notification,
  ipcMain,
  Tray,
  nativeImage,
  clipboard,
  type MenuItemConstructorOptions,
  type NativeImage,
} from 'electron';
import * as path from 'path';
import windowStateKeeper from 'electron-window-state';

import { APP_CONFIG, TRAY_ICONS, type Platform } from './types/config';
import { IPC_CHANNELS, type NotificationPayload } from './types/ipc';
import { initAutoUpdater } from './updater';
import { initNotifications, restartPolling } from './push';
import { initSettingsIpc } from './settings/ipc';
import { getSetting, setSetting, onSettingChanged } from './settings/store';
import { getSettingsInjectionScript } from './settings-inject';
import { getEffectiveAccelerator } from './keybinds';

// --- State ---

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let unreadCount = 0;
let originalTrayIcon: NativeImage | null = null;

// --- Window Creation ---

function createWindow(): void {
  const mainWindowState = windowStateKeeper({
    defaultWidth: APP_CONFIG.WINDOW.DEFAULT_WIDTH,
    defaultHeight: APP_CONFIG.WINDOW.DEFAULT_HEIGHT,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: APP_CONFIG.WINDOW.MIN_WIDTH,
    minHeight: APP_CONFIG.WINDOW.MIN_HEIGHT,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
    show: false,
    autoHideMenuBar: true,
  });

  mainWindowState.manage(mainWindow);

  mainWindow.loadURL(APP_CONFIG.TARGET_URL);

  // Grant notification and push permissions so the web app can activate them
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['notifications', 'push'];
    callback(allowed.includes(permission));
  });

  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) => {
    const allowed = ['notifications', 'push'];
    return allowed.includes(permission);
  });

  // Show window when page is ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Inject PushManager mock + Notification override into main world before page scripts run
  // (contextIsolation prevents preload prototype patches from reaching the page)
  // Mocks PushManager so the push toggle in the site works without errors.
  // Actual notifications come from API polling in the main process.
  function getNotificationMockScript(): string {
    return `
    (function() {
      // --- Notification Override ---
      function NotificationOverride(title, options) {
        options = options || {};
        window.postMessage({
          type: '__electron_notification__',
          title: title,
          body: options.body || '',
          icon: options.icon || undefined,
        }, '*');
        this.title = title;
        this.body = options.body || '';
        this.onclick = null;
        this.onclose = null;
        this.onerror = null;
        this.close = function() {};
      }
      NotificationOverride.permission = 'granted';
      NotificationOverride.requestPermission = function(cb) {
        if (cb) cb('granted');
        return Promise.resolve('granted');
      };
      Object.defineProperty(window, 'Notification', {
        value: NotificationOverride,
        writable: false,
        configurable: false,
      });
    })();
    `;
  }

  function getPushMockScript(): string {
    return `
    (function() {
      if (typeof PushManager === 'undefined') return;

      var endpoint = 'https://electron-desktop.local/push-mock';
      var p256dh = '';
      var auth = '';

      var mockSub = {
        endpoint: endpoint,
        expirationTime: null,
        options: { applicationServerKey: null, userVisibleOnly: true },
        getKey: function(name) {
          if (name === 'p256dh' && p256dh) {
            var raw = atob(p256dh.replace(/-/g, '+').replace(/_/g, '/'));
            var arr = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
            return arr.buffer;
          }
          if (name === 'auth' && auth) {
            var raw = atob(auth.replace(/-/g, '+').replace(/_/g, '/'));
            var arr = new Uint8Array(raw.length);
            for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
            return arr.buffer;
          }
          return null;
        },
        toJSON: function() { return { endpoint: endpoint, keys: { p256dh: p256dh, auth: auth } }; },
        unsubscribe: function() { return Promise.resolve(true); }
      };

      PushManager.prototype.subscribe = function() { return Promise.resolve(mockSub); };
      PushManager.prototype.getSubscription = function() { return Promise.resolve(null); };
      PushManager.prototype.permissionState = function() { return Promise.resolve('granted'); };

      // Intercept XHR calls to push subscribe/unsubscribe API endpoints
      var origXHROpen = XMLHttpRequest.prototype.open;
      var origXHRSend = XMLHttpRequest.prototype.send;
      var pushUrlPattern = /\\/api\\/v1\\/notifications\\/push\\/(subscribe|unsubscribe)/;

      XMLHttpRequest.prototype.open = function(method, url) {
        this._isPushMock = pushUrlPattern.test(String(url));
        if (!this._isPushMock) {
          return origXHROpen.apply(this, arguments);
        }
        this._mockMethod = method;
        this._mockUrl = url;
        return origXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body) {
        if (this._isPushMock) {
          var self = this;
          setTimeout(function() {
            Object.defineProperty(self, 'status', { get: function() { return 200; } });
            Object.defineProperty(self, 'readyState', { get: function() { return 4; } });
            Object.defineProperty(self, 'responseText', { get: function() { return JSON.stringify({ success: true }); } });
            Object.defineProperty(self, 'response', { get: function() { return JSON.stringify({ success: true }); } });
            if (self.onreadystatechange) self.onreadystatechange(new Event('readystatechange'));
            if (self.onload) self.onload(new ProgressEvent('load'));
            self.dispatchEvent(new Event('load'));
            self.dispatchEvent(new Event('loadend'));
          }, 10);
          return;
        }
        return origXHRSend.apply(this, arguments);
      };

      // Also intercept fetch for the same endpoints
      var origFetch = window.fetch;
      window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (pushUrlPattern.test(url)) {
          return Promise.resolve(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          }));
        }
        return origFetch.apply(this, arguments);
      };
    })();
    `;
  }

  // did-start-navigation fires before any page JS executes — failures are expected
  // because the new JS context may not be ready yet. dom-ready below is the reliable fallback.
  mainWindow.webContents.on('did-start-navigation', () => {
    mainWindow?.webContents.executeJavaScript(getNotificationMockScript()).catch(() => {});
    mainWindow?.webContents.executeJavaScript(getPushMockScript()).catch(() => {});
    mainWindow?.webContents.executeJavaScript(getSettingsInjectionScript()).catch(() => {});
  });

  // Fallback: also inject on dom-ready in case did-start-navigation was too early
  mainWindow.webContents.on('dom-ready', () => {
    mainWindow?.webContents.executeJavaScript(getNotificationMockScript()).catch((e) => {
      console.error('[NotificationMock] Injection failed on dom-ready:', e);
    });
    mainWindow?.webContents.executeJavaScript(getPushMockScript()).catch((e) => {
      console.error('[PushMock] Injection failed on dom-ready:', e);
    });
    mainWindow?.webContents.executeJavaScript(getSettingsInjectionScript()).catch((e) => {
      console.error('[SettingsInject] Injection failed on dom-ready:', e);
    });

    // Apply zoom level from settings
    const zoomLevel = getSetting('appearance.zoomLevel');
    if (zoomLevel !== 0) {
      mainWindow?.webContents.setZoomLevel(zoomLevel);
    }
  });

  // Intercept ALL keyboard input during keybind recording
  // before-input-event fires before Chromium processes the key
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isRecordingKeybind) return;
    if (input.type !== 'keyDown') return;

    // Allow standalone modifier presses (user is still composing)
    const key = input.key;
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return;

    // Let Escape/Delete/Backspace through to the renderer for cancel/remove
    if (key === 'Escape' || key === 'Delete' || key === 'Backspace') return;

    // Build accelerator parts
    const parts: string[] = [];
    if (input.control || input.meta) parts.push('CmdOrCtrl');
    if (input.alt) parts.push('Alt');
    if (input.shift) parts.push('Shift');

    // Map key to Electron accelerator format
    let mappedKey = key;
    const keyMap: Record<string, string> = {
      'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'ArrowUp': 'Up', 'ArrowDown': 'Down',
      ' ': 'Space', 'Enter': 'Return', '+': 'Plus', 'Tab': 'Tab',
    };
    if (keyMap[key]) {
      mappedKey = keyMap[key];
    } else if (key.length === 1) {
      mappedKey = key.toUpperCase();
    }

    // F-keys allowed without modifier, others require at least one
    const isFKey = /^F\d{1,2}$/.test(mappedKey);
    if (!isFKey && parts.length === 0) return;

    // Only prevent default for valid combinations we actually capture
    event.preventDefault();

    parts.push(mappedKey);
    const accelerator = parts.join('+');

    // Send captured key to renderer via executeJavaScript
    mainWindow?.webContents.executeJavaScript(
      `window.postMessage({ type: '__electron_keybind_captured__', accelerator: ${JSON.stringify(accelerator)} }, '*');`
    ).catch(() => {});
  });

  // Minimize to tray instead of closing (respects closeToTray setting)
  mainWindow.on('close', (event) => {
    if (!isQuitting && getSetting('general.closeToTray')) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Reset badge when window is focused (user has seen notifications)
  mainWindow.on('focus', () => {
    unreadCount = 0;
    updateUnreadBadge(0);
  });

  // Update title from the webpage and extract unread count
  mainWindow.webContents.on('page-title-updated', (_event, title) => {
    mainWindow?.setTitle(`${title} — ${APP_CONFIG.APP_NAME}`);

    // Extract unread count from title format like "(3) AniSocial - Messages"
    const match = title.match(/^\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    updateUnreadBadge(count);
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_CONFIG.TARGET_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  // Also catch navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(APP_CONFIG.TARGET_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Context menu
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const menuItems: MenuItemConstructorOptions[] = [];

    if (params.isEditable) {
      menuItems.push(
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      );
    } else if (params.selectionText) {
      menuItems.push(
        { role: 'copy' },
        { role: 'selectAll' },
      );
    }

    if (params.linkURL) {
      menuItems.push(
        { type: 'separator' },
        {
          label: 'Link im Browser öffnen',
          click: () => shell.openExternal(params.linkURL),
        },
        {
          label: 'Link kopieren',
          click: () => clipboard.writeText(params.linkURL),
        },
      );
    }

    if (params.mediaType === 'image') {
      menuItems.push(
        { type: 'separator' },
        {
          label: 'Bild im Browser öffnen',
          click: () => shell.openExternal(params.srcURL),
        },
      );
    }

    menuItems.push(
      { type: 'separator' },
      {
        label: 'Zurück',
        enabled: mainWindow?.webContents.navigationHistory.canGoBack() ?? false,
        click: () => mainWindow?.webContents.navigationHistory.goBack(),
      },
      {
        label: 'Vor',
        enabled: mainWindow?.webContents.navigationHistory.canGoForward() ?? false,
        click: () => mainWindow?.webContents.navigationHistory.goForward(),
      },
      { type: 'separator' },
      {
        label: 'Neu laden',
        click: () => mainWindow?.webContents.reload(),
      },
    );

    const contextMenu = Menu.buildFromTemplate(menuItems);
    contextMenu.popup();
  });
}

// --- IPC Handlers ---

ipcMain.on(IPC_CHANNELS.SHOW_NOTIFICATION, (_event, payload: NotificationPayload) => {
  if (!getSetting('notifications.enabled')) return;

  const notification = new Notification({
    title: payload.title || APP_CONFIG.APP_NAME,
    body: payload.body || '',
    icon: payload.icon || path.join(__dirname, '..', 'assets', 'icon.png'),
    silent: !getSetting('notifications.sound'),
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  notification.show();
});

ipcMain.on(IPC_CHANNELS.UPDATE_BADGE, () => {
  // Only increment if window is not focused
  if (mainWindow && !mainWindow.isFocused()) {
    unreadCount++;
    updateUnreadBadge(unreadCount);
  }
});

// --- Keybind Recording ---
// Captures ALL key input at Electron level (before Chromium handles it)
let isRecordingKeybind = false;

ipcMain.on(IPC_CHANNELS.KEYBINDS_RECORDING_START, () => {
  isRecordingKeybind = true;
  Menu.setApplicationMenu(null);
});

ipcMain.on(IPC_CHANNELS.KEYBINDS_RECORDING_STOP, () => {
  isRecordingKeybind = false;
  buildApplicationMenu();
});

// --- Application Menu ---

function buildApplicationMenu(): void {
  const quickNavItems: MenuItemConstructorOptions[] = [];
  for (let i = 1; i <= 5; i++) {
    const slotPath = getSetting(`quicknav.slot${i}.path` as keyof import('./types/settings').SettingsSchema) as string;
    const slotLabel = getSetting(`quicknav.slot${i}.label` as keyof import('./types/settings').SettingsSchema) as string;
    const accelerator = getEffectiveAccelerator(`quicknav.slot${i}`);

    if (slotPath) {
      // Slot is assigned — navigate to it
      quickNavItems.push({
        label: slotLabel || `Slot ${i}: ${slotPath}`,
        accelerator,
        click: () => mainWindow?.loadURL(APP_CONFIG.TARGET_URL + slotPath),
      });
    } else {
      // Slot is empty — assign current page to it
      quickNavItems.push({
        label: `Slot ${i}: (aktuelle Seite zuweisen)`,
        accelerator,
        click: () => {
          if (!mainWindow) return;
          try {
            const currentUrl = mainWindow.webContents.getURL();
            const url = new URL(currentUrl);
            const pagePath = url.pathname;
            setSetting(`quicknav.slot${i}.path` as keyof import('./types/settings').SettingsSchema, pagePath as any);
            setSetting(`quicknav.slot${i}.label` as keyof import('./types/settings').SettingsSchema, '' as any);

            const notification = new Notification({
              title: APP_CONFIG.APP_NAME,
              body: `„${pagePath}" wurde als Quick-Nav Slot ${i} gespeichert.`,
              icon: path.join(__dirname, '..', 'assets', 'icon.png'),
              silent: true,
            });
            notification.show();
          } catch { /* ignore invalid URLs */ }
        },
      });
    }
  }

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Neu laden',
          accelerator: getEffectiveAccelerator('nav.reload'),
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Hard Reload',
          accelerator: getEffectiveAccelerator('nav.hardReload'),
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        {
          label: 'Zurück',
          accelerator: getEffectiveAccelerator('nav.back'),
          click: () => mainWindow?.webContents.navigationHistory.goBack(),
        },
        {
          label: 'Vor',
          accelerator: getEffectiveAccelerator('nav.forward'),
          click: () => mainWindow?.webContents.navigationHistory.goForward(),
        },
        {
          label: 'Startseite',
          accelerator: getEffectiveAccelerator('nav.home'),
          click: () => mainWindow?.loadURL(APP_CONFIG.TARGET_URL),
        },
        { type: 'separator' },
        {
          label: 'Vollbild',
          accelerator: getEffectiveAccelerator('nav.fullscreen'),
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        {
          label: 'DevTools',
          accelerator: getEffectiveAccelerator('nav.devtools'),
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        {
          label: 'Zoom +',
          accelerator: getEffectiveAccelerator('nav.zoomIn'),
          click: () => {
            const zoom = mainWindow?.webContents.getZoomLevel() ?? 0;
            mainWindow?.webContents.setZoomLevel(zoom + 0.5);
          },
        },
        {
          label: 'Zoom -',
          accelerator: getEffectiveAccelerator('nav.zoomOut'),
          click: () => {
            const zoom = mainWindow?.webContents.getZoomLevel() ?? 0;
            mainWindow?.webContents.setZoomLevel(zoom - 0.5);
          },
        },
        {
          label: 'Zoom zurücksetzen',
          accelerator: getEffectiveAccelerator('nav.zoomReset'),
          click: () => mainWindow?.webContents.setZoomLevel(0),
        },
        { type: 'separator' },
        ...(quickNavItems.length > 0 ? [...quickNavItems, { type: 'separator' as const }] : []),
        { role: 'quit' as const, label: 'Beenden' },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on('browser-window-created', () => {
  buildApplicationMenu();
});

// --- Tray Icon Setup ---

function getTrayIconFile(): string {
  const platform = process.platform as Platform;
  return TRAY_ICONS[platform] ?? TRAY_ICONS.linux;
}

function createTray(): void {
  const iconFile = getTrayIconFile();
  const iconPath = path.join(__dirname, '..', 'assets', iconFile);
  const trayIcon = nativeImage.createFromPath(iconPath);

  if (trayIcon.isEmpty()) {
    console.error(`Tray icon not found or invalid: ${iconPath}`);
    return;
  }

  if (process.platform === 'darwin') {
    trayIcon.setTemplateImage(true);
  }

  tray = new Tray(trayIcon);
  originalTrayIcon = trayIcon;
  tray.setToolTip(APP_CONFIG.APP_NAME);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Anzeigen',
      click: () => showWindow(),
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => showWindow());
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }

  if (!mainWindow.isVisible()) mainWindow.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

// --- Unread Badge (Cross-Platform) ---

function createBadgeIcon(count: number): NativeImage {
  const text = count > APP_CONFIG.MAX_BADGE_COUNT
    ? `${APP_CONFIG.MAX_BADGE_COUNT}+`
    : String(count);

  const svg = `
    <svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="8" fill="#e53935"/>
      <text x="8" y="12" text-anchor="middle" font-size="10" font-family="Arial, sans-serif" font-weight="bold" fill="white">${text}</text>
    </svg>`;

  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl);
}

function updateUnreadBadge(count: number): void {
  // Tooltip on all platforms
  if (tray) {
    tray.setToolTip(count > 0 ? `${APP_CONFIG.APP_NAME} (${count} ungelesen)` : APP_CONFIG.APP_NAME);
  }

  // Platform-specific badge
  if (process.platform === 'darwin') {
    app.dock?.setBadge(count > 0 ? String(count) : '');
  } else if (process.platform === 'win32') {
    if (mainWindow) {
      mainWindow.setOverlayIcon(
        count > 0 ? createBadgeIcon(count) : null,
        count > 0 ? `${count} ungelesene Nachrichten` : '',
      );
    }
  } else {
    // Linux (Unity launcher — works on KDE/Unity)
    app.setBadgeCount(count);

    // Tray icon overlay for Linux DEs without badge support
    if (tray) {
      if (count > 0) {
        tray.setImage(createTrayBadgeIcon(count));
      } else if (originalTrayIcon) {
        tray.setImage(originalTrayIcon);
      }
    }
  }
}

function createTrayBadgeIcon(count: number): NativeImage {
  const text = count > APP_CONFIG.MAX_BADGE_COUNT
    ? `${APP_CONFIG.MAX_BADGE_COUNT}+`
    : String(count);

  // 22x22 tray icon with badge overlay (red circle in top-right)
  const svg = `
    <svg width="22" height="22" xmlns="http://www.w3.org/2000/svg">
      <rect width="22" height="22" fill="none"/>
      <circle cx="15" cy="7" r="7" fill="#e53935"/>
      <text x="15" y="10" text-anchor="middle" font-size="9" font-family="Arial, sans-serif" font-weight="bold" fill="white">${text}</text>
    </svg>`;

  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  return nativeImage.createFromDataURL(dataUrl);
}

// --- App Lifecycle ---

app.on('before-quit', () => {
  isQuitting = true;
});

// Disable hardware acceleration before app is ready if setting is off
if (!getSetting('general.hardwareAcceleration')) {
  app.disableHardwareAcceleration();
}

app.whenReady().then(() => {
  initSettingsIpc();
  createWindow();
  createTray();
  initAutoUpdater();

  // Apply autostart setting
  app.setLoginItemSettings({ openAtLogin: getSetting('general.autoStart') });

  // React to settings changes
  onSettingChanged('general.autoStart', (value) => {
    app.setLoginItemSettings({ openAtLogin: value });
  });

  onSettingChanged('appearance.zoomLevel', (value) => {
    mainWindow?.webContents.setZoomLevel(value);
  });

  onSettingChanged('notifications.pollingIntervalSec', () => {
    restartPolling();
  });

  // Rebuild menu when keybinds or quick-nav slots change
  onSettingChanged('keybinds.overrides', () => buildApplicationMenu());
  for (let i = 1; i <= 5; i++) {
    onSettingChanged(`quicknav.slot${i}.path` as keyof import('./types/settings').SettingsSchema, () => buildApplicationMenu());
    onSettingChanged(`quicknav.slot${i}.label` as keyof import('./types/settings').SettingsSchema, () => buildApplicationMenu());
  }

  // Start notification polling (with WebSocket upgrade when available)
  initNotifications((title, body, badgeCount) => {
    // If title is empty, it's just a badge update (initial poll)
    if (title) {
      const notification = new Notification({
        title,
        body,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        silent: !getSetting('notifications.sound'),
      });

      notification.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      });

      notification.show();
    }

    // Update badge
    if (badgeCount > 0) {
      unreadCount = badgeCount;
      updateUnreadBadge(unreadCount);
    }
  });
});

app.on('window-all-closed', () => {
  // Do not quit — app stays in tray
});

app.on('activate', () => {
  // macOS: clicking dock icon should show the window
  if (mainWindow) {
    showWindow();
  } else {
    createWindow();
  }
});
