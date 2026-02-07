const path = require('path');

// ---------- Mocks ----------

let mockToolbarListeners = {};
const mockToolbarWebContents = {
  on: jest.fn((event, cb) => {
    if (!mockToolbarListeners[event]) mockToolbarListeners[event] = [];
    mockToolbarListeners[event].push(cb);
  }),
  setZoomFactor: jest.fn(),
  setZoomLevel: jest.fn(),
  openDevTools: jest.fn(),
  send: jest.fn(),
  isFocused: jest.fn(() => false),
  isDestroyed: jest.fn(() => false),
};

let mockLeftListeners = {};
const mockLeftWebContents = {
  loadURL: jest.fn().mockResolvedValue(undefined),
  on: jest.fn((event, cb) => {
    if (!mockLeftListeners[event]) mockLeftListeners[event] = [];
    mockLeftListeners[event].push(cb);
  }),
  setZoomFactor: jest.fn(),
  setZoomLevel: jest.fn(),
  reload: jest.fn(),
  isFocused: jest.fn(() => false),
  isDestroyed: jest.fn(() => false),
};

let mockRightListeners = {};
const mockRightWebContents = {
  loadURL: jest.fn().mockResolvedValue(undefined),
  on: jest.fn((event, cb) => {
    if (!mockRightListeners[event]) mockRightListeners[event] = [];
    mockRightListeners[event].push(cb);
  }),
  setZoomFactor: jest.fn(),
  setZoomLevel: jest.fn(),
  reload: jest.fn(),
  isFocused: jest.fn(() => false),
  isDestroyed: jest.fn(() => false),
};

let mainWindowListeners = {};
const mockMainWindow = {
  loadFile: jest.fn(),
  webContents: mockToolbarWebContents,
  on: jest.fn((event, cb) => {
    if (!mainWindowListeners[event]) mainWindowListeners[event] = [];
    mainWindowListeners[event].push(cb);
  }),
  getContentBounds: jest.fn(() => ({ width: 1400, height: 900 })),
  setContentSize: jest.fn(),
  isFocused: jest.fn(() => false),
  contentView: {
    addChildView: jest.fn(),
  },
};

let mockViewIndex = 0;
const mockViews = [
  { webContents: mockLeftWebContents, setBounds: jest.fn() },
  { webContents: mockRightWebContents, setBounds: jest.fn() },
];

const menuItemsByAccelerator = {};
const mockMenu = {
  buildFromTemplate: jest.fn((template) => {
    // Extract accelerator-click pairs from the template for testing
    function extract(items) {
      for (const item of items) {
        if (item.accelerator && item.click) {
          menuItemsByAccelerator[item.accelerator] = item.click;
        }
        if (item.submenu) extract(item.submenu);
      }
    }
    extract(template);
    return { template };
  }),
  setApplicationMenu: jest.fn(),
};

let mockSyncPaused = false;
const mockSyncManager = {
  start: jest.fn(),
  stop: jest.fn(),
  inject: jest.fn(),
  isEnabled: jest.fn(() => true),
  setEnabled: jest.fn(),
  isPaused: jest.fn(() => mockSyncPaused),
  pause: jest.fn(() => { mockSyncPaused = true; }),
  resume: jest.fn(() => { mockSyncPaused = false; }),
};

let mockAppListeners = {};
const mockBrowserWindowClass = jest.fn(() => mockMainWindow);
mockBrowserWindowClass.getAllWindows = jest.fn(() => []);

jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn(() => new Promise(() => {})),
    on: jest.fn((event, cb) => {
      if (!mockAppListeners[event]) mockAppListeners[event] = [];
      mockAppListeners[event].push(cb);
    }),
  },
  BrowserWindow: mockBrowserWindowClass,
  WebContentsView: jest.fn(() => {
    const view = mockViews[mockViewIndex];
    mockViewIndex++;
    return view;
  }),
  Menu: mockMenu,
}));

jest.mock('../../src/main/ipc-handlers', () => ({
  registerIpcHandlers: jest.fn(() => ({ syncManager: mockSyncManager })),
}));

