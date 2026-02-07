const { app, BrowserWindow, BrowserView, globalShortcut } = require('electron');
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
  // BrowserViews load external sites — no preload/sandbox needed
  const viewPreferences = {
    contextIsolation: true,
    nodeIntegration: false,
  };

  leftView = new BrowserView({ webPreferences: viewPreferences });
  rightView = new BrowserView({ webPreferences: viewPreferences });

  mainWindow.addBrowserView(leftView);
  mainWindow.addBrowserView(rightView);

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
    mainWindow = null;
    leftView = null;
    rightView = null;
  });

  createViews();
  registerIpcHandlers({ mainWindow, leftView, rightView, setSidebarWidth, getSidebarWidth });
  registerShortcuts();

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function registerShortcuts() {
  // Cmd/Ctrl+R: Reload both views
  globalShortcut.register('CommandOrControl+R', () => {
    if (!mainWindow || !mainWindow.isFocused()) return;
    if (leftView) leftView.webContents.reload();
    if (rightView) rightView.webContents.reload();
  });

  // Cmd/Ctrl+Shift+R: Reload active view only
  globalShortcut.register('CommandOrControl+Shift+R', () => {
    if (!mainWindow || !mainWindow.isFocused()) return;
    if (leftView && leftView.webContents.isFocused()) {
      leftView.webContents.reload();
    } else if (rightView) {
      rightView.webContents.reload();
    }
  });

  // Cmd/Ctrl+Shift+S: Capture & compare
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (!mainWindow || !mainWindow.isFocused()) return;
    mainWindow.webContents.send('shortcut-capture');
  });

  // Cmd/Ctrl+Shift+O: Open latest report
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    if (!mainWindow || !mainWindow.isFocused()) return;
    mainWindow.webContents.send('shortcut-open-report');
  });

  // Cmd/Ctrl+1~5: Device presets
  const presetKeys = ['1', '2', '3', '4', '5'];
  presetKeys.forEach((key) => {
    globalShortcut.register(`CommandOrControl+${key}`, () => {
      if (!mainWindow || !mainWindow.isFocused()) return;
      mainWindow.webContents.send('shortcut-preset', { index: parseInt(key) - 1 });
    });
  });

  // Cmd/Ctrl+,: Open settings
  globalShortcut.register('CommandOrControl+,', () => {
    if (!mainWindow || !mainWindow.isFocused()) return;
    mainWindow.webContents.send('shortcut-settings');
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

module.exports = { createWindow, layoutViews, setSidebarWidth, getSidebarWidth };
