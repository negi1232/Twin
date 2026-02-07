const path = require('path');

// ---------- Mocks ----------

// Collect ipcMain.handle registrations
const handlers = {};
const mockIpcMain = {
  handle: jest.fn((channel, handler) => {
    handlers[channel] = handler;
  }),
};

const mockWebContents = {
  send: jest.fn(),
  reload: jest.fn(),
  loadURL: jest.fn().mockResolvedValue(undefined),
  getURL: jest.fn().mockReturnValue('http://localhost:3001/'),
  on: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
  executeJavaScript: jest.fn().mockResolvedValue(undefined),
};

const mockLeftWebContents = {
  reload: jest.fn(),
  loadURL: jest.fn().mockResolvedValue(undefined),
  getURL: jest.fn().mockReturnValue('http://localhost:3000/'),
  on: jest.fn(),
  isDestroyed: jest.fn().mockReturnValue(false),
  executeJavaScript: jest.fn().mockResolvedValue(undefined),
};

const mockMainWindow = {
  webContents: mockWebContents,
  setContentSize: jest.fn(),
};

const mockLeftView = {
  webContents: mockLeftWebContents,
  setBounds: jest.fn(),
};

const mockRightView = {
  webContents: {
    reload: jest.fn(),
    loadURL: jest.fn().mockResolvedValue(undefined),
    getURL: jest.fn().mockReturnValue('http://localhost:3001/page'),
    on: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
    sendInputEvent: jest.fn(),
  },
  setBounds: jest.fn(),
};

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn(),
}));

const mockDialog = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/selected/folder'] }),
};

jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
  BrowserWindow: mockBrowserWindow,
  dialog: mockDialog,
}));

jest.mock('fs', () => ({
  realpathSync: jest.fn((p) => p),
  promises: {
    readdir: jest.fn().mockResolvedValue([]),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('fake-image-data')),
    stat: jest.fn().mockResolvedValue({ size: 100 }),
  },
}));

jest.mock('../../src/main/screenshot', () => ({
  captureScreenshots: jest.fn().mockResolvedValue('page_001.png'),
}));

jest.mock('../../src/main/reg-runner', () => ({
  runRegCli: jest.fn().mockResolvedValue({
    summary: { passed: 1, failed: 0, new: 0, deleted: 0 },
    reportPath: '/tmp/report/index.html',
  }),
}));

const mockStoreData = {};
jest.mock('../../src/main/store', () => ({
  getSettings: jest.fn(() => ({
    leftUrl: 'http://localhost:3000',
    rightUrl: 'http://localhost:3001',
    snapshotDir: './snapshots',
    matchingThreshold: 0,
    thresholdRate: 0,
  })),
  saveSettings: jest.fn((settings) => {
    Object.assign(mockStoreData, settings);
  }),
  getStore: jest.fn(() => ({
    get: jest.fn((key) => {
      const defaults = {
        snapshotDir: './snapshots',
        matchingThreshold: 0,
        thresholdRate: 0,
        leftUrl: 'http://localhost:3000',
        rightUrl: 'http://localhost:3001',
      };
      return mockStoreData[key] !== undefined ? mockStoreData[key] : defaults[key];
    }),
    set: jest.fn((key, value) => {
      mockStoreData[key] = value;
    }),
  })),
}));

let mockSyncEnabled = true;
let mockSyncPaused = false;
const mockSyncManager = {
  start: jest.fn(),
  stop: jest.fn(),
  inject: jest.fn(),
  isEnabled: jest.fn(() => mockSyncEnabled),
  setEnabled: jest.fn((v) => { mockSyncEnabled = v; }),
  isPaused: jest.fn(() => mockSyncPaused),
  pause: jest.fn(() => { mockSyncPaused = true; }),
  resume: jest.fn(() => { mockSyncPaused = false; }),
};
jest.mock('../../src/main/sync-manager', () => ({
  createSyncManager: jest.fn(() => mockSyncManager),
}));

let mockSidebarWidth = 0;
const mockSetSidebarWidth = jest.fn((w) => { mockSidebarWidth = w; });
const mockGetSidebarWidth = jest.fn(() => mockSidebarWidth);

jest.mock('../../src/main/index', () => ({
  setSidebarWidth: jest.fn(),
  getSidebarWidth: jest.fn(() => 0),
}));

// ---------- Tests ----------

