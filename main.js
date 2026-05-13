const { app, BrowserWindow, shell, Menu, Notification, ipcMain, session } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

const TARGET_URL = 'https://anisocial.de';

let mainWindow;

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

  // Show window when page is ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Update title from the webpage
  mainWindow.webContents.on('page-title-updated', (event, title) => {
    mainWindow.setTitle(`${title} — AniSocial`);
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
      mainWindow.focus();
    }
  });

  notification.show();
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

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
