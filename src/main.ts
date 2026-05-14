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

  // Show window when page is ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
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
    // Linux (Unity launcher)
    app.setBadgeCount(count);
  }
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
