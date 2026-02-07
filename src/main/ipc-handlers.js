const { ipcMain, BrowserWindow, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { captureScreenshots } = require('./screenshot');
const { runRegCli } = require('./reg-runner');
const { getSettings, saveSettings, getStore } = require('./store');
const { createSyncManager } = require('./sync-manager');

const ALLOWED_URL_SCHEMES = ['http:', 'https:'];

function isAllowedUrl(url) {
  try {
    const parsed = new URL(url);
    return ALLOWED_URL_SCHEMES.includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isPathUnderBase(targetPath, basePath) {
  const resolved = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

function registerIpcHandlers({ mainWindow, leftView, rightView, setSidebarWidth, getSidebarWidth }) {
  // --- Sync Manager ---
  const syncManager = createSyncManager(leftView, rightView);
  syncManager.start();

  // Capture screenshots and run reg-cli comparison
  ipcMain.handle('capture-and-compare', async (_event, { pageName }) => {
    if (!leftView || !rightView) throw new Error('Views not ready');

    const store = getStore();
    const snapshotDir = path.resolve(store.get('snapshotDir'));

    const fileName = await captureScreenshots(leftView, rightView, snapshotDir, pageName);

    const options = {
      matchingThreshold: store.get('matchingThreshold'),
      thresholdRate: store.get('thresholdRate'),
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
          error: error.message,
          fileName,
        });
      }
      throw error;
    }
  });

  // Open reg-cli HTML report in new window
  ipcMain.handle('open-report', (_event, { reportPath }) => {
    const resolved = path.resolve(reportPath);
    const snapshotBase = path.resolve(getStore().get('snapshotDir'));
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
  ipcMain.handle('reload-views', (_event, { target }) => {
    if ((target === 'left' || target === 'both') && leftView) {
      leftView.webContents.reload();
    }
    if ((target === 'right' || target === 'both') && rightView) {
      rightView.webContents.reload();
    }
  });

  // Change BrowserView size (device preset)
  ipcMain.handle('set-device-preset', (_event, { width, height }) => {
    const TOOLBAR_HEIGHT = 52;
    const STATUS_BAR_HEIGHT = 28;
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
  });

  // Navigate to URL
  ipcMain.handle('navigate', (_event, { url, target }) => {
    if (!isAllowedUrl(url)) {
      throw new Error('Only http: and https: URLs are allowed');
    }
    if (target === 'left' && leftView && !leftView.webContents.isDestroyed()) {
      leftView.webContents.loadURL(url).catch(() => {});
      getStore().set('leftUrl', url);
    } else if (target === 'right' && rightView && !rightView.webContents.isDestroyed()) {
      rightView.webContents.loadURL(url).catch(() => {});
      getStore().set('rightUrl', url);
    }
  });

  // Get settings
  ipcMain.handle('get-settings', () => {
    return getSettings();
  });

  // Save settings
  ipcMain.handle('save-settings', (_event, { settings }) => {
    saveSettings(settings);
    return { success: true };
  });

  // Sync toggle
  ipcMain.handle('set-sync-enabled', (_event, { enabled }) => {
    syncManager.setEnabled(enabled);
    return { enabled: syncManager.isEnabled() };
  });

  ipcMain.handle('get-sync-enabled', () => {
    return { enabled: syncManager.isEnabled() };
  });

  // Hide/show BrowserViews when modal is open
  let savedLeftBounds = null;
  let savedRightBounds = null;

  ipcMain.handle('set-views-visible', (_event, { visible }) => {
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
  let allowedBasePath = null;

  // Read directory contents (one level)
  ipcMain.handle('read-directory', async (_event, { dirPath }) => {
    const resolved = path.resolve(dirPath);
    if (allowedBasePath && !isPathUnderBase(resolved, allowedBasePath)) {
      throw new Error('Access denied: path is outside the selected folder');
    }
    const entries = await fs.promises.readdir(resolved, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      isDirectory: entry.isDirectory(),
      path: path.join(resolved, entry.name),
    }));
  });

  // Create a new directory
  ipcMain.handle('create-directory', async (_event, { dirPath }) => {
    const resolved = path.resolve(dirPath);
    if (allowedBasePath && !isPathUnderBase(resolved, allowedBasePath)) {
      throw new Error('Access denied: path is outside the selected folder');
    }
    await fs.promises.mkdir(resolved, { recursive: true });
    return { path: resolved };
  });

  // Read file data as base64 data URL (for image preview)
  ipcMain.handle('read-file-data', async (_event, { filePath }) => {
    const resolved = path.resolve(filePath);
    if (allowedBasePath && !isPathUnderBase(resolved, allowedBasePath)) {
      throw new Error('Access denied: path is outside the selected folder');
    }
    const ext = path.extname(resolved).toLowerCase();
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    const mimeType = mimeMap[ext] || 'application/octet-stream';
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
  ipcMain.handle('set-sidebar-width', (_event, { width }) => {
    if (setSidebarWidth) {
      setSidebarWidth(width);
    }
    return { width };
  });

  // Navigation sync (left → right)
  if (leftView) {
    leftView.webContents.on('did-navigate-in-page', (_event, url) => {
      if (!syncManager.isEnabled() || syncManager.isPaused()) return;
      try {
        const navPath = new URL(url).pathname;
        const rightUrl = new URL(rightView.webContents.getURL());
        rightUrl.pathname = navPath;
        rightView.webContents.loadURL(rightUrl.toString()).catch(() => {});
      } catch {
        // ignore URL parse errors
      }
    });
  }

  return { syncManager };
}

module.exports = { registerIpcHandlers };
