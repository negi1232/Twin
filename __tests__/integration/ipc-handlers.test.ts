export {};

const path = require('path');

// ---------- Mocks ----------

// Collect ipcMain.handle registrations
const handlers: Record<string, any> = {};
const mockIpcMain = {
  handle: jest.fn((channel: string, handler: any) => {
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

const mockLeftWebContents: Record<string, any> = {
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

const mockLeftView: Record<string, any> = {
  webContents: mockLeftWebContents,
  setBounds: jest.fn(),
};

const mockRightView: Record<string, any> = {
  webContents: {
    reload: jest.fn(),
    loadURL: jest.fn().mockResolvedValue(undefined),
    getURL: jest.fn().mockReturnValue('http://localhost:3001/page'),
    on: jest.fn(),
    isDestroyed: jest.fn().mockReturnValue(false),
    executeJavaScript: jest.fn().mockResolvedValue(undefined),
    sendInputEvent: jest.fn(),
  } as Record<string, any>,
  setBounds: jest.fn(),
};

const mockBrowserWindow = jest.fn().mockImplementation(() => ({
  loadFile: jest.fn(),
  loadURL: jest.fn(),
}));

const mockDialog: Record<string, any> = {
  showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: ['/selected/folder'] }),
};

jest.mock('electron', () => ({
  ipcMain: mockIpcMain,
  BrowserWindow: mockBrowserWindow,
  dialog: mockDialog,
}));

jest.mock('fs', () => ({
  realpathSync: jest.fn((p: string) => p),
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

const mockStoreData: Record<string, any> = {};
jest.mock('../../src/main/store', () => ({
  getSettings: jest.fn(() => ({
    leftUrl: 'http://localhost:3000',
    rightUrl: 'http://localhost:3001',
    snapshotDir: './snapshots',
    matchingThreshold: 0,
    thresholdRate: 0,
  })),
  saveSettings: jest.fn((settings: any) => {
    Object.assign(mockStoreData, settings);
  }),
  getStore: jest.fn(() => ({
    get: jest.fn((key: string) => {
      const defaults: Record<string, any> = {
        snapshotDir: './snapshots',
        matchingThreshold: 0,
        thresholdRate: 0,
        leftUrl: 'http://localhost:3000',
        rightUrl: 'http://localhost:3001',
      };
      return mockStoreData[key] !== undefined ? mockStoreData[key] : defaults[key];
    }),
    set: jest.fn((key: string, value: any) => {
      mockStoreData[key] = value;
    }),
  })),
}));

let mockSyncEnabled = true;
let mockSyncPaused = false;
let mockNavSyncSuppressed = false;
const mockSyncManager = {
  start: jest.fn(),
  stop: jest.fn(),
  inject: jest.fn(),
  isEnabled: jest.fn(() => mockSyncEnabled),
  setEnabled: jest.fn((v: boolean) => { mockSyncEnabled = v; }),
  isPaused: jest.fn(() => mockSyncPaused),
  pause: jest.fn(() => { mockSyncPaused = true; }),
  resume: jest.fn(() => { mockSyncPaused = false; }),
  isNavSyncSuppressed: jest.fn(() => mockNavSyncSuppressed),
  suppressNavSync: jest.fn(() => { mockNavSyncSuppressed = true; }),
};
jest.mock('../../src/main/sync-manager', () => ({
  createSyncManager: jest.fn(() => mockSyncManager),
}));

const mockScanResult = {
  leftCount: 2,
  rightCount: 2,
  scannedElements: 4,
  changed: [{ tag: 'div', key: '#header', method: 'id', type: 'changed', diffCount: 1, diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }] }],
  added: [],
  deleted: [],
  summary: { changedElements: 1, addedElements: 0, deletedElements: 0, totalDiffProperties: 1 },
};

jest.mock('../../src/main/css-compare', () => ({
  runFullScan: jest.fn().mockResolvedValue(mockScanResult),
  generateScanReportHTML: jest.fn().mockReturnValue('<html><body>Report</body></html>'),
  buildGetElementStylesScript: jest.fn().mockReturnValue('(function(){ return { tag: "div", styles: {} }; })()'),
  buildHighlightScript: jest.fn().mockReturnValue('(function(){ return true; })()'),
  compareStyles: jest.fn().mockReturnValue([]),
  classifyProperty: jest.fn().mockReturnValue('other'),
  CSS_INSPECT_SCRIPT: '/* inspect script */',
  CSS_INSPECT_CLEANUP_SCRIPT: '/* cleanup */',
  CSS_INSPECT_PREFIX: '__twin_css__',
  CLEAR_HIGHLIGHT_SCRIPT: '/* clear */',
}));

let mockSidebarWidth = 0;
const mockSetSidebarWidth = jest.fn((w: number) => { mockSidebarWidth = w; });
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
    mockNavSyncSuppressed = false;
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
    test('registers all 21 expected IPC channels', () => {
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
        'set-zoom',
        'get-zoom',
        'css-full-scan',
        'css-inspect-toggle',
        'css-export-json',
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

  // ===== set-zoom =====
  describe('set-zoom', () => {
    test('sets zoom factor on both views and sends zoom-changed', () => {
      mockLeftView.webContents.setZoomFactor = jest.fn();
      mockRightView.webContents.setZoomFactor = jest.fn();
      const result = handlers['set-zoom']({}, { zoom: 1.5 });
      expect(mockLeftView.webContents.setZoomFactor).toHaveBeenCalledWith(1.5);
      expect(mockRightView.webContents.setZoomFactor).toHaveBeenCalledWith(1.5);
      expect(mockWebContents.send).toHaveBeenCalledWith('zoom-changed', { zoom: 1.5 });
      expect(result).toEqual({ zoom: 1.5 });
    });

    test('clamps zoom to minimum 0.25', () => {
      mockLeftView.webContents.setZoomFactor = jest.fn();
      mockRightView.webContents.setZoomFactor = jest.fn();
      const result = handlers['set-zoom']({}, { zoom: 0.1 });
      expect(result).toEqual({ zoom: 0.25 });
      expect(mockLeftView.webContents.setZoomFactor).toHaveBeenCalledWith(0.25);
    });

    test('clamps zoom to maximum 3.0', () => {
      mockLeftView.webContents.setZoomFactor = jest.fn();
      mockRightView.webContents.setZoomFactor = jest.fn();
      const result = handlers['set-zoom']({}, { zoom: 5.0 });
      expect(result).toEqual({ zoom: 3 });
      expect(mockLeftView.webContents.setZoomFactor).toHaveBeenCalledWith(3);
    });

    test('handles destroyed webContents gracefully', () => {
      mockLeftView.webContents.isDestroyed = jest.fn().mockReturnValue(true);
      mockLeftView.webContents.setZoomFactor = jest.fn();
      mockRightView.webContents.setZoomFactor = jest.fn();
      handlers['set-zoom']({}, { zoom: 1.2 });
      expect(mockLeftView.webContents.setZoomFactor).not.toHaveBeenCalled();
      expect(mockRightView.webContents.setZoomFactor).toHaveBeenCalledWith(1.2);
      mockLeftView.webContents.isDestroyed.mockReturnValue(false);
    });
  });

  // ===== get-zoom =====
  describe('get-zoom', () => {
    test('returns current zoom factor', () => {
      mockLeftView.webContents.setZoomFactor = jest.fn();
      mockRightView.webContents.setZoomFactor = jest.fn();
      handlers['set-zoom']({}, { zoom: 1.5 });
      const result = handlers['get-zoom']({});
      expect(result).toEqual({ zoom: 1.5 });
    });

    test('returns default zoom 1.0 when not changed', () => {
      const result = handlers['get-zoom']({});
      expect(result).toEqual({ zoom: 1 });
    });
  });

  // ===== did-navigate-in-page =====
  describe('did-navigate-in-page sync', () => {
    function getNavigateHandler() {
      const onCall = mockLeftView.webContents.on.mock.calls.find(
        (call: any[]) => call[0] === 'did-navigate-in-page'
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

    test('does not double-navigate right view when click sync already triggered navigation', () => {
      // Simulate: click sync replays a search button click that navigates
      // the right view to /search?q=hello. Then did-navigate-in-page fires
      // on the left view. The right view should NOT be navigated again
      // because nav sync is suppressed after click replay.
      mockNavSyncSuppressed = true;

      const handler = getNavigateHandler();
      mockRightView.webContents.loadURL.mockClear();
      handler({}, 'http://localhost:3000/search?q=hello');

      expect(mockRightView.webContents.loadURL).not.toHaveBeenCalled();
    });

    test('allows navigation sync when no recent click was replayed', () => {
      mockNavSyncSuppressed = false;
      mockSyncManager.isPaused.mockReturnValue(false);
      mockSyncManager.isEnabled.mockReturnValue(true);
      mockRightView.webContents.getURL.mockReturnValue('http://localhost:3001/page');

      const handler = getNavigateHandler();
      mockRightView.webContents.loadURL.mockClear();
      handler({}, 'http://localhost:3000/about');

      expect(mockRightView.webContents.loadURL).toHaveBeenCalledWith(
        'http://localhost:3001/about'
      );
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

  // ===== css-full-scan =====
  describe('css-full-scan', () => {
    test('runs full scan and opens result window', async () => {
      const { runFullScan } = require('../../src/main/css-compare');
      const result = await handlers['css-full-scan']({});
      expect(runFullScan).toHaveBeenCalled();
      expect(mockBrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1000,
          height: 700,
          title: 'Twin - CSS Scan Report',
        })
      );
      expect(result).toEqual(mockScanResult.summary);
    });
  });

  // ===== css-inspect-toggle =====
  describe('css-inspect-toggle', () => {
    test('enables inspect mode and injects script', async () => {
      const result = await handlers['css-inspect-toggle']({}, { enabled: true });
      expect(result).toEqual({ enabled: true });
      expect(mockLeftView.webContents.executeJavaScript).toHaveBeenCalled();
    });

    test('disables inspect mode and cleans up', async () => {
      // First enable
      await handlers['css-inspect-toggle']({}, { enabled: true });
      mockLeftView.webContents.executeJavaScript.mockClear();
      mockRightView.webContents.executeJavaScript.mockClear();

      // Then disable
      const result = await handlers['css-inspect-toggle']({}, { enabled: false });
      expect(result).toEqual({ enabled: false });
      // Should call cleanup scripts
      expect(mockLeftView.webContents.executeJavaScript).toHaveBeenCalled();
      expect(mockRightView.webContents.executeJavaScript).toHaveBeenCalled();
    });
  });

  // ===== css-export-json =====
  describe('css-export-json', () => {
    test('throws when no scan result available', async () => {
      await expect(handlers['css-export-json']({})).rejects.toThrow('No scan result to export');
    });

    test('exports JSON after a scan', async () => {
      // Perform a scan first
      await handlers['css-full-scan']({});

      const fs = require('fs');
      fs.promises.writeFile = jest.fn().mockResolvedValue(undefined);
      mockDialog.showSaveDialog = jest.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/report.json' });

      const result = await handlers['css-export-json']({});
      expect(result).toEqual({ filePath: '/tmp/report.json' });
      expect(fs.promises.writeFile).toHaveBeenCalledWith(
        '/tmp/report.json',
        expect.stringContaining('"changedElements"'),
        'utf-8'
      );
    });

    test('returns null when save dialog is canceled', async () => {
      await handlers['css-full-scan']({});
      mockDialog.showSaveDialog = jest.fn().mockResolvedValue({ canceled: true });
      const result = await handlers['css-export-json']({});
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
      // Run scan first
      await handlers['css-full-scan']({});
      const result = await handlers['css-export-json']({});
      expect(result).toBeNull();
    });
  });

  // ===== CSS inspect console-message handling =====
  describe('css-inspect-message handling', () => {
    function getConsoleMessageHandler() {
      const calls = mockLeftView.webContents.on.mock.calls.filter(
        (call: any[]) => call[0] === 'console-message'
      );
      // The CSS handler is the second console-message listener (first is sync-manager)
      return calls.length > 1 ? calls[1][1] : calls[0][1];
    }

    test('registers console-message listener for CSS inspect', () => {
      const calls = mockLeftView.webContents.on.mock.calls.filter(
        (call: any[]) => call[0] === 'console-message'
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });

    test('ignores messages when inspect is not active', () => {
      const handler = getConsoleMessageHandler();
      mockWebContents.send.mockClear();
      handler({}, 0, '__twin_css__{"type":"inspect-click","data":{"key":"#test","tag":"div","method":"id","styles":{}}}');
      // Should not send any result because inspect is not active
      expect(mockWebContents.send).not.toHaveBeenCalledWith('css-inspect-result', expect.anything());
    });

    test('ignores non-css-prefixed messages', async () => {
      // Enable inspect first
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();
      mockWebContents.send.mockClear();
      handler({}, 0, 'regular console log message');
      expect(mockWebContents.send).not.toHaveBeenCalledWith('css-inspect-result', expect.anything());
    });

    test('ignores malformed JSON messages', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();
      mockWebContents.send.mockClear();
      handler({}, 0, '__twin_css__{invalid json}');
      expect(mockWebContents.send).not.toHaveBeenCalledWith('css-inspect-result', expect.anything());
    });

    test('handles inspect-click and sends result on successful match', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();

      mockRightView.webContents.executeJavaScript
        .mockResolvedValueOnce(true) // highlight
        .mockResolvedValueOnce({ tag: 'div', styles: { color: 'blue' } }); // getElementStyles

      const { compareStyles } = require('../../src/main/css-compare');
      compareStyles.mockReturnValue([{ property: 'color', expected: 'red', actual: 'blue', type: 'changed', category: 'text' }]);

      mockWebContents.send.mockClear();
      const leftData = { key: '#test', tag: 'div', method: 'id', styles: { color: 'red' } };
      handler({}, 0, '__twin_css__' + JSON.stringify({ type: 'inspect-click', data: leftData }));

      // Wait for async handling
      await new Promise((r) => setTimeout(r, 50));

      expect(mockWebContents.send).toHaveBeenCalledWith('css-inspect-result', expect.objectContaining({
        left: leftData,
        error: null,
      }));
    });

    test('sends error when right view highlight fails', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();

      mockRightView.webContents.executeJavaScript.mockResolvedValueOnce(false); // highlight fails

      mockWebContents.send.mockClear();
      const leftData = { key: '#missing', tag: 'div', method: 'id', styles: {} };
      handler({}, 0, '__twin_css__' + JSON.stringify({ type: 'inspect-click', data: leftData }));

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWebContents.send).toHaveBeenCalledWith('css-inspect-result', expect.objectContaining({
        error: 'Matching element not found in right panel',
      }));
    });

    test('sends error when right data retrieval fails', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();

      mockRightView.webContents.executeJavaScript
        .mockResolvedValueOnce(true) // highlight
        .mockResolvedValueOnce(null); // getElementStyles fails

      mockWebContents.send.mockClear();
      const leftData = { key: '#test', tag: 'div', method: 'id', styles: {} };
      handler({}, 0, '__twin_css__' + JSON.stringify({ type: 'inspect-click', data: leftData }));

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWebContents.send).toHaveBeenCalledWith('css-inspect-result', expect.objectContaining({
        error: 'Could not retrieve styles from right panel',
      }));
    });

    test('sends error when rightView is destroyed', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();

      mockRightView.webContents.isDestroyed.mockReturnValueOnce(true);

      mockWebContents.send.mockClear();
      const leftData = { key: '#test', tag: 'div', method: 'id', styles: {} };
      handler({}, 0, '__twin_css__' + JSON.stringify({ type: 'inspect-click', data: leftData }));

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWebContents.send).toHaveBeenCalledWith('css-inspect-result', expect.objectContaining({
        error: 'Right view is not available',
      }));
    });
  });

  // ===== CSS inspect auto-disable on navigation =====
  describe('css-inspect auto-disable on navigation', () => {
    function getDidNavigateHandler() {
      const calls = mockLeftView.webContents.on.mock.calls.filter(
        (call: any[]) => call[0] === 'did-navigate'
      );
      return calls.length > 0 ? calls[0][1] : null;
    }

    test('registers did-navigate listener on leftView', () => {
      const handler = getDidNavigateHandler();
      expect(handler).toBeTruthy();
    });

    test('disables inspect mode on page navigation', async () => {
      // Enable inspect mode
      await handlers['css-inspect-toggle']({}, { enabled: true });
      mockWebContents.send.mockClear();

      const handler = getDidNavigateHandler();
      handler();

      expect(mockWebContents.send).toHaveBeenCalledWith('css-inspect-result', expect.objectContaining({
        modeDisabled: true,
      }));
    });

    test('does nothing when inspect is not active', () => {
      mockWebContents.send.mockClear();
      const handler = getDidNavigateHandler();
      handler();
      expect(mockWebContents.send).not.toHaveBeenCalledWith('css-inspect-result', expect.anything());
    });
  });

  // ===== navigate edge cases =====
  describe('navigate edge cases', () => {
    test('rejects ftp URLs', () => {
      expect(() => handlers['navigate']({}, { url: 'ftp://example.com', target: 'left' }))
        .toThrow('Only http: and https: URLs are allowed');
    });

    test('rejects javascript URLs', () => {
      expect(() => handlers['navigate']({}, { url: 'javascript:alert(1)', target: 'left' }))
        .toThrow('Only http: and https: URLs are allowed');
    });

    test('rejects file URLs', () => {
      expect(() => handlers['navigate']({}, { url: 'file:///etc/passwd', target: 'left' }))
        .toThrow('Only http: and https: URLs are allowed');
    });

    test('rejects invalid URL format', () => {
      expect(() => handlers['navigate']({}, { url: 'not-a-valid-url', target: 'left' }))
        .toThrow('Only http: and https: URLs are allowed');
    });

    test('accepts https URL for left target', () => {
      handlers['navigate']({}, { url: 'https://secure.example.com', target: 'left' });
      expect(mockLeftWebContents.loadURL).toHaveBeenCalledWith('https://secure.example.com');
    });

    test('does nothing for unknown target', () => {
      handlers['navigate']({}, { url: 'http://example.com', target: 'unknown' });
      expect(mockLeftWebContents.loadURL).not.toHaveBeenCalled();
      expect(mockRightView.webContents.loadURL).not.toHaveBeenCalled();
    });

    test('saves right URL to store on navigation', () => {
      handlers['navigate']({}, { url: 'http://new-right.com', target: 'right' });
      expect(mockStoreData.rightUrl).toBe('http://new-right.com');
    });
  });

  // ===== capture-and-compare edge cases =====
  describe('capture-and-compare edge cases', () => {
    test('rejects page name with special characters', async () => {
      await expect(handlers['capture-and-compare']({}, { pageName: 'my page!' }))
        .rejects.toThrow('Invalid page name');
    });

    test('rejects empty page name', async () => {
      await expect(handlers['capture-and-compare']({}, { pageName: '' }))
        .rejects.toThrow('Invalid page name');
    });

    test('rejects page name over 100 characters', async () => {
      const longName = 'a'.repeat(101);
      await expect(handlers['capture-and-compare']({}, { pageName: longName }))
        .rejects.toThrow('Invalid page name');
    });

    test('accepts page name with hyphens and underscores', async () => {
      await handlers['capture-and-compare']({}, { pageName: 'my-test_page-01' });
      const { captureScreenshots } = require('../../src/main/screenshot');
      expect(captureScreenshots).toHaveBeenCalled();
    });

    test('accepts page name of exactly 100 characters', async () => {
      const name100 = 'a'.repeat(100);
      await handlers['capture-and-compare']({}, { pageName: name100 });
      const { captureScreenshots } = require('../../src/main/screenshot');
      expect(captureScreenshots).toHaveBeenCalled();
    });

    test('sends error result on regCli failure', async () => {
      const { runRegCli } = require('../../src/main/reg-runner');
      runRegCli.mockRejectedValueOnce(new Error('reg-cli failed'));
      mockWebContents.send.mockClear();
      await expect(handlers['capture-and-compare']({}, { pageName: 'test' })).rejects.toThrow('reg-cli failed');
      expect(mockWebContents.send).toHaveBeenCalledWith('capture-result', expect.objectContaining({
        error: 'reg-cli failed',
      }));
    });
  });

  // ===== set-zoom edge cases =====
  describe('set-zoom edge cases', () => {
    beforeEach(() => {
      // Add setZoomFactor to mocks for zoom tests
      mockLeftWebContents.setZoomFactor = jest.fn();
      mockRightView.webContents.setZoomFactor = jest.fn();
    });

    test('clamps zoom above MAX_ZOOM to 3.0', () => {
      const result = handlers['set-zoom']({}, { zoom: 5.0 });
      expect(result.zoom).toBe(3.0);
    });

    test('clamps zoom below MIN_ZOOM to 0.25', () => {
      const result = handlers['set-zoom']({}, { zoom: 0.1 });
      expect(result.zoom).toBe(0.25);
    });

    test('rounds zoom to two decimal places', () => {
      const result = handlers['set-zoom']({}, { zoom: 1.234567 });
      expect(result.zoom).toBe(1.23);
    });

    test('sends zoom-changed to main window', () => {
      mockWebContents.send.mockClear();
      handlers['set-zoom']({}, { zoom: 1.5 });
      expect(mockWebContents.send).toHaveBeenCalledWith('zoom-changed', { zoom: 1.5 });
    });

    test('applies zoom to both left and right views', () => {
      handlers['set-zoom']({}, { zoom: 2.0 });
      expect(mockLeftWebContents.setZoomFactor).toHaveBeenCalledWith(2.0);
      expect(mockRightView.webContents.setZoomFactor).toHaveBeenCalledWith(2.0);
    });
  });

  // ===== set-views-visible edge cases =====
  describe('set-views-visible edge cases', () => {
    test('show without previous hide does not crash', () => {
      handlers['set-views-visible']({}, { visible: true });
      // Should not throw
    });

    test('hide moves views off-screen', () => {
      mockLeftView.getBounds = jest.fn().mockReturnValue({ x: 0, y: 52, width: 600, height: 400 });
      mockRightView.getBounds = jest.fn().mockReturnValue({ x: 600, y: 52, width: 600, height: 400 });
      handlers['set-views-visible']({}, { visible: false });
      expect(mockLeftView.setBounds).toHaveBeenCalledWith(expect.objectContaining({ x: -9999 }));
      expect(mockRightView.setBounds).toHaveBeenCalledWith(expect.objectContaining({ x: -9999 }));
    });
  });

  // ===== read-file-data edge cases =====
  describe('read-file-data edge cases', () => {
    beforeEach(async () => {
      // Ensure mocks are properly configured for file access
      const fs = require('fs');
      fs.realpathSync.mockImplementation((p: string) => p);
      mockDialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/selected/folder'] });
      // Set allowedBasePath by calling select-folder
      await handlers['select-folder']({});
    });

    test('returns correct MIME type for JPG', async () => {
      const result = await handlers['read-file-data']({}, { filePath: '/selected/folder/image.jpg' });
      expect(result.mimeType).toBe('image/jpeg');
    });

    test('returns correct MIME type for JPEG', async () => {
      const result = await handlers['read-file-data']({}, { filePath: '/selected/folder/photo.jpeg' });
      expect(result.mimeType).toBe('image/jpeg');
    });

    test('returns correct MIME type for GIF', async () => {
      const result = await handlers['read-file-data']({}, { filePath: '/selected/folder/anim.gif' });
      expect(result.mimeType).toBe('image/gif');
    });

    test('returns correct MIME type for WEBP', async () => {
      const result = await handlers['read-file-data']({}, { filePath: '/selected/folder/image.webp' });
      expect(result.mimeType).toBe('image/webp');
    });

    test('returns correct MIME type for SVG', async () => {
      const result = await handlers['read-file-data']({}, { filePath: '/selected/folder/icon.svg' });
      expect(result.mimeType).toBe('image/svg+xml');
    });

    test('returns octet-stream for unknown extension', async () => {
      const result = await handlers['read-file-data']({}, { filePath: '/selected/folder/file.xyz' });
      expect(result.mimeType).toBe('application/octet-stream');
    });
  });

  // ===== reload-views edge cases =====
  describe('reload-views edge cases', () => {
    test('reloads only left view when target is left', async () => {
      await handlers['reload-views']({}, { target: 'left' });
      expect(mockLeftWebContents.reload).toHaveBeenCalled();
      expect(mockRightView.webContents.reload).not.toHaveBeenCalled();
    });

    test('reloads only right view when target is right', async () => {
      await handlers['reload-views']({}, { target: 'right' });
      expect(mockLeftWebContents.reload).not.toHaveBeenCalled();
      expect(mockRightView.webContents.reload).toHaveBeenCalled();
    });

    test('does nothing for invalid target', async () => {
      await handlers['reload-views']({}, { target: 'invalid' });
      expect(mockLeftWebContents.reload).not.toHaveBeenCalled();
      expect(mockRightView.webContents.reload).not.toHaveBeenCalled();
    });
  });

  // ===== set-device-preset edge cases =====
  describe('set-device-preset edge cases', () => {
    test('calculates content size correctly', async () => {
      await handlers['set-device-preset']({}, { width: 375, height: 667 });
      expect(mockMainWindow.setContentSize).toHaveBeenCalledWith(
        0 + 375 * 2,  // sidebarWidth(0) + width*2
        667 + 52 + 28  // height + toolbar + statusbar
      );
    });

    test('applies bounds to both views with sidebar offset', async () => {
      // First set sidebar width
      await handlers['set-sidebar-width']({}, { width: 250 });
      mockGetSidebarWidth.mockReturnValue(250);
      // Then set preset
      await handlers['set-device-preset']({}, { width: 375, height: 667 });
      expect(mockLeftView.setBounds).toHaveBeenCalledWith(expect.objectContaining({ width: 375, height: 667 }));
      expect(mockRightView.setBounds).toHaveBeenCalledWith(expect.objectContaining({ width: 375, height: 667 }));
    });
  });

  // ===== did-navigate-in-page additional edge cases =====
  describe('did-navigate-in-page additional edge cases', () => {
    test('does not navigate right view when sync is disabled', () => {
      mockSyncEnabled = false;
      mockSyncManager.isEnabled.mockReturnValue(false);
      const didNavigateInPage = mockLeftWebContents.on.mock.calls.find(
        (call: any[]) => call[0] === 'did-navigate-in-page'
      );
      if (didNavigateInPage) {
        const handler = didNavigateInPage[1];
        handler({}, 'http://localhost:3000/new-page');
        expect(mockRightView.webContents.loadURL).not.toHaveBeenCalled();
      }
    });

    test('does not navigate right view when paused', () => {
      mockSyncPaused = true;
      mockSyncManager.isPaused.mockReturnValue(true);
      const didNavigateInPage = mockLeftWebContents.on.mock.calls.find(
        (call: any[]) => call[0] === 'did-navigate-in-page'
      );
      if (didNavigateInPage) {
        const handler = didNavigateInPage[1];
        handler({}, 'http://localhost:3000/new-page');
        expect(mockRightView.webContents.loadURL).not.toHaveBeenCalled();
      }
    });

    test('does not navigate when nav sync is suppressed', () => {
      mockNavSyncSuppressed = true;
      const didNavigateInPage = mockLeftWebContents.on.mock.calls.find(
        (call: any[]) => call[0] === 'did-navigate-in-page'
      );
      if (didNavigateInPage) {
        const handler = didNavigateInPage[1];
        handler({}, 'http://localhost:3000/new-page');
        expect(mockRightView.webContents.loadURL).not.toHaveBeenCalledWith(
          expect.stringContaining('/new-page')
        );
      }
    });
  });

  // ===== css-inspect-toggle additional edge cases =====
  describe('css-inspect-toggle additional edge cases', () => {
    test('disable clears both left and right view scripts', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      mockLeftWebContents.executeJavaScript.mockClear();
      mockRightView.webContents.executeJavaScript.mockClear();
      await handlers['css-inspect-toggle']({}, { enabled: false });
      expect(mockLeftWebContents.executeJavaScript).toHaveBeenCalled();
      expect(mockRightView.webContents.executeJavaScript).toHaveBeenCalled();
    });

    test('returns current enabled state', async () => {
      const result = await handlers['css-inspect-toggle']({}, { enabled: true });
      expect(result.enabled).toBe(true);
      const result2 = await handlers['css-inspect-toggle']({}, { enabled: false });
      expect(result2.enabled).toBe(false);
    });
  });

  // ===== isPathUnderBase catch path =====
  describe('isPathUnderBase catch (realpathSync throws)', () => {
    test('read-file-data rejects when realpathSync throws for the target path', async () => {
      // Select folder first to set allowedBasePath
      mockDialog.showOpenDialog.mockResolvedValueOnce({ canceled: false, filePaths: ['/selected/folder'] });
      await handlers['select-folder']({});

      const fs = require('fs');
      // Make realpathSync throw for a specific path (simulates non-existent path)
      fs.realpathSync.mockImplementation((p: string) => {
        if (p === '/selected/folder/nonexistent/file.png') {
          throw new Error('ENOENT: no such file or directory');
        }
        return p;
      });

      await expect(
        handlers['read-file-data']({}, { filePath: '/selected/folder/nonexistent/file.png' }),
      ).rejects.toThrow('Access denied');

      // Restore
      fs.realpathSync.mockImplementation((p: string) => p);
    });
  });

  // ===== read-file-data access denied =====
  describe('read-file-data access denied', () => {
    test('rejects when no folder is selected (no allowedBasePath)', async () => {
      // Reset handlers to start fresh without allowedBasePath
      jest.resetModules();
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      registerIpcHandlers({
        mainWindow: mockMainWindow,
        leftView: mockLeftView,
        rightView: mockRightView,
        setSidebarWidth: mockSetSidebarWidth,
        getSidebarWidth: mockGetSidebarWidth,
      });

      await expect(
        handlers['read-file-data']({}, { filePath: '/some/file.png' }),
      ).rejects.toThrow('Access denied');
    });
  });

  // ===== CSS inspect executeJavaScript rejection paths =====
  describe('css-inspect executeJavaScript rejections', () => {
    function getConsoleMessageHandler() {
      const calls = mockLeftView.webContents.on.mock.calls.filter(
        (call: any[]) => call[0] === 'console-message',
      );
      return calls.length > 1 ? calls[1][1] : calls[0][1];
    }

    test('sends error when highlight script rejects (catch → false)', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();

      // Make executeJavaScript reject (hits .catch(() => false) on line 433)
      mockRightView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('script error'));

      mockWebContents.send.mockClear();
      const leftData = { key: '#test', tag: 'div', method: 'id', styles: {} };
      handler({}, 0, '__twin_css__' + JSON.stringify({ type: 'inspect-click', data: leftData }));

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'css-inspect-result',
        expect.objectContaining({
          error: 'Matching element not found in right panel',
        }),
      );
    });

    test('sends error when getElementStyles script rejects (catch → null)', async () => {
      await handlers['css-inspect-toggle']({}, { enabled: true });
      const handler = getConsoleMessageHandler();

      // First call: highlight succeeds. Second call: getElementStyles rejects
      mockRightView.webContents.executeJavaScript
        .mockResolvedValueOnce(true) // highlight succeeds
        .mockRejectedValueOnce(new Error('script error')); // getElementStyles fails (hits .catch(() => null) on line 450)

      mockWebContents.send.mockClear();
      const leftData = { key: '#test', tag: 'div', method: 'id', styles: {} };
      handler({}, 0, '__twin_css__' + JSON.stringify({ type: 'inspect-click', data: leftData }));

      await new Promise((r) => setTimeout(r, 50));

      expect(mockWebContents.send).toHaveBeenCalledWith(
        'css-inspect-result',
        expect.objectContaining({
          error: 'Could not retrieve styles from right panel',
        }),
      );
    });
  });

  // ===== css-full-scan additional edge cases =====
  describe('css-full-scan additional edge cases', () => {
    test('returns scan summary', async () => {
      const result = await handlers['css-full-scan']({});
      expect(result.changedElements).toBe(1);
      expect(result.addedElements).toBe(0);
      expect(result.deletedElements).toBe(0);
    });

    test('opens new BrowserWindow with report', async () => {
      await handlers['css-full-scan']({});
      expect(mockBrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1000, height: 700 })
      );
    });
  });

  // ===== settings round-trip =====
  describe('settings round-trip', () => {
    test('save calls saveSettings with provided data', () => {
      const result = handlers['save-settings']({}, { settings: { leftUrl: 'http://updated.com' } });
      const { saveSettings } = require('../../src/main/store');
      expect(saveSettings).toHaveBeenCalledWith({ leftUrl: 'http://updated.com' });
      expect(result.success).toBe(true);
    });

    test('get returns settings object', () => {
      const result = handlers['get-settings']({});
      expect(result).toHaveProperty('leftUrl');
      expect(result).toHaveProperty('rightUrl');
    });
  });

  // ===== sync enable/disable round-trip =====
  describe('sync enable/disable round-trip', () => {
    test('set-sync-enabled calls syncManager.setEnabled', () => {
      handlers['set-sync-enabled']({}, { enabled: false });
      expect(mockSyncManager.setEnabled).toHaveBeenCalledWith(false);
    });

    test('get-sync-enabled calls syncManager.isEnabled', () => {
      const r = handlers['get-sync-enabled']({});
      expect(mockSyncManager.isEnabled).toHaveBeenCalled();
      expect(r).toHaveProperty('enabled');
    });
  });

  // ===== reinject-sync =====
  describe('reinject-sync', () => {
    test('calls syncManager.inject', () => {
      const result = handlers['reinject-sync']({});
      expect(mockSyncManager.inject).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  // ===== create-directory edge cases =====
  describe('create-directory edge cases', () => {
    test('rejects when no base path is selected', async () => {
      // Reset handlers to clear allowedBasePath
      Object.keys(handlers).forEach((k) => delete handlers[k]);
      const { registerIpcHandlers } = require('../../src/main/ipc-handlers');
      registerIpcHandlers({
        mainWindow: mockMainWindow,
        leftView: mockLeftView,
        rightView: mockRightView,
        setSidebarWidth: mockSetSidebarWidth,
        getSidebarWidth: mockGetSidebarWidth,
      });
      await expect(handlers['create-directory']({}, { dirPath: '/some/path' }))
        .rejects.toThrow('Access denied');
    });
  });
});
