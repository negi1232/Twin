/**
 * @module main/ipc-handlers
 * @description Renderer プロセスからの IPC メッセージを処理するハンドラ群。
 * キャプチャ・比較、レポート表示、ナビゲーション、設定、同期、ズーム、
 * サイドバー操作（フォルダ選択・ディレクトリ読み取り・ファイルプレビュー）を提供する。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WebContentsView } from 'electron';
import { BrowserWindow, dialog, type IpcMainInvokeEvent, ipcMain } from 'electron';
import {
  DEFAULT_ZOOM,
  MAX_FILE_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  STATUS_BAR_HEIGHT,
  TOOLBAR_HEIGHT,
} from '../shared/constants';
import {
  buildGetElementStylesScript,
  buildHighlightScript,
  CLEAR_HIGHLIGHT_SCRIPT,
  CSS_INSPECT_CLEANUP_SCRIPT,
  CSS_INSPECT_PREFIX,
  CSS_INSPECT_SCRIPT,
  type CssScanResult,
  classifyProperty,
  compareStyles,
  generateScanReportHTML,
  runFullScan,
} from './css-compare';
import { runRegCli } from './reg-runner';
import { captureScreenshots } from './screenshot';
import { getSettings, getStore, saveSettings } from './store';
import { createSyncManager, type SyncManager } from './sync-manager';

/** ナビゲーションで許可する URL スキーム */
const ALLOWED_URL_SCHEMES: string[] = ['http:', 'https:'];

