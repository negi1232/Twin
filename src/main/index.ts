/**
 * @module main/index
 * @description Electron メインプロセスのエントリーポイント。
 * BrowserWindow の生成、左右 WebContentsView のレイアウト管理、
 * アプリケーションメニュー（キーボードショートカット）の登録を行う。
 */

import * as path from 'node:path';
import { app, BrowserWindow, Menu, session, WebContentsView } from 'electron';
import { registerIpcHandlers } from './ipc-handlers';
import { getStore } from './store';

let mainWindow: BrowserWindow | null = null;
let leftView: WebContentsView | null = null;
let rightView: WebContentsView | null = null;
let sidebarWidth: number = 0;

const TOOLBAR_HEIGHT: number = 52;
const STATUS_BAR_HEIGHT: number = 28;
const preloadPath: string = path.join(__dirname, 'preload.js');

/**
 * 左右の WebContentsView を生成し mainWindow に追加する。
 * 保存済み URL またはデフォルト URL をロードする。
 */
function createViews(): void {
  // BrowserViews load external sites — sandbox isolates renderer processes
  const viewPreferences: Electron.WebPreferences = {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };

  leftView = new WebContentsView({ webPreferences: viewPreferences });
  rightView = new WebContentsView({ webPreferences: viewPreferences });

  mainWindow?.contentView.addChildView(leftView);
  mainWindow?.contentView.addChildView(rightView);

  layoutViews();

  // Load saved URLs or defaults
  const store = getStore();
  const leftUrl = store.get('leftUrl', 'http://localhost:3000') as string;
  const rightUrl = store.get('rightUrl', 'http://localhost:3001') as string;

  // Reset zoom on BrowserViews to clear any cached values
  leftView.webContents.setZoomFactor(1.0);
  leftView.webContents.setZoomLevel(0);
  rightView.webContents.setZoomFactor(1.0);
  rightView.webContents.setZoomLevel(0);

  leftView.webContents.loadURL(leftUrl).catch((err) => console.error('Failed to load left URL:', err.message));
  rightView.webContents.loadURL(rightUrl).catch((err) => console.error('Failed to load right URL:', err.message));

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

/**
 * ウィンドウサイズに合わせて左右ビューの位置・サイズを再計算する。
 * ツールバー・ステータスバー・サイドバーの幅を考慮して配置する。
 */
function layoutViews(): void {
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

/**
 * サイドバーの幅を設定し、ビューを再レイアウトする。
 */
function setSidebarWidth(w: number): void {
  sidebarWidth = w;
  layoutViews();
}

/**
 * 現在のサイドバー幅を返す。
 */
function getSidebarWidth(): number {
  return sidebarWidth;
}

/**
 * メインウィンドウまたはいずれかのビューがフォーカスを持っているか判定する。
 */
function isAppFocused(): boolean {
  if (!mainWindow) return false;
  if (mainWindow.isFocused()) return true;
  if (leftView && !leftView.webContents.isDestroyed() && leftView.webContents.isFocused()) return true;
  if (rightView && !rightView.webContents.isDestroyed() && rightView.webContents.isFocused()) return true;
  return false;
}

let blurTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * メインウィンドウを生成し、IPC ハンドラ・ショートカット・同期マネージャを初期化する。
 * フォーカス喪失時に同期を一時停止し、復帰時に再開する。
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Twin - Visual Regression Testing',
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
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
    mainWindow?.webContents.setZoomFactor(1.0);
    mainWindow?.webContents.setZoomLevel(0);
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
  if (!leftView || !rightView) {
    throw new Error('Failed to create views');
  }
  const { syncManager } = registerIpcHandlers({
    mainWindow,
    leftView,
    rightView,
    setSidebarWidth,
    getSidebarWidth,
  });
  registerShortcuts();

  // Re-inject sync script and resume sync when app regains focus
  mainWindow.on('focus', () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      blurTimeout = null;
    }
    if (syncManager?.isPaused()) {
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

/**
 * アプリケーションメニューを構築し、キーボードショートカットを登録する。
 * ビューのリロード、ズーム、デバイスプリセット切替、キャプチャ等に対応。
 */
function registerShortcuts(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
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
            if (leftView?.webContents.isFocused()) {
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
        ...(['1', '2', '3', '4', '5'] as const).map((key) => ({
          label: `Device Preset ${key}`,
          accelerator: `CommandOrControl+${key}`,
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-preset', { index: parseInt(key, 10) - 1 });
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
        { type: 'separator' },
        {
          label: 'CSS Full Scan',
          accelerator: 'CommandOrControl+Shift+C',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-css-scan');
          },
        },
        {
          label: 'CSS Inspect Mode',
          accelerator: 'CommandOrControl+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('shortcut-css-inspect');
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
      submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
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

  // Set Dock icon on macOS (needed for development mode)
  if (process.platform === 'darwin' && app.dock) {
    const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
    app.dock.setIcon(iconPath);
  }

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

export { createWindow, layoutViews, setSidebarWidth, getSidebarWidth, isAppFocused };
