const { app, BrowserWindow, WebContentsView, Menu, session } = require('electron');
const path = require('path');
const { registerIpcHandlers } = require('./ipc-handlers');
const { getStore } = require('./store');

let mainWindow = null;
let leftView = null;
let rightView = null;
let sidebarWidth = 0;

const TOOLBAR_HEIGHT = 52;
const STATUS_BAR_HEIGHT = 28;
const preloadPath = path.join(__dirname, 'preload.js');

function createViews() {
  // BrowserViews load external sites — sandbox isolates renderer processes
  const viewPreferences = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };

  leftView = new WebContentsView({ webPreferences: viewPreferences });
  rightView = new WebContentsView({ webPreferences: viewPreferences });

  mainWindow.contentView.addChildView(leftView);
  mainWindow.contentView.addChildView(rightView);

  layoutViews();

  // Load saved URLs or defaults
  const store = getStore();
  const leftUrl = store.get('leftUrl', 'http://localhost:3000');
  const rightUrl = store.get('rightUrl', 'http://localhost:3001');

  // Reset zoom on BrowserViews to clear any cached values
  leftView.webContents.setZoomFactor(1.0);
  leftView.webContents.setZoomLevel(0);
  rightView.webContents.setZoomFactor(1.0);
  rightView.webContents.setZoomLevel(0);

  leftView.webContents.loadURL(leftUrl).catch(() => {});
  rightView.webContents.loadURL(rightUrl).catch(() => {});

  // Error handling — ignore ERR_ABORTED (-3) which fires on normal redirects
  leftView.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (code !== -3) {
      console.error(`Left view failed to load ${url}: ${description}`);
    }
  });
  rightView.webContents.on('did-fail-load', (_event, code, description, url) => {
    if (code !== -3) {
      console.error(`Right view failed to load ${url}: ${description}`);
    }
  });
}

function layoutViews() {
  if (!mainWindow || !leftView || !rightView) return;

  const { width, height } = mainWindow.getContentBounds();
  const toolbarH = TOOLBAR_HEIGHT;
  const statusBarH = STATUS_BAR_HEIGHT;
  const sw = sidebarWidth;
  const contentHeight = height - toolbarH - statusBarH;
  const availableWidth = width - sw;
  const halfWidth = Math.floor(availableWidth / 2);

  leftView.setBounds({
    x: sw,
    y: toolbarH,
    width: halfWidth,
    height: contentHeight,
  });
  rightView.setBounds({
    x: sw + halfWidth,
    y: toolbarH,
    width: availableWidth - halfWidth,
    height: contentHeight,
  });
}

function setSidebarWidth(w) {
  sidebarWidth = w;
  layoutViews();
}

function getSidebarWidth() {
  return sidebarWidth;
}

function isAppFocused() {
  if (!mainWindow) return false;
  if (mainWindow.isFocused()) return true;
  if (leftView && !leftView.webContents.isDestroyed() && leftView.webContents.isFocused()) return true;
  if (rightView && !rightView.webContents.isDestroyed() && rightView.webContents.isFocused()) return true;
  return false;
}

let blurTimeout = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Twin - Visual Regression Testing',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

  // Force zoom to 1.0 — clear any cached zoom from previous sessions
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1.0);
    mainWindow.webContents.setZoomLevel(0);
  });

  mainWindow.on('resize', () => {
    layoutViews();
  });

  mainWindow.on('closed', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    mainWindow = null;
    leftView = null;
    rightView = null;
  });

  createViews();
  const { syncManager } = registerIpcHandlers({ mainWindow, leftView, rightView, setSidebarWidth, getSidebarWidth });
  registerShortcuts();

  // Re-inject sync script and resume sync when app regains focus
  mainWindow.on('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    if (syncManager && syncManager.isPaused()) {
      syncManager.resume();
      syncManager.inject();
    }
  });

  // Pause sync processing when app loses focus
  mainWindow.on('blur', () => {
    if (blurTimeout) clearTimeout(blurTimeout);
    blurTimeout = setTimeout(() => {
      if (!isAppFocused() && syncManager) {
        syncManager.pause();
      }
      blurTimeout = null;
    }, 150);
  });

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function registerShortcuts() {
  const template = [
    {
      label: 'Twin',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CommandOrControl+,',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-settings');
          },
        },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload Both Views',
          accelerator: 'CommandOrControl+R',
          click: () => {
            if (leftView) leftView.webContents.reload();
            if (rightView) rightView.webContents.reload();
          },
        },
        {
          label: 'Reload Active View',
          accelerator: 'CommandOrControl+Shift+R',
          click: () => {
            if (leftView && leftView.webContents.isFocused()) {
              leftView.webContents.reload();
            } else if (rightView) {
              rightView.webContents.reload();
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CommandOrControl+=',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-zoom-in');
          },
        },
        {
          label: 'Zoom Out',
          accelerator: 'CommandOrControl+-',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-zoom-out');
          },
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CommandOrControl+0',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-zoom-reset');
          },
        },
        { type: 'separator' },
        ...['1', '2', '3', '4', '5'].map((key) => ({
          label: `Device Preset ${key}`,
          accelerator: `CommandOrControl+${key}`,
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-preset', { index: parseInt(key) - 1 });
          },
        })),
      ],
    },
    {
      label: 'Actions',
      submenu: [
        {
          label: 'Capture & Compare',
          accelerator: 'CommandOrControl+Shift+S',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-capture');
          },
        },
        {
          label: 'Open Latest Report',
          accelerator: 'CommandOrControl+Shift+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-open-report');
          },
        },
      ],
    },
    {
      label: 'Edit',
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
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  // Deny all permission requests from loaded pages (camera, microphone, geolocation, etc.)
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

module.exports = { createWindow, layoutViews, setSidebarWidth, getSidebarWidth, isAppFocused };