jest.mock('../../src/main/store', () => ({
  getStore: jest.fn(() => ({
    get: jest.fn((key) => {
      const defaults = { leftUrl: 'http://localhost:3000', rightUrl: 'http://localhost:3001' };
      return defaults[key];
    }),
  })),
}));

// ---------- Tests ----------

describe('index.js', () => {
  let indexModule;

  beforeEach(() => {
    jest.clearAllMocks();
    mainWindowListeners = {};
    mockToolbarListeners = {};
    mockLeftListeners = {};
    mockRightListeners = {};
    mockAppListeners = {};
    Object.keys(menuItemsByAccelerator).forEach((k) => delete menuItemsByAccelerator[k]);
    mockViewIndex = 0;
    mockSyncPaused = false;
    mockMainWindow.isFocused.mockReturnValue(false);
    mockLeftWebContents.isFocused.mockReturnValue(false);
    mockRightWebContents.isFocused.mockReturnValue(false);
    mockLeftWebContents.isDestroyed.mockReturnValue(false);
    mockRightWebContents.isDestroyed.mockReturnValue(false);
    mockSyncManager.isPaused.mockImplementation(() => mockSyncPaused);

    indexModule = require('../../src/main/index');
    indexModule.createWindow();
  });

  afterEach(() => {
    jest.resetModules();
  });

  // ===== isAppFocused =====
  describe('isAppFocused', () => {
    test('returns true when mainWindow.isFocused() is true', () => {
      mockMainWindow.isFocused.mockReturnValue(true);
      expect(indexModule.isAppFocused()).toBe(true);
    });

    test('returns true when leftView webContents isFocused', () => {
      mockLeftWebContents.isFocused.mockReturnValue(true);
      expect(indexModule.isAppFocused()).toBe(true);
    });

    test('returns true when rightView webContents isFocused', () => {
      mockRightWebContents.isFocused.mockReturnValue(true);
      expect(indexModule.isAppFocused()).toBe(true);
    });

    test('returns false when nothing is focused', () => {
      expect(indexModule.isAppFocused()).toBe(false);
    });

    test('returns false when leftView is destroyed', () => {
      mockLeftWebContents.isDestroyed.mockReturnValue(true);
      mockLeftWebContents.isFocused.mockReturnValue(true);
      expect(indexModule.isAppFocused()).toBe(false);
    });

    test('returns false when rightView is destroyed', () => {
      mockRightWebContents.isDestroyed.mockReturnValue(true);
      mockRightWebContents.isFocused.mockReturnValue(true);
      expect(indexModule.isAppFocused()).toBe(false);
    });
  });

  // ===== Menu accelerator shortcuts =====
  describe('menu accelerator shortcuts', () => {
    test('Cmd+R reloads both views', () => {
      menuItemsByAccelerator['CommandOrControl+R']();
      expect(mockLeftWebContents.reload).toHaveBeenCalled();
      expect(mockRightWebContents.reload).toHaveBeenCalled();
    });

    test('Cmd+Shift+S fires capture', () => {
      menuItemsByAccelerator['CommandOrControl+Shift+S']();
      expect(mockToolbarWebContents.send).toHaveBeenCalledWith('shortcut-capture');
    });

    test('Cmd+Shift+O fires open-report', () => {
      menuItemsByAccelerator['CommandOrControl+Shift+O']();
      expect(mockToolbarWebContents.send).toHaveBeenCalledWith('shortcut-open-report');
    });

    test('Cmd+1 fires preset', () => {
      menuItemsByAccelerator['CommandOrControl+1']();
      expect(mockToolbarWebContents.send).toHaveBeenCalledWith('shortcut-preset', { index: 0 });
    });

    test('Cmd+, fires settings', () => {
      menuItemsByAccelerator['CommandOrControl+,']();
      expect(mockToolbarWebContents.send).toHaveBeenCalledWith('shortcut-settings');
    });

    test('Cmd+Shift+R reloads only left view when it has focus', () => {
      mockLeftWebContents.isFocused.mockReturnValue(true);
      menuItemsByAccelerator['CommandOrControl+Shift+R']();
      expect(mockLeftWebContents.reload).toHaveBeenCalled();
      expect(mockRightWebContents.reload).not.toHaveBeenCalled();
    });

    test('Cmd+Shift+R reloads right view when left is not focused', () => {
      menuItemsByAccelerator['CommandOrControl+Shift+R']();
      expect(mockRightWebContents.reload).toHaveBeenCalled();
      expect(mockLeftWebContents.reload).not.toHaveBeenCalled();
    });

    test('registers Menu via buildFromTemplate and setApplicationMenu', () => {
      expect(mockMenu.buildFromTemplate).toHaveBeenCalled();
      expect(mockMenu.setApplicationMenu).toHaveBeenCalled();
    });
  });

  // ===== Focus/Blur handlers =====
  describe('focus/blur handlers', () => {
    test('focus handler resumes sync and re-injects when paused', () => {
      mockSyncPaused = true;
      const focusHandler = mainWindowListeners['focus'][0];
      focusHandler();
      expect(mockSyncManager.resume).toHaveBeenCalled();
      expect(mockSyncManager.inject).toHaveBeenCalled();
    });

    test('focus handler does not call resume/inject when not paused', () => {
      const focusHandler = mainWindowListeners['focus'][0];
      focusHandler();
      expect(mockSyncManager.resume).not.toHaveBeenCalled();
      expect(mockSyncManager.inject).not.toHaveBeenCalled();
    });

    test('blur handler pauses sync after timeout when app loses focus', () => {
      jest.useFakeTimers();
      const blurHandler = mainWindowListeners['blur'][0];
      blurHandler();
      expect(mockSyncManager.pause).not.toHaveBeenCalled();
      jest.advanceTimersByTime(150);
      expect(mockSyncManager.pause).toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('blur handler does NOT pause when focus transfers to child view', () => {
      jest.useFakeTimers();
      const blurHandler = mainWindowListeners['blur'][0];
      blurHandler();
      // Simulate focus moved to leftView (still within app)
      mockLeftWebContents.isFocused.mockReturnValue(true);
      jest.advanceTimersByTime(150);
      expect(mockSyncManager.pause).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('blur timeout is cleared on subsequent focus', () => {
      jest.useFakeTimers();
      const blurHandler = mainWindowListeners['blur'][0];
      const focusHandler = mainWindowListeners['focus'][0];

      blurHandler();
      // Before timeout fires, focus comes back
      mockSyncPaused = true;
      focusHandler();
      jest.advanceTimersByTime(150);
      // pause should not be called (blur timeout was cleared)
      expect(mockSyncManager.pause).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    test('closed handler clears blur timeout', () => {
      jest.useFakeTimers();
      const blurHandler = mainWindowListeners['blur'][0];
      const closedHandler = mainWindowListeners['closed'][0];

      blurHandler();
      closedHandler();
      jest.advanceTimersByTime(150);
      expect(mockSyncManager.pause).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  // ===== Window event registration =====
  describe('window event registration', () => {
    test('registers focus, blur, resize, and closed handlers', () => {
      expect(mainWindowListeners['focus']).toBeDefined();
      expect(mainWindowListeners['blur']).toBeDefined();
      expect(mainWindowListeners['resize']).toBeDefined();
      expect(mainWindowListeners['closed']).toBeDefined();
    });
  });

  // ===== did-finish-load zoom reset =====
  describe('did-finish-load', () => {
    test('resets zoom factor and level on toolbar webContents', () => {
      const handler = mockToolbarListeners['did-finish-load'][0];
      mockToolbarWebContents.setZoomFactor.mockClear();
      mockToolbarWebContents.setZoomLevel.mockClear();
      handler();
      expect(mockToolbarWebContents.setZoomFactor).toHaveBeenCalledWith(1.0);
      expect(mockToolbarWebContents.setZoomLevel).toHaveBeenCalledWith(0);
    });
  });

  // ===== resize handler =====
  describe('resize handler', () => {
    test('calls layoutViews on resize', () => {
      const resizeHandler = mainWindowListeners['resize'][0];
      mockViews[0].setBounds.mockClear();
      mockViews[1].setBounds.mockClear();
      resizeHandler();
      expect(mockViews[0].setBounds).toHaveBeenCalled();
      expect(mockViews[1].setBounds).toHaveBeenCalled();
    });
  });

  // ===== did-fail-load error handlers =====
  describe('did-fail-load', () => {
    test('logs error for left view on non-abort failure', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handler = mockLeftListeners['did-fail-load'][0];
      handler({}, -2, 'Connection refused', 'http://localhost:3000');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Left view failed'));
      spy.mockRestore();
    });

    test('ignores ERR_ABORTED (-3) for left view', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handler = mockLeftListeners['did-fail-load'][0];
      handler({}, -3, 'ERR_ABORTED', 'http://localhost:3000');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test('logs error for right view on non-abort failure', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handler = mockRightListeners['did-fail-load'][0];
      handler({}, -2, 'Connection refused', 'http://localhost:3001');
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Right view failed'));
      spy.mockRestore();
    });

    test('ignores ERR_ABORTED (-3) for right view', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const handler = mockRightListeners['did-fail-load'][0];
      handler({}, -3, 'ERR_ABORTED', 'http://localhost:3001');
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ===== setSidebarWidth / getSidebarWidth =====
  describe('setSidebarWidth and getSidebarWidth', () => {
    test('setSidebarWidth updates width and re-layouts views', () => {
      mockViews[0].setBounds.mockClear();
      mockViews[1].setBounds.mockClear();
      indexModule.setSidebarWidth(250);
      expect(indexModule.getSidebarWidth()).toBe(250);
      expect(mockViews[0].setBounds).toHaveBeenCalled();
      expect(mockViews[1].setBounds).toHaveBeenCalled();
    });
  });

  // ===== layoutViews =====
  describe('layoutViews', () => {
    test('lays out views with correct bounds', () => {
      mockViews[0].setBounds.mockClear();
      mockViews[1].setBounds.mockClear();
      indexModule.layoutViews();
      // With 1400 width, 0 sidebar: halfWidth = 700
      expect(mockViews[0].setBounds).toHaveBeenCalledWith({
        x: 0, y: 52, width: 700, height: 900 - 52 - 28,
      });
      expect(mockViews[1].setBounds).toHaveBeenCalledWith({
        x: 700, y: 52, width: 700, height: 900 - 52 - 28,
      });
    });
  });

  // ===== app event handlers =====
  describe('app event handlers', () => {
    test('window-all-closed quits on non-darwin', () => {
      const { app } = require('electron');
      const handler = mockAppListeners['window-all-closed'];
      expect(handler).toBeDefined();
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      app.quit = jest.fn();
      handler[0]();
      expect(app.quit).toHaveBeenCalled();
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('window-all-closed does not quit on darwin', () => {
      const { app } = require('electron');
      const handler = mockAppListeners['window-all-closed'];
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      app.quit = jest.fn();
      handler[0]();
      expect(app.quit).not.toHaveBeenCalled();
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    test('activate creates window when no windows exist', () => {
      const handler = mockAppListeners['activate'];
      expect(handler).toBeDefined();
      mockBrowserWindowClass.getAllWindows.mockReturnValue([]);
      mockViewIndex = 0;
      handler[0]();
      // createWindow should have been called (BrowserWindow constructor invoked)
      expect(mockBrowserWindowClass).toHaveBeenCalled();
    });

    test('activate does not create window when windows exist', () => {
      const handler = mockAppListeners['activate'];
      mockBrowserWindowClass.getAllWindows.mockReturnValue([mockMainWindow]);
      mockBrowserWindowClass.mockClear();
      handler[0]();
      expect(mockBrowserWindowClass).not.toHaveBeenCalled();
    });
  });

  // ===== --dev flag =====
  describe('--dev flag', () => {
    test('opens DevTools when --dev is in argv', () => {
      jest.resetModules();
      mainWindowListeners = {};
      mockToolbarListeners = {};
      mockLeftListeners = {};
      mockRightListeners = {};
      mockAppListeners = {};
      Object.keys(menuItemsByAccelerator).forEach((k) => delete menuItemsByAccelerator[k]);
      mockViewIndex = 0;
      const originalArgv = process.argv;
      process.argv = [...originalArgv, '--dev'];
      const mod = require('../../src/main/index');
      mod.createWindow();
      expect(mockToolbarWebContents.openDevTools).toHaveBeenCalledWith({ mode: 'detach' });
      process.argv = originalArgv;
    });
  });
});
