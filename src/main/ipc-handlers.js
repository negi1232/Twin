const { ipcMain, BrowserWindow } = require('electron');
const path = require('path');
const { captureScreenshots } = require('./screenshot');
const { runRegCli } = require('./reg-runner');
const { getSettings, saveSettings, getStore } = require('./store');
const { createSyncManager } = require('./sync-manager');

function registerIpcHandlers({ mainWindow, leftView, rightView }) {
  // --- Sync Manager ---
  const syncManager = createSyncManager(leftView, rightView);
  syncManager.start();

  // Capture screenshots and run reg-cli comparison
  ipcMain.handle('capture-and-compare', async (_event, { pageName }) => {
    const store = getStore();
    const snapshotDir = path.resolve(store.get('snapshotDir'));

    const fileName = await captureScreenshots(leftView, rightView, snapshotDir, pageName);

    const options = {
      matchingThreshold: store.get('matchingThreshold'),
      thresholdRate: store.get('thresholdRate'),
    };

    try {
      const result = await runRegCli(snapshotDir, options);
      mainWindow.webContents.send('capture-result', {
        summary: result.summary,
        reportPath: result.reportPath,
        fileName,
      });
      return result;
    } catch (error) {
      mainWindow.webContents.send('capture-result', {
        error: error.message,
        fileName,
      });
      throw error;
    }
  });

  // Open reg-cli HTML report in new window
  ipcMain.handle('open-report', (_event, { reportPath }) => {
    const reportWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'Twin - VRT Report',
    });
    reportWindow.loadFile(reportPath);
  });

  // Reload browser views
  ipcMain.handle('reload-views', (_event, { target }) => {
    if (target === 'left' || target === 'both') {
      leftView.webContents.reload();
    }
    if (target === 'right' || target === 'both') {
      rightView.webContents.reload();
    }
  });

  // Change BrowserView size (device preset)
  ipcMain.handle('set-device-preset', (_event, { width, height }) => {
    const TOOLBAR_HEIGHT = 48;
    if (leftView) {
      leftView.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height });
    }
    if (rightView) {
      rightView.setBounds({ x: width, y: TOOLBAR_HEIGHT, width, height });
    }
    if (mainWindow) {
      mainWindow.setContentSize(width * 2, height + TOOLBAR_HEIGHT + 28);
    }
  });

  // Navigate to URL
  ipcMain.handle('navigate', (_event, { url, target }) => {
    if (target === 'left' && leftView) {
      leftView.webContents.loadURL(url).catch(() => {});
      getStore().set('leftUrl', url);
    } else if (target === 'right' && rightView) {
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

  // Navigation sync (left → right)
  if (leftView) {
    leftView.webContents.on('did-navigate-in-page', (_event, url) => {
      if (!syncManager.isEnabled()) return;
      try {
        const navPath = new URL(url).pathname;
        const rightUrl = new URL(rightView.webContents.getURL());
        rightUrl.pathname = navPath;
        rightView.webContents.loadURL(rightUrl.toString()).catch(() => {});
      } catch (_e) {
        // ignore URL parse errors
      }
    });
  }
}

module.exports = { registerIpcHandlers };
