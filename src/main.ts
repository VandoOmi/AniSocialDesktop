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
import * as fs from 'fs';
import windowStateKeeper from 'electron-window-state';

import { APP_CONFIG, TRAY_ICONS, type Platform } from './types/config';
import { IPC_CHANNELS, type NotificationPayload } from './types/ipc';
import { initAutoUpdater } from './updater';

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

  // Inject PushManager mock + API intercept into main world before page scripts run
  // (contextIsolation prevents preload prototype patches from reaching the page)
  // Since Electron has no push service, we mock both the PushManager AND intercept
  // the backend API calls for subscribe/unsubscribe so the toggle works seamlessly.
  const pushMockScript = `
    (function() {
      if (typeof PushManager === 'undefined') return;

      var mockSub = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/electron-desktop-mock',
        expirationTime: null,
        options: { applicationServerKey: null, userVisibleOnly: true },
        getKey: function() { return null; },
        toJSON: function() { return { endpoint: 'https://fcm.googleapis.com/fcm/send/electron-desktop-mock', keys: { p256dh: '', auth: '' } }; },
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
        // Store but don't actually open
        this._mockMethod = method;
        this._mockUrl = url;
        return origXHROpen.apply(this, arguments);
      };

      XMLHttpRequest.prototype.send = function(body) {
        if (this._isPushMock) {
          // Fake a successful response
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

      // --- DOM-based notification observer ---
      // Poll the notification badge counter on anisocial.de and fire native
      // notifications when the count increases after initial page load.
      var lastNotifCount = -1; // -1 = not yet initialized
      var badgeSelector = 'span.bg-accent-primary.rounded-full';
      var notifCooldown = false;

      function checkBadge() {
        var badge = document.querySelector(badgeSelector);
        var count = badge ? parseInt(badge.textContent || '0', 10) : 0;
        if (isNaN(count)) count = 0;

        if (lastNotifCount === -1) {
          // First read: just store the initial count, don't notify
          lastNotifCount = count;
          return;
        }

        // Ignore drops (React re-renders briefly remove the badge element)
        if (count < lastNotifCount) return;

        if (count > lastNotifCount && !notifCooldown) {
          var diff = count - lastNotifCount;
          var title = 'AniSocial';
          var body = diff === 1
            ? 'Du hast eine neue Benachrichtigung'
            : 'Du hast ' + diff + ' neue Benachrichtigungen';
          new Notification(title, { body: body });
          lastNotifCount = count;

          // Cooldown: no more notifications for 10 seconds
          notifCooldown = true;
          setTimeout(function() { notifCooldown = false; }, 10000);
        }
      }

      // Start polling after page settles
      setTimeout(function() {
        checkBadge(); // Initial read
        setInterval(checkBadge, 5000); // Check every 5 seconds
      }, 5000);
    })();
  `;

  // did-start-navigation fires before any page JS executes
  mainWindow.webContents.on('did-start-navigation', () => {
    mainWindow?.webContents.executeJavaScript(pushMockScript).catch(() => {});
  });

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
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
  const notification = new Notification({
    title: payload.title || APP_CONFIG.APP_NAME,
    body: payload.body || '',
    icon: payload.icon || path.join(__dirname, '..', 'assets', 'icon.png'),
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

// --- Application Menu ---

app.on('browser-window-created', () => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Neu laden',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        {
          label: 'Zurück',
          accelerator: 'Alt+Left',
          click: () => mainWindow?.webContents.navigationHistory.goBack(),
        },
        {
          label: 'Vor',
          accelerator: 'Alt+Right',
          click: () => mainWindow?.webContents.navigationHistory.goForward(),
        },
        {
          label: 'Startseite',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.loadURL(APP_CONFIG.TARGET_URL),
        },
        { type: 'separator' },
        {
          label: 'Vollbild',
          accelerator: 'F11',
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        {
          label: 'DevTools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        {
          label: 'Zoom +',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            const zoom = mainWindow?.webContents.getZoomLevel() ?? 0;
            mainWindow?.webContents.setZoomLevel(zoom + 0.5);
          },
        },
        {
          label: 'Zoom -',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const zoom = mainWindow?.webContents.getZoomLevel() ?? 0;
            mainWindow?.webContents.setZoomLevel(zoom - 0.5);
          },
        },
        {
          label: 'Zoom zurücksetzen',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.setZoomLevel(0),
        },
        { type: 'separator' },
        { role: 'quit', label: 'Beenden' },
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
});

// --- Tray Icon Setup ---

function getTrayIconFile(): string {
  const platform = process.platform as Platform;

  if (platform === 'darwin') {
    const templatePath = path.join(__dirname, '..', 'assets', 'iconTemplate.png');
    if (fs.existsSync(templatePath)) {
      return 'iconTemplate.png';
    }
  }

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
      <image href="data:image/png;base64," width="22" height="22" opacity="0"/>
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

app.whenReady().then(() => {
  createWindow();
  createTray();
  initAutoUpdater();
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