describe('ipc-handlers integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(handlers).forEach((k) => delete handlers[k]);
    Object.keys(mockStoreData).forEach((k) => delete mockStoreData[k]);
    mockSyncEnabled = true;
    mockSyncPaused = false;
    mockSidebarWidth = 0;

    const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
    registerIpcHandlers({
      mainWindow: mockMainWindow,
      leftView: mockLeftView,
      rightView: mockRightView,
      setSidebarWidth: mockSetSidebarWidth,
      getSidebarWidth: mockGetSidebarWidth,
    });
  });

  afterEach(() => {
    jest.resetModules();
  });

  // ===== Return value =====
  describe('return value', () => {
    test('registerIpcHandlers returns syncManager', () => {
      jest.resetModules();
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      const result = registerIpcHandlers({
        mainWindow: mockMainWindow,
        leftView: mockLeftView,
        rightView: mockRightView,
        setSidebarWidth: mockSetSidebarWidth,
        getSidebarWidth: mockGetSidebarWidth,
      });
      expect(result).toHaveProperty('syncManager');
      expect(result.syncManager).toBe(mockSyncManager);
    });
  });

  // ===== Channel Registration =====
  describe('channel registration', () => {
    test('registers all 16 expected IPC channels', () => {
      const expected = [
        'capture-and-compare',
        'open-report',
        'reload-views',
        'set-device-preset',
        'navigate',
        'get-settings',
        'save-settings',
        'set-sync-enabled',
        'get-sync-enabled',
        'set-views-visible',
        'select-folder',
        'read-directory',
        'create-directory',
        'read-file-data',
        'reinject-sync',
        'set-sidebar-width',
      ];
      expected.forEach((channel) => {
        expect(handlers[channel]).toBeDefined();
      });
    });
  });

  // ===== capture-and-compare =====
  describe('capture-and-compare', () => {
    test('calls captureScreenshots and runRegCli, sends success result', async () => {
      const { captureScreenshots } = require('../../src/main/screenshot');
      const { runRegCli } = require('../../src/main/reg-runner');

      await handlers['capture-and-compare']({}, { pageName: 'test-page' });

      expect(captureScreenshots).toHaveBeenCalledWith(
        mockLeftView,
        mockRightView,
        expect.any(String),
        'test-page'
      );
      expect(runRegCli).toHaveBeenCalled();
      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('capture-result', {
        summary: { passed: 1, failed: 0, new: 0, deleted: 0 },
        reportPath: '/tmp/report/index.html',
        fileName: 'page_001.png',
      });
    });

    test('sends error on runRegCli failure', async () => {
      const { runRegCli } = require('../../src/main/reg-runner');
      runRegCli.mockRejectedValueOnce(new Error('reg-cli failed'));

      await expect(
        handlers['capture-and-compare']({}, { pageName: 'test' })
      ).rejects.toThrow('reg-cli failed');

      expect(mockMainWindow.webContents.send).toHaveBeenCalledWith('capture-result', {
        error: 'reg-cli failed',
        fileName: 'page_001.png',
      });
    });

    test('rejects invalid pageName with path traversal', async () => {
      await expect(
        handlers['capture-and-compare']({}, { pageName: '../../../etc/passwd' })
      ).rejects.toThrow('Invalid page name');
    });

    test('rejects empty pageName', async () => {
      await expect(
        handlers['capture-and-compare']({}, { pageName: '' })
      ).rejects.toThrow('Invalid page name');
    });
  });

  // ===== open-report =====
  describe('open-report', () => {
    test('opens a new BrowserWindow and loads report file', () => {
      const path = require('path');
      const reportPath = path.resolve('./snapshots', 'report.html');
      handlers['open-report']({}, { reportPath });
      expect(mockBrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1200,
          height: 800,
          webPreferences: expect.objectContaining({
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          }),
        })
      );
    });

    test('rejects report path outside snapshot directory', () => {
      expect(() => {
        handlers['open-report']({}, { reportPath: '/etc/passwd' });
      }).toThrow('Report path must be within the snapshot directory');
    });
  });

  // ===== navigate =====
  describe('navigate', () => {
    test('navigates left view and saves URL to store', async () => {
      await handlers['navigate']({}, { url: 'http://new-left.com', target: 'left' });
      expect(mockLeftView.webContents.loadURL).toHaveBeenCalledWith('http://new-left.com');
    });

    test('navigates right view and saves URL to store', async () => {
      await handlers['navigate']({}, { url: 'http://new-right.com', target: 'right' });
      expect(mockRightView.webContents.loadURL).toHaveBeenCalledWith('http://new-right.com');
    });

    test('rejects non-http/https URLs', () => {
      expect(() => {
        handlers['navigate']({}, { url: 'file:///etc/passwd', target: 'left' });
      }).toThrow('Only http: and https: URLs are allowed');
    });
  });

  // ===== reload-views =====
  describe('reload-views', () => {
    test('reloads left view only', () => {
      handlers['reload-views']({}, { target: 'left' });
      expect(mockLeftView.webContents.reload).toHaveBeenCalled();
      expect(mockRightView.webContents.reload).not.toHaveBeenCalled();
    });

    test('reloads right view only', () => {
      handlers['reload-views']({}, { target: 'right' });
      expect(mockRightView.webContents.reload).toHaveBeenCalled();
      expect(mockLeftView.webContents.reload).not.toHaveBeenCalled();
    });

    test('reloads both views', () => {
      handlers['reload-views']({}, { target: 'both' });
      expect(mockLeftView.webContents.reload).toHaveBeenCalled();
      expect(mockRightView.webContents.reload).toHaveBeenCalled();
    });
  });

  // ===== set-device-preset =====
  describe('set-device-preset', () => {
    test('sets bounds on both views and resizes main window with sidebar offset', () => {
      mockSidebarWidth = 250;
      mockGetSidebarWidth.mockReturnValue(250);
      handlers['set-device-preset']({}, { width: 375, height: 667 });
      expect(mockLeftView.setBounds).toHaveBeenCalledWith(
        expect.objectContaining({ x: 250, y: 52, width: 375, height: 667 })
      );
      expect(mockRightView.setBounds).toHaveBeenCalledWith(
        expect.objectContaining({ x: 625, y: 52, width: 375, height: 667 })
      );
      expect(mockMainWindow.setContentSize).toHaveBeenCalledWith(1000, 667 + 52 + 28);
    });

    test('sets bounds without sidebar offset when sidebar is closed', () => {
      mockGetSidebarWidth.mockReturnValue(0);
      handlers['set-device-preset']({}, { width: 375, height: 667 });
      expect(mockLeftView.setBounds).toHaveBeenCalledWith(
        expect.objectContaining({ x: 0, y: 52, width: 375, height: 667 })
      );
      expect(mockRightView.setBounds).toHaveBeenCalledWith(
        expect.objectContaining({ x: 375, y: 52, width: 375, height: 667 })
      );
      expect(mockMainWindow.setContentSize).toHaveBeenCalledWith(750, 667 + 52 + 28);
    });

    test('skips null views and window gracefully', () => {
      jest.resetModules();
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      registerIpcHandlers({
        mainWindow: null,
        leftView: null,
        rightView: null,
      });
      // Should not throw
      handlers['set-device-preset']({}, { width: 375, height: 667 });
    });
  });

  // ===== get-settings / save-settings =====
  describe('settings round-trip', () => {
    test('get-settings returns current settings', () => {
      const { getSettings } = require('../../src/main/store');
      const result = handlers['get-settings']({});
      expect(getSettings).toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({ leftUrl: 'http://localhost:3000' }));
    });

    test('save-settings persists and returns success', () => {
      const { saveSettings } = require('../../src/main/store');
      const result = handlers['save-settings']({}, { settings: { matchingThreshold: 0.5 } });
      expect(saveSettings).toHaveBeenCalledWith({ matchingThreshold: 0.5 });
      expect(result).toEqual({ success: true });
    });
  });

  // ===== set-sync-enabled =====
  describe('set-sync-enabled', () => {
    test('calls syncManager.setEnabled and returns state', () => {
      const result = handlers['set-sync-enabled']({}, { enabled: false });
      expect(mockSyncManager.setEnabled).toHaveBeenCalledWith(false);
      expect(result).toEqual({ enabled: false });
    });
  });

  // ===== get-sync-enabled =====
  describe('get-sync-enabled', () => {
    test('returns current sync enabled state', () => {
      const result = handlers['get-sync-enabled']({});
      expect(result).toEqual({ enabled: true });
    });
  });

  // ===== set-views-visible =====
  describe('set-views-visible', () => {
    test('hides views by moving offscreen while preserving size', () => {
      mockLeftView.getBounds = jest.fn().mockReturnValue({ x: 0, y: 52, width: 375, height: 667 });
      mockRightView.getBounds = jest.fn().mockReturnValue({ x: 375, y: 52, width: 375, height: 667 });

      handlers['set-views-visible']({}, { visible: false });
      expect(mockLeftView.setBounds).toHaveBeenCalledWith({ x: -9999, y: -9999, width: 375, height: 667 });
      expect(mockRightView.setBounds).toHaveBeenCalledWith({ x: -9999, y: -9999, width: 375, height: 667 });
    });

    test('restores views to saved bounds', () => {
      mockLeftView.getBounds = jest.fn().mockReturnValue({ x: 0, y: 52, width: 375, height: 667 });
      mockRightView.getBounds = jest.fn().mockReturnValue({ x: 375, y: 52, width: 375, height: 667 });

      handlers['set-views-visible']({}, { visible: false });
      mockLeftView.setBounds.mockClear();
      mockRightView.setBounds.mockClear();

      handlers['set-views-visible']({}, { visible: true });
      expect(mockLeftView.setBounds).toHaveBeenCalledWith({ x: 0, y: 52, width: 375, height: 667 });
      expect(mockRightView.setBounds).toHaveBeenCalledWith({ x: 375, y: 52, width: 375, height: 667 });
    });

    test('handles null views gracefully', () => {
      jest.resetModules();
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      registerIpcHandlers({
        mainWindow: mockMainWindow,
        leftView: null,
        rightView: null,
      });
      // Should not throw
      handlers['set-views-visible']({}, { visible: false });
      handlers['set-views-visible']({}, { visible: true });
    });
  });

  // ===== select-folder =====
  describe('select-folder', () => {
    test('returns selected folder path without saving to store', async () => {
      mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/my/folder'] });
      const result = await handlers['select-folder']({});
      expect(result).toBe('/my/folder');
      expect(mockStoreData.snapshotDir).toBeUndefined();
    });

    test('returns null when dialog is canceled', async () => {
      mockDialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
      const result = await handlers['select-folder']({});
      expect(result).toBeNull();
    });

    test('returns null when mainWindow is null', async () => {
      jest.resetModules();
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      registerIpcHandlers({
        mainWindow: null,
        leftView: mockLeftView,
        rightView: mockRightView,
        setSidebarWidth: mockSetSidebarWidth,
        getSidebarWidth: mockGetSidebarWidth,
      });
      const result = await handlers['select-folder']({});
      expect(result).toBeNull();
    });
  });

  // ===== read-directory =====
  describe('read-directory', () => {
    test('returns directory entries with name, isDirectory, and path', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/test'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.readdir.mockResolvedValue([
        { name: 'sub', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
      ]);
      const result = await handlers['read-directory']({}, { dirPath: '/test' });
      expect(result).toEqual([
        { name: 'sub', isDirectory: true, path: expect.stringContaining('sub') },
        { name: 'file.txt', isDirectory: false, path: expect.stringContaining('file.txt') },
      ]);
    });

    test('rejects when no folder has been selected', async () => {
      await expect(handlers['read-directory']({}, { dirPath: '/test' })).rejects.toThrow('Access denied: please select a folder first');
    });

    test('propagates error on invalid directory', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/bad'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.readdir.mockRejectedValue(new Error('ENOENT'));
      await expect(handlers['read-directory']({}, { dirPath: '/bad' })).rejects.toThrow('ENOENT');
    });
  });

  // ===== create-directory =====
  describe('create-directory', () => {
    test('creates directory with recursive option and returns path', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/test'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.mkdir.mockResolvedValue(undefined);
      const result = await handlers['create-directory']({}, { dirPath: '/test/new-folder' });
      expect(fs.promises.mkdir).toHaveBeenCalledWith('/test/new-folder', { recursive: true });
      expect(result).toEqual({ path: '/test/new-folder' });
    });

    test('propagates error on permission denied', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/root'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.mkdir.mockRejectedValue(new Error('EACCES'));
      await expect(handlers['create-directory']({}, { dirPath: '/root/no-access' })).rejects.toThrow('EACCES');
    });
  });

  // ===== read-file-data =====
  describe('read-file-data', () => {
    test('reads image file and returns base64 data URL', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/test'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      const imgBuf = Buffer.from('PNG-DATA');
      fs.promises.readFile.mockResolvedValue(imgBuf);
      fs.promises.stat.mockResolvedValue({ size: 100 });
      const result = await handlers['read-file-data']({}, { filePath: '/test/screenshot.png' });
      expect(fs.promises.readFile).toHaveBeenCalledWith('/test/screenshot.png');
      expect(result.dataUrl).toBe(`data:image/png;base64,${imgBuf.toString('base64')}`);
      expect(result.mimeType).toBe('image/png');
      expect(result.fileName).toBe('screenshot.png');
    });

    test('handles jpg extension correctly', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/test'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.readFile.mockResolvedValue(Buffer.from('JPG'));
      fs.promises.stat.mockResolvedValue({ size: 100 });
      const result = await handlers['read-file-data']({}, { filePath: '/test/photo.jpg' });
      expect(result.mimeType).toBe('image/jpeg');
    });

    test('rejects files exceeding 50MB size limit', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/test'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.stat.mockResolvedValue({ size: 51 * 1024 * 1024 });
      await expect(handlers['read-file-data']({}, { filePath: '/test/huge.png' })).rejects.toThrow('File too large to read (max 50MB)');
    });

    test('propagates error on file read failure', async () => {
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/bad'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      fs.promises.stat.mockResolvedValue({ size: 100 });
      fs.promises.readFile.mockRejectedValue(new Error('ENOENT'));
      await expect(handlers['read-file-data']({}, { filePath: '/bad/file.png' })).rejects.toThrow('ENOENT');
    });
  });

  // ===== reinject-sync =====
  describe('reinject-sync', () => {
    test('calls syncManager.inject and returns success', () => {
      const result = handlers['reinject-sync']({});
      expect(mockSyncManager.inject).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  // ===== set-sidebar-width =====
  describe('set-sidebar-width', () => {
    test('calls setSidebarWidth and returns width', () => {
      const result = handlers['set-sidebar-width']({}, { width: 250 });
      expect(mockSetSidebarWidth).toHaveBeenCalledWith(250);
      expect(result).toEqual({ width: 250 });
    });

    test('handles null setSidebarWidth gracefully', () => {
      jest.resetModules();
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      registerIpcHandlers({
        mainWindow: mockMainWindow,
        leftView: mockLeftView,
        rightView: mockRightView,
      });
      const result = handlers['set-sidebar-width']({}, { width: 250 });
      expect(result).toEqual({ width: 250 });
    });
  });

  // ===== did-navigate-in-page =====
  describe('did-navigate-in-page sync', () => {
    function getNavigateHandler() {
      const onCall = mockLeftView.webContents.on.mock.calls.find(
        (call) => call[0] === 'did-navigate-in-page'
      );
      return onCall[1];
    }

    test('registers listener on leftView webContents', () => {
      expect(mockLeftView.webContents.on).toHaveBeenCalledWith(
        'did-navigate-in-page',
        expect.any(Function)
      );
    });

    test('syncs navigation path to right view when sync enabled', () => {
      const handler = getNavigateHandler();
      handler({}, 'http://localhost:3000/some/path');
      expect(mockRightView.webContents.loadURL).toHaveBeenCalledWith(
        'http://localhost:3001/some/path'
      );
    });

    test('does not sync when sync is disabled', () => {
      mockSyncEnabled = false;
      const handler = getNavigateHandler();
      mockRightView.webContents.loadURL.mockClear();
      handler({}, 'http://localhost:3000/other');
      expect(mockRightView.webContents.loadURL).not.toHaveBeenCalled();
    });

    test('does not sync navigation when paused', () => {
      mockSyncPaused = true;
      mockSyncManager.isPaused.mockReturnValue(true);
      const handler = getNavigateHandler();
      mockRightView.webContents.loadURL.mockClear();
      handler({}, 'http://localhost:3000/path');
      expect(mockRightView.webContents.loadURL).not.toHaveBeenCalled();
    });

    test('ignores invalid URLs without throwing', () => {
      const handler = getNavigateHandler();
      // Should not throw on invalid URL
      expect(() => handler({}, 'not-a-valid-url')).not.toThrow();
    });

    test('handles loadURL rejection on right view gracefully', async () => {
      mockRightView.webContents.loadURL.mockRejectedValueOnce(new Error('nav fail'));
      const handler = getNavigateHandler();
      handler({}, 'http://localhost:3000/path');
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  // ===== navigate loadURL rejection =====
  describe('navigate error handling', () => {
    test('handles left loadURL rejection gracefully', async () => {
      mockLeftView.webContents.loadURL.mockRejectedValueOnce(new Error('fail'));
      await handlers['navigate']({}, { url: 'http://bad.com', target: 'left' });
      await new Promise((r) => setTimeout(r, 0));
    });

    test('handles right loadURL rejection gracefully', async () => {
      mockRightView.webContents.loadURL.mockRejectedValueOnce(new Error('fail'));
      await handlers['navigate']({}, { url: 'http://bad.com', target: 'right' });
      await new Promise((r) => setTimeout(r, 0));
    });
  });
});