interface IpcHandlerOptions {
  mainWindow: BrowserWindow;
  leftView: WebContentsView;
  rightView: WebContentsView;
  setSidebarWidth: (w: number) => void;
  getSidebarWidth: () => number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * URL が許可されたスキーム（http/https）かどうか検証する。
 */
function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * targetPath が basePath 配下にあるか（パストラバーサル防止）を検証する。
 */
function isPathUnderBase(targetPath: string, basePath: string): boolean {
  try {
    const resolved = fs.realpathSync(targetPath);
    const resolvedBase = fs.realpathSync(basePath);
    return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
  } catch {
    return false;
  }
}

/**
 * すべての IPC ハンドラを登録し、SyncManager を初期化して返す。
 */
function registerIpcHandlers({
  mainWindow,
  leftView,
  rightView,
  setSidebarWidth,
  getSidebarWidth,
}: IpcHandlerOptions): { syncManager: SyncManager } {
  // --- Sync Manager ---
  const syncManager = createSyncManager(leftView, rightView);
  syncManager.start();

  // Capture screenshots and run reg-cli comparison
  ipcMain.handle('capture-and-compare', async (_event: IpcMainInvokeEvent, { pageName }: { pageName: string }) => {
    if (!leftView || !rightView) throw new Error('Views not ready');
    if (!pageName || !/^[a-zA-Z0-9_-]{1,100}$/.test(pageName)) {
      throw new Error('Invalid page name: only alphanumeric, underscore, and hyphen allowed (max 100 chars)');
    }

    const store = getStore();
    const snapshotDir = path.resolve(store.get('snapshotDir') as string);

    const fileName = await captureScreenshots(leftView, rightView, snapshotDir, pageName);

    const options = {
      matchingThreshold: store.get('matchingThreshold') as number,
      thresholdRate: store.get('thresholdRate') as number,
    };

    try {
      const result = await runRegCli(snapshotDir, options);
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('capture-result', {
          summary: result.summary,
          reportPath: result.reportPath,
          fileName,
        });
      }
      return result;
    } catch (error) {
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('capture-result', {
          error: (error as Error).message,
          fileName,
        });
      }
      throw error;
    }
  });

  // Open reg-cli HTML report in new window
  ipcMain.handle('open-report', (_event: IpcMainInvokeEvent, { reportPath }: { reportPath: string }) => {
    const resolved = path.resolve(reportPath);
    const snapshotBase = path.resolve(getStore().get('snapshotDir') as string);
    if (!isPathUnderBase(resolved, snapshotBase)) {
      throw new Error('Report path must be within the snapshot directory');
    }
    const reportWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'Twin - VRT Report',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    reportWindow.loadFile(resolved);
  });

  // Reload browser views
  ipcMain.handle('reload-views', (_event: IpcMainInvokeEvent, { target }: { target: string }) => {
    if ((target === 'left' || target === 'both') && leftView) {
      leftView.webContents.reload();
    }
    if ((target === 'right' || target === 'both') && rightView) {
      rightView.webContents.reload();
    }
  });

  // Change BrowserView size (device preset)
  ipcMain.handle(
    'set-device-preset',
    (_event: IpcMainInvokeEvent, { width, height }: { width: number; height: number }) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('Invalid device preset dimensions');
      }
      const sw = getSidebarWidth ? getSidebarWidth() : 0;
      if (leftView) {
        leftView.setBounds({ x: sw, y: TOOLBAR_HEIGHT, width, height });
      }
      if (rightView) {
        rightView.setBounds({ x: sw + width, y: TOOLBAR_HEIGHT, width, height });
      }
      if (mainWindow) {
        mainWindow.setContentSize(sw + width * 2, height + TOOLBAR_HEIGHT + STATUS_BAR_HEIGHT);
      }
    },
  );

  // Navigate to URL
  ipcMain.handle('navigate', (_event: IpcMainInvokeEvent, { url, target }: { url: string; target: string }) => {
    if (!isAllowedUrl(url)) {
      throw new Error('Only http: and https: URLs are allowed');
    }
    if (target === 'left' && leftView && !leftView.webContents.isDestroyed()) {
      leftView.webContents.loadURL(url).catch((err) => console.error('Failed to load left URL:', err.message));
      getStore().set('leftUrl', url);
    } else if (target === 'right' && rightView && !rightView.webContents.isDestroyed()) {
      rightView.webContents.loadURL(url).catch((err) => console.error('Failed to load right URL:', err.message));
      getStore().set('rightUrl', url);
    }
  });

  // Get settings
  ipcMain.handle('get-settings', () => {
    return getSettings();
  });

  // Save settings
  ipcMain.handle('save-settings', (_event: IpcMainInvokeEvent, { settings }: { settings: Partial<AppSettings> }) => {
    saveSettings(settings);
    return { success: true };
  });

  // Sync toggle
  ipcMain.handle('set-sync-enabled', (_event: IpcMainInvokeEvent, { enabled }: { enabled: boolean }) => {
    syncManager.setEnabled(enabled);
    return { enabled: syncManager.isEnabled() };
  });

  ipcMain.handle('get-sync-enabled', () => {
    return { enabled: syncManager.isEnabled() };
  });

  // Hide/show BrowserViews when modal is open
  let savedLeftBounds: Bounds | null = null;
  let savedRightBounds: Bounds | null = null;

  ipcMain.handle('set-views-visible', (_event: IpcMainInvokeEvent, { visible }: { visible: boolean }) => {
    if (!visible) {
      if (leftView) {
        savedLeftBounds = leftView.getBounds();
        leftView.setBounds({ x: -9999, y: -9999, width: savedLeftBounds.width, height: savedLeftBounds.height });
      }
      if (rightView) {
        savedRightBounds = rightView.getBounds();
        rightView.setBounds({ x: -9999, y: -9999, width: savedRightBounds.width, height: savedRightBounds.height });
      }
    } else {
      if (leftView && savedLeftBounds) {
        leftView.setBounds(savedLeftBounds);
        savedLeftBounds = null;
      }
      if (rightView && savedRightBounds) {
        rightView.setBounds(savedRightBounds);
        savedRightBounds = null;
      }
    }
  });

  // Select folder via native dialog
  ipcMain.handle('select-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    allowedBasePath = result.filePaths[0];
    return result.filePaths[0];
  });

  // Validate that a path is under a user-selected folder
  let allowedBasePath: string | null = null;

  // Read directory contents (one level)
  ipcMain.handle('read-directory', async (_event: IpcMainInvokeEvent, { dirPath }: { dirPath: string }) => {
    const resolved = path.resolve(dirPath);
    if (!allowedBasePath || !isPathUnderBase(resolved, allowedBasePath)) {
      throw new Error('Access denied: please select a folder first');
    }
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(resolved, entry.name),
    }));
  });

  // Create a new directory
  ipcMain.handle('create-directory', async (_event: IpcMainInvokeEvent, { dirPath }: { dirPath: string }) => {
    const resolved = path.resolve(dirPath);
    if (!allowedBasePath || !isPathUnderBase(resolved, allowedBasePath)) {
      throw new Error('Access denied: please select a folder first');
    }
    await fs.promises.mkdir(resolved, { recursive: true });
    return { path: resolved };
  });

  // Read file data as base64 data URL (for image preview)
  ipcMain.handle('read-file-data', async (_event: IpcMainInvokeEvent, { filePath }: { filePath: string }) => {
    const resolved = path.resolve(filePath);
    if (!allowedBasePath || !isPathUnderBase(resolved, allowedBasePath)) {
      throw new Error('Access denied: please select a folder first');
    }
    const ext = path.extname(resolved).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
    const stats = await fs.promises.stat(resolved);
    if (stats.size > MAX_FILE_SIZE) {
      throw new Error('File too large to read (max 50MB)');
    }
    const buf = await fs.promises.readFile(resolved);
    const dataUrl = `data:${mimeType};base64,${buf.toString('base64')}`;
    return { dataUrl, mimeType, fileName: path.basename(resolved) };
  });

  // Re-inject sync script into left BrowserView
  ipcMain.handle('reinject-sync', () => {
    syncManager.inject();
    return { success: true };
  });

  // Set sidebar width and re-layout views
  ipcMain.handle('set-sidebar-width', (_event: IpcMainInvokeEvent, { width }: { width: number }) => {
    if (setSidebarWidth) {
      setSidebarWidth(width);
    }
    return { width };
  });

  // Zoom management for BrowserViews
  let currentZoom: number = DEFAULT_ZOOM;

  ipcMain.handle('set-zoom', (_event: IpcMainInvokeEvent, { zoom }: { zoom: number }) => {
    if (!Number.isFinite(zoom)) {
      throw new Error('Invalid zoom value');
    }
    const clamped = Math.round(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) * 100) / 100;
    currentZoom = clamped;
    if (leftView && !leftView.webContents.isDestroyed()) {
      leftView.webContents.setZoomFactor(clamped);
    }
    if (rightView && !rightView.webContents.isDestroyed()) {
      rightView.webContents.setZoomFactor(clamped);
    }
    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('zoom-changed', { zoom: clamped });
    }
    return { zoom: clamped };
  });

  ipcMain.handle('get-zoom', () => {
    return { zoom: currentZoom };
  });

  // --- CSS Comparison ---
  let cssInspectActive = false;
  let lastScanResult: CssScanResult | null = null;

  // CSS Full Scan: collect styles from both views, compare, open result window
  ipcMain.handle('css-full-scan', async () => {
    const scanResult = await runFullScan(leftView, rightView);
    lastScanResult = scanResult;

    // Open result in a new window
    const html = generateScanReportHTML(scanResult);
    const reportWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      title: 'Twin - CSS Scan Report',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    return scanResult.summary;
  });

  // CSS Inspect Toggle: start/stop inspect mode on left view
  ipcMain.handle('css-inspect-toggle', async (_event: IpcMainInvokeEvent, { enabled }: { enabled: boolean }) => {
    cssInspectActive = !!enabled;

    if (cssInspectActive) {
      // Inject inspect script into left view
      if (leftView && !leftView.webContents.isDestroyed()) {
        await leftView.webContents
          .executeJavaScript(CSS_INSPECT_SCRIPT)
          .catch((err) => console.error('CSS inspect injection failed:', err.message));
      }
    } else {
      // Cleanup inspect mode from left view
      if (leftView && !leftView.webContents.isDestroyed()) {
        await leftView.webContents
          .executeJavaScript(CSS_INSPECT_CLEANUP_SCRIPT)
          .catch((err) => console.error('CSS inspect cleanup failed:', err.message));
      }
      // Clear right view highlight
      if (rightView && !rightView.webContents.isDestroyed()) {
        await rightView.webContents
          .executeJavaScript(CLEAR_HIGHLIGHT_SCRIPT)
          .catch((err) => console.error('Clear highlight failed:', err.message));
      }
    }

    return { enabled: cssInspectActive };
  });

  // CSS Export JSON: export last scan result
  ipcMain.handle('css-export-json', async () => {
    if (!lastScanResult) {
      throw new Error('No scan result to export. Run a CSS scan first.');
    }
    if (!mainWindow) return null;
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'css-scan-report.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, JSON.stringify(lastScanResult, null, 2), 'utf-8');
    return { filePath: result.filePath };
  });

  // Handle CSS inspect messages from left view console.log
  function handleCssInspectMessage(_event: unknown, _level: number, message: string): void {
    if (!cssInspectActive) return;
    if (!message.startsWith(CSS_INSPECT_PREFIX)) return;

    let parsed: { type: string; data: CssInspectElementData };
    try {
      parsed = JSON.parse(message.slice(CSS_INSPECT_PREFIX.length));
    } catch {
      return;
    }

    if (parsed.type === 'inspect-click') {
      handleInspectClick(parsed.data);
    }
  }

  async function handleInspectClick(leftData: CssInspectElementData): Promise<void> {
    if (!rightView || rightView.webContents.isDestroyed()) {
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('css-inspect-result', {
          left: leftData,
          right: null,
          diffs: [],
          error: 'Right view is not available',
        });
      }
      return;
    }

    // Highlight matching element in right view
    const highlighted = await rightView.webContents
      .executeJavaScript(buildHighlightScript(leftData.key))
      .catch(() => false);

    if (!highlighted) {
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('css-inspect-result', {
          left: leftData,
          right: null,
          diffs: [],
          error: 'Matching element not found in right panel',
        });
      }
      return;
    }

    // Get right element styles
    const rightData: { tag: string; styles: Record<string, string> } | null = await rightView.webContents
      .executeJavaScript(buildGetElementStylesScript(leftData.key, leftData.method))
      .catch(() => null);

    if (!rightData) {
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('css-inspect-result', {
          left: leftData,
          right: null,
          diffs: [],
          error: 'Could not retrieve styles from right panel',
        });
      }
      return;
    }

    const diffs = compareStyles(leftData.styles, rightData.styles);
    // Add category to each diff
    const diffsWithCategory = diffs.map((d) => ({
      ...d,
      category: d.category || classifyProperty(d.property),
    }));

    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('css-inspect-result', {
        left: leftData,
        right: { tag: rightData.tag, key: leftData.key, method: leftData.method, styles: rightData.styles },
        diffs: diffsWithCategory,
        error: null,
      });
    }
  }

  if (leftView && !leftView.webContents.isDestroyed()) {
    leftView.webContents.on('console-message', handleCssInspectMessage);
  }

  // Auto-disable inspect mode on left view navigation
  if (leftView && !leftView.webContents.isDestroyed()) {
    leftView.webContents.on('did-navigate', () => {
      if (cssInspectActive) {
        cssInspectActive = false;
        if (mainWindow && !mainWindow.webContents.isDestroyed()) {
          mainWindow.webContents.send('css-inspect-result', {
            left: null,
            right: null,
            diffs: [],
            error: null,
            modeDisabled: true,
          });
        }
      }
    });
  }

  // Navigation sync (left → right)
  if (leftView) {
    leftView.webContents.on('did-navigate-in-page', (_event: unknown, url: string) => {
      if (!syncManager.isEnabled() || syncManager.isPaused()) return;
      if (syncManager.isNavSyncSuppressed()) return;
      try {
        const navPath = new URL(url).pathname;
        const rightUrl = new URL(rightView.webContents.getURL());
        rightUrl.pathname = navPath;
        rightView.webContents
          .loadURL(rightUrl.toString())
          .catch((err) => console.error('Nav sync failed:', err.message));
      } catch {
        // ignore URL parse errors
      }
    });
  }

  return { syncManager };
}

export { registerIpcHandlers };
