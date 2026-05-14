const { app, BrowserWindow, shell, Menu, Notification, ipcMain, session, Tray, nativeImage } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

const TARGET_URL = 'https://anisocial.de';

// Small 16×16 red-circle badge used as Windows taskbar overlay icon
const BADGE_ICON_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAO0lEQVR4nGNgoAW4o6b2HxumSDNRhhDSjNcQYjVjNYRUzRiGjBpABQMojkaqJCRiDcGrmZAhRGkmFQAAEihP1OSlKxAAAAAASUVORK5CYII=';

let mainWindow;
let tray = null;
let isQuitting = false;

/**
 * Extract an unread-message count from the page title.
 * Supports patterns like "(5) Page Title" or "Page Title (5)".
 */
function extractUnreadCount(title) {
  const leading = title.match(/^\((\d+)\)/);
  if (leading) return parseInt(leading[1], 10);
  const trailing = title.match(/\((\d+)\)\s*$/);
  if (trailing) return parseInt(trailing[1], 10);
  return 0;
}

/**
 * Apply a badge count to the app icon / taskbar:
 *   - macOS : dock badge via app.setBadgeCount()
 *   - Linux : launcher badge via app.setBadgeCount()
 *   - Windows: taskbar overlay icon via mainWindow.setOverlayIcon()
 */
function updateBadge(count) {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    app.setBadgeCount(count);
  }

  if (process.platform === 'win32' && mainWindow) {
    if (count > 0) {
      const badgeImage = nativeImage.createFromDataURL(
        `data:image/png;base64,${BADGE_ICON_BASE64}`,
      );
      mainWindow.setOverlayIcon(badgeImage, `${count} ungelesene Nachrichten`);
    } else {
      mainWindow.setOverlayIcon(null, '');
    }
  }

  if (tray) {
    const tooltip = count > 0
      ? `AniSocial – ${count} ungelesene Nachricht${count === 1 ? '' : 'en'}`
      : 'AniSocial';
    tray.setToolTip(tooltip);
  }
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('AniSocial');

  const buildMenu = () => Menu.buildFromTemplate([
    {
      label: 'Öffnen',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Beenden',
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(buildMenu());

  // Left-click: toggle window visibility
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1280,
    defaultHeight: 800,
  });

  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 400,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
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

  mainWindow.loadURL(TARGET_URL);

  // Initialise the system-tray icon
  createTray();

  // Show window when page is ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Update title and unread badge from the webpage
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    mainWindow.setTitle(`${title} — AniSocial`);
    updateBadge(extractUnreadCount(title));
  });

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(TARGET_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  // Also catch navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(TARGET_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Context menu
  mainWindow.webContents.on('context-menu', (event, params) => {
    const menuItems = [];

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
          click: () => {
            const { clipboard } = require('electron');
            clipboard.writeText(params.linkURL);
          },
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
        enabled: mainWindow.webContents.navigationHistory.canGoBack(),
        click: () => mainWindow.webContents.navigationHistory.goBack(),
      },
      {
        label: 'Vor',
        enabled: mainWindow.webContents.navigationHistory.canGoForward(),
        click: () => mainWindow.webContents.navigationHistory.goForward(),
      },
      { type: 'separator' },
      {
        label: 'Neu laden',
        click: () => mainWindow.webContents.reload(),
      },
    );

    const contextMenu = Menu.buildFromTemplate(menuItems);
    contextMenu.popup();
  });
}

// Handle notifications from preload
ipcMain.on('show-notification', (event, { title, body, icon }) => {
  const notification = new Notification({
    title: title || 'AniSocial',
    body: body || '',
    icon: icon || path.join(__dirname, 'assets', 'icon.png'),
  });

  notification.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notification.show();
});

// Allow the renderer to set the badge count explicitly (e.g. from a DOM observer)
ipcMain.on('set-badge-count', (event, count) => {
  updateBadge(typeof count === 'number' ? count : 0);
});

// Keyboard shortcuts
app.on('browser-window-created', (event, window) => {
  const template = [
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
          click: () => mainWindow?.loadURL(TARGET_URL),
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

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
