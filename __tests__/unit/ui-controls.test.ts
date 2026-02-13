/** @jest-environment jsdom */
export {};

const devicePresets = require('../../src/renderer/scripts/device-presets');
const _getPresetByIndex = devicePresets.getPresetByIndex;
const _PRESET_LIST = devicePresets.PRESET_LIST;

// ---------- helpers ----------
function buildDOM() {
  document.body.innerHTML = `
    <button id="toggle-sidebar"></button>
    <input type="text" id="left-url" />
    <input type="text" id="right-url" />
    <button id="reload-left"></button>
    <button id="reload-right"></button>
    <button id="capture-btn"></button>
    <button id="report-btn"></button>
    <button id="settings-btn"></button>
    <button id="toggle-sync"></button>
    <button id="reload-sync-btn"></button>
    <div id="sidebar" class="sidebar collapsed">
      <button id="sidebar-select-folder"></button>
      <button id="sidebar-new-folder"></button>
      <div id="sidebar-new-folder-form" class="sidebar-new-folder-form hidden">
        <input type="text" id="sidebar-new-folder-name" />
        <button id="sidebar-new-folder-ok"></button>
        <button id="sidebar-new-folder-cancel"></button>
      </div>
      <div class="sidebar-output-info">
        <span class="sidebar-output-label">Output</span>
        <span id="sidebar-output-dir" class="sidebar-output-path">Not set</span>
      </div>
      <div class="sidebar-controls">
        <select id="sidebar-sort">
          <option value="name-asc">Name A-Z</option>
          <option value="name-desc">Name Z-A</option>
          <option value="type">Type</option>
        </select>
        <label><input type="radio" name="sidebar-filter" value="all" checked />All</label>
        <label><input type="radio" name="sidebar-filter" value="directories" />Dirs</label>
        <label><input type="radio" name="sidebar-filter" value="files" />Files</label>
      </div>
      <div id="sidebar-tree" class="sidebar-tree"></div>
    </div>
    <div id="settings-modal" class="modal hidden">
      <input id="setting-matching-threshold" value="0" />
      <input id="setting-threshold-rate" value="0" />
      <input id="setting-snapshot-dir" value="./snapshots" />
      <button id="settings-save"></button>
      <button id="settings-cancel"></button>
    </div>
    <button id="new-report-btn"></button>
    <div id="new-report-modal" class="modal hidden">
      <div id="new-report-folder-info" class="form-info hidden">
        <span class="form-info-label">Save to</span>
        <span id="new-report-folder-path" class="form-info-value"></span>
      </div>
      <input id="report-test-name" />
      <button id="new-report-capture"></button>
      <button id="new-report-cancel"></button>
    </div>
    <div class="zoom-controls">
      <button id="zoom-out-btn" class="btn btn-icon">&#x2212;</button>
      <button id="zoom-level-btn" class="btn btn-zoom-level">100%</button>
      <button id="zoom-in-btn" class="btn btn-icon">&#x2b;</button>
    </div>
    <span id="status-size">-- x --</span>
    <span id="status-zoom">Zoom: 100%</span>
    <span id="status-sync">Sync: ON</span>
    <span id="status-result">Ready</span>
    <div id="preview-modal" class="modal hidden">
      <div class="modal-overlay" id="preview-overlay"></div>
      <div class="preview-content">
        <div class="preview-header">
          <span id="preview-filename" class="preview-filename"></span>
          <button id="preview-close" class="btn btn-icon preview-close-btn">&times;</button>
        </div>
        <div class="preview-body">
          <img id="preview-image" class="preview-image" alt="" />
        </div>
      </div>
    </div>
    <div id="toast" class="toast hidden"></div>
    <div class="preset-buttons">
      <button class="btn btn-preset" data-preset="0">SE</button>
      <button class="btn btn-preset" data-preset="1">14P</button>
      <button class="btn btn-preset" data-preset="2">iPad</button>
      <button class="btn btn-preset" data-preset="3">DT</button>
      <button class="btn btn-preset" data-preset="4">FHD</button>
    </div>
  `;
}

function mockElectronAPI() {
  const api = {
    navigate: jest.fn().mockResolvedValue(undefined),
    reloadViews: jest.fn().mockResolvedValue(undefined),
    captureAndCompare: jest.fn().mockResolvedValue(undefined),
    openReport: jest.fn().mockResolvedValue(undefined),
    setDevicePreset: jest.fn().mockResolvedValue(undefined),
    getSettings: jest.fn().mockResolvedValue({
      leftUrl: 'http://localhost:3000',
      rightUrl: 'http://localhost:3001',
      matchingThreshold: 0,
      thresholdRate: 0,
      snapshotDir: './snapshots',
    }),
    saveSettings: jest.fn().mockResolvedValue(undefined),
    setSyncEnabled: jest.fn().mockResolvedValue(undefined),
    getSyncEnabled: jest.fn().mockResolvedValue({ enabled: true }),
    setViewsVisible: jest.fn().mockResolvedValue(undefined),
    selectFolder: jest.fn().mockResolvedValue(null),
    readDirectory: jest.fn().mockResolvedValue([]),
    createDirectory: jest.fn().mockResolvedValue({ path: '/test/new' }),
    readFileData: jest.fn().mockResolvedValue({ dataUrl: 'data:image/png;base64,abc', mimeType: 'image/png', fileName: 'test.png' }),
    setSidebarWidth: jest.fn().mockResolvedValue(undefined),
    reinjectSync: jest.fn().mockResolvedValue({ success: true }),
    setZoom: jest.fn().mockResolvedValue({ zoom: 1.0 }),
    getZoom: jest.fn().mockResolvedValue({ zoom: 1.0 }),
    onZoomChanged: jest.fn(),
    onCaptureResult: jest.fn(),
    onShortcutCapture: jest.fn(),
    onShortcutOpenReport: jest.fn(),
    onShortcutPreset: jest.fn(),
    onShortcutSettings: jest.fn(),
    onShortcutZoomIn: jest.fn(),
    onShortcutZoomOut: jest.fn(),
    onShortcutZoomReset: jest.fn(),
  };
  (window as any).electronAPI = api;
  return api;
}

// Flush microtasks (let promises resolve)
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------- suite ----------
describe('ui-controls', () => {
  let api: any;

  beforeEach(() => {
    buildDOM();
    api = mockElectronAPI();
    (global as any).getPresetByIndex = _getPresetByIndex;
    // Load shared constants as globals (loaded via CommonJS shim in browser)
    const constants = require('../../src/shared/constants');
    (global as any).ZOOM_STEP = constants.ZOOM_STEP;
    (global as any).MIN_ZOOM = constants.MIN_ZOOM;
    (global as any).MAX_ZOOM = constants.MAX_ZOOM;
    (global as any).SIDEBAR_WIDTH = constants.SIDEBAR_WIDTH;
    jest.resetModules();
  });

  afterEach(() => {
    delete (global as any).getPresetByIndex;
    delete (global as any).ZOOM_STEP;
    delete (global as any).MIN_ZOOM;
    delete (global as any).MAX_ZOOM;
    delete (global as any).SIDEBAR_WIDTH;
    delete (window as any).electronAPI;
  });

  function init() {
    const { initUIControls } = require('../../src/renderer/scripts/ui-controls');
    initUIControls();
  }

  // ===== URL Input =====
  describe('URL input', () => {
    test('Enter key on left-url calls navigate with left target', async () => {
      init();
      await flush();
      const input = document.getElementById('left-url') as HTMLInputElement;
      input.value = 'http://example.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(api.navigate).toHaveBeenCalledWith({ url: 'http://example.com', target: 'left' });
    });

    test('Enter key on right-url calls navigate with right target', async () => {
      init();
      await flush();
      const input = document.getElementById('right-url') as HTMLInputElement;
      input.value = 'http://other.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(api.navigate).toHaveBeenCalledWith({ url: 'http://other.com', target: 'right' });
    });

    test('non-Enter key does not trigger navigate', async () => {
      init();
      await flush();
      const input = document.getElementById('left-url') as HTMLInputElement;
      input.value = 'http://example.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(api.navigate).not.toHaveBeenCalled();
    });

    test('Enter during IME composition does not trigger navigate', async () => {
      init();
      await flush();
      const input = document.getElementById('left-url') as HTMLInputElement;
      input.value = 'http://example.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
      expect(api.navigate).not.toHaveBeenCalled();
    });
  });

  // ===== Reload Buttons =====
  describe('Reload buttons', () => {
    test('reload-left button calls reloadViews with left', async () => {
      init();
      await flush();
      document.getElementById('reload-left')!.click();
      expect(api.reloadViews).toHaveBeenCalledWith({ target: 'left' });
    });

    test('reload-right button calls reloadViews with right', async () => {
      init();
      await flush();
      document.getElementById('reload-right')!.click();
      expect(api.reloadViews).toHaveBeenCalledWith({ target: 'right' });
    });

    test('reload-sync-btn reloads both views and re-injects sync', async () => {
      init();
      await flush();
      document.getElementById('reload-sync-btn')!.click();
      await flush();
      expect(api.reloadViews).toHaveBeenCalledWith({ target: 'both' });
      expect(api.reinjectSync).toHaveBeenCalled();
    });
  });

  // ===== Capture Button =====
  describe('Capture button', () => {
    test('capture-btn calls captureAndCompare with pageName "page"', async () => {
      init();
      await flush();
      document.getElementById('capture-btn')!.click();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'page' });
    });
  });

  // ===== onCaptureResult =====
  describe('onCaptureResult', () => {
    function triggerCaptureResult(data: any) {
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb(data);
    }

    test('success with no differences updates status and shows success toast', async () => {
      init();
      await flush();
      triggerCaptureResult({
        summary: { passed: 1, failed: 0, new: 0, deleted: 0 },
        reportPath: '/tmp/report/index.html',
      });
      const statusResult = document.getElementById('status-result')!;
      expect(statusResult.innerHTML).toContain('Passed: 1');
      expect(statusResult.innerHTML).toContain('Failed: 0');
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toBe('Captured! No differences found');
      expect(toast.className).toContain('toast-success');
    });

    test('success with differences shows error toast', async () => {
      init();
      await flush();
      triggerCaptureResult({
        summary: { passed: 0, failed: 2, new: 0, deleted: 0 },
        reportPath: '/tmp/report/index.html',
      });
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toBe('Captured! 2 difference(s) found');
      expect(toast.className).toContain('toast-error');
    });

    test('error updates status and shows error toast', async () => {
      init();
      await flush();
      triggerCaptureResult({ error: 'Something broke' });
      const statusResult = document.getElementById('status-result')!;
      expect(statusResult.textContent).toBe('Error: Something broke');
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toContain('Capture failed');
      expect(toast.className).toContain('toast-error');
    });
  });

  // ===== New Report Modal =====
  describe('New Report modal', () => {
    test('clicking New opens modal, hides BrowserViews, and clears inputs', async () => {
      init();
      await flush();
      const modal = document.getElementById('new-report-modal')!;
      expect(modal.classList.contains('hidden')).toBe(true);
      document.getElementById('new-report-btn')!.click();
      expect(modal.classList.contains('hidden')).toBe(false);
      expect((document.getElementById('report-test-name') as HTMLInputElement).value).toBe('');
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
    });

    test('empty test name does not trigger capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      (document.getElementById('report-test-name') as HTMLInputElement).value = '  ';
      document.getElementById('new-report-capture')!.click();
      await flush();
      expect(api.captureAndCompare).not.toHaveBeenCalled();
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(false);
    });

    test('valid test name triggers capture without folder (no sidebar)', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      api.setViewsVisible.mockClear();
      (document.getElementById('report-test-name') as HTMLInputElement).value = 'login-page';
      document.getElementById('new-report-capture')!.click();
      await flush();
      expect(api.createDirectory).not.toHaveBeenCalled();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'login-page' });
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('valid test name with open folder creates subfolder and captures', async () => {
      api.selectFolder.mockResolvedValue('/vrt-tests');
      api.readDirectory.mockResolvedValue([]);
      init();
      await flush();
      // Open a folder first
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      // Now click New
      document.getElementById('new-report-btn')!.click();
      expect(document.getElementById('new-report-folder-info')!.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('new-report-folder-path')!.textContent).toBe('/vrt-tests/');
      (document.getElementById('report-test-name') as HTMLInputElement).value = 'login-page';
      document.getElementById('new-report-capture')!.click();
      await flush();
      expect(api.createDirectory).toHaveBeenCalledWith({ dirPath: '/vrt-tests/login-page' });
      expect(api.saveSettings).toHaveBeenCalledWith({ settings: { snapshotDir: '/vrt-tests/login-page' } });
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'login-page' });
    });

    test('folder info is hidden when no folder is open', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      expect(document.getElementById('new-report-folder-info')!.classList.contains('hidden')).toBe(true);
    });

    test('cancel closes modal and restores BrowserViews', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      api.setViewsVisible.mockClear();
      document.getElementById('new-report-cancel')!.click();
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('Enter key in test name input triggers capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      const nameInput = document.getElementById('report-test-name') as HTMLInputElement;
      nameInput.value = 'my-test';
      nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'my-test' });
    });

    test('Enter during IME composition does not trigger capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      const nameInput = document.getElementById('report-test-name') as HTMLInputElement;
      nameInput.value = 'テスト';
      nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
      await flush();
      expect(api.captureAndCompare).not.toHaveBeenCalled();
    });
  });

  // ===== Sync Toggle =====
  describe('Sync toggle', () => {
    test('initial state has sync-on class', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync')!;
      expect(btn.classList.contains('sync-on')).toBe(true);
    });

    test('clicking toggle switches to sync-off', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync')!;
      btn.click();
      expect(btn.classList.contains('sync-off')).toBe(true);
      expect(btn.classList.contains('sync-on')).toBe(false);
      expect(btn.textContent).toContain('Sync OFF');
      expect(document.getElementById('status-sync')!.textContent).toBe('Sync: OFF');
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: false });
    });

    test('clicking toggle twice restores sync-on', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync')!;
      btn.click();
      btn.click();
      expect(btn.classList.contains('sync-on')).toBe(true);
      expect(btn.textContent).toContain('Sync ON');
      expect(document.getElementById('status-sync')!.textContent).toBe('Sync: ON');
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: true });
    });
  });

  // ===== Device Presets =====
  describe('Device presets', () => {
    test('clicking a preset calls setDevicePreset with correct size', async () => {
      init();
      await flush();
      const btn = document.querySelector('.btn-preset[data-preset="0"]') as HTMLElement;
      btn.click();
      const preset = _PRESET_LIST[0];
      expect(api.setDevicePreset).toHaveBeenCalledWith({ width: preset.width, height: preset.height });
    });

    test('clicking a preset updates status-size', async () => {
      init();
      await flush();
      (document.querySelector('.btn-preset[data-preset="3"]') as HTMLElement).click();
      const preset = _PRESET_LIST[3];
      expect(document.getElementById('status-size')!.textContent).toBe(`${preset.width} x ${preset.height}`);
    });

    test('active class is set on clicked preset and removed from others', async () => {
      init();
      await flush();
      (document.querySelector('.btn-preset[data-preset="1"]') as HTMLElement).click();
      expect(document.querySelector('.btn-preset[data-preset="1"]')!.classList.contains('active')).toBe(true);
      expect(document.querySelector('.btn-preset[data-preset="0"]')!.classList.contains('active')).toBe(false);

      (document.querySelector('.btn-preset[data-preset="2"]') as HTMLElement).click();
      expect(document.querySelector('.btn-preset[data-preset="2"]')!.classList.contains('active')).toBe(true);
      expect(document.querySelector('.btn-preset[data-preset="1"]')!.classList.contains('active')).toBe(false);
    });
  });

  // ===== Zoom Controls =====
  describe('Zoom controls', () => {
    test('zoom in button calls setZoom with increased value', async () => {
      init();
      await flush();
      document.getElementById('zoom-in-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: expect.closeTo(1.1, 1) });
    });

    test('zoom out button calls setZoom with decreased value', async () => {
      init();
      await flush();
      document.getElementById('zoom-out-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: expect.closeTo(0.9, 1) });
    });

    test('zoom level button resets zoom to 100%', async () => {
      init();
      await flush();
      document.getElementById('zoom-level-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 1.0 });
    });

    test('onZoomChanged updates zoom display and status bar', async () => {
      init();
      await flush();
      const cb = api.onZoomChanged.mock.calls[0][0];
      cb({ zoom: 1.5 });
      expect(document.getElementById('zoom-level-btn')!.textContent).toBe('150%');
      expect(document.getElementById('status-zoom')!.textContent).toBe('Zoom: 150%');
    });

    test('initial zoom is loaded from getZoom', async () => {
      api.getZoom.mockResolvedValue({ zoom: 0.75 });
      init();
      await flush();
      expect(document.getElementById('zoom-level-btn')!.textContent).toBe('75%');
      expect(document.getElementById('status-zoom')!.textContent).toBe('Zoom: 75%');
    });

    test('zoom in does not exceed max zoom (3.0)', async () => {
      api.getZoom.mockResolvedValue({ zoom: 3.0 });
      init();
      await flush();
      document.getElementById('zoom-in-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 3.0 });
    });

    test('zoom out does not go below min zoom (0.25)', async () => {
      api.getZoom.mockResolvedValue({ zoom: 0.25 });
      init();
      await flush();
      document.getElementById('zoom-out-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 0.25 });
    });

    test('onShortcutZoomIn triggers zoom in', async () => {
      init();
      await flush();
      const cb = api.onShortcutZoomIn.mock.calls[0][0];
      cb();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: expect.closeTo(1.1, 1) });
    });

    test('onShortcutZoomOut triggers zoom out', async () => {
      init();
      await flush();
      const cb = api.onShortcutZoomOut.mock.calls[0][0];
      cb();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: expect.closeTo(0.9, 1) });
    });

    test('onShortcutZoomReset resets zoom to 100%', async () => {
      init();
      await flush();
      const cb = api.onShortcutZoomReset.mock.calls[0][0];
      cb();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 1.0 });
    });
  });

  // ===== Settings Modal =====
  describe('Settings modal', () => {
    test('clicking settings button opens modal, hides BrowserViews, and loads settings', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
      await flush();
      expect(api.getSettings).toHaveBeenCalled();
    });

    test('saving settings closes modal and restores BrowserViews', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      await flush();
      api.setViewsVisible.mockClear();
      (document.getElementById('setting-matching-threshold') as HTMLInputElement).value = '0.5';
      (document.getElementById('setting-threshold-rate') as HTMLInputElement).value = '0.1';
      (document.getElementById('setting-snapshot-dir') as HTMLInputElement).value = './my-snaps';
      document.getElementById('settings-save')!.click();
      expect(api.saveSettings).toHaveBeenCalledWith({
        settings: {
          matchingThreshold: 0.5,
          thresholdRate: 0.1,
          snapshotDir: './my-snaps',
        },
      });
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('cancel closes settings modal, restores BrowserViews, without saving', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      await flush();
      api.setViewsVisible.mockClear();
      document.getElementById('settings-cancel')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
      expect(api.saveSettings).not.toHaveBeenCalled();
    });
  });

  // ===== Keyboard Shortcuts =====
  describe('Keyboard shortcuts', () => {
    test('onShortcutCapture triggers capture', async () => {
      init();
      await flush();
      const cb = api.onShortcutCapture.mock.calls[0][0];
      cb();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'page' });
    });

    test('onShortcutOpenReport calls openReport when report exists', async () => {
      init();
      await flush();
      const captureResultCb = api.onCaptureResult.mock.calls[0][0];
      captureResultCb({
        summary: { passed: 1, failed: 0, new: 0, deleted: 0 },
        reportPath: '/tmp/report.html',
      });
      const cb = api.onShortcutOpenReport.mock.calls[0][0];
      cb();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/tmp/report.html' });
    });

    test('onShortcutOpenReport does nothing when no report', async () => {
      init();
      await flush();
      const cb = api.onShortcutOpenReport.mock.calls[0][0];
      cb();
      expect(api.openReport).not.toHaveBeenCalled();
    });

    test('onShortcutPreset applies the given preset', async () => {
      init();
      await flush();
      const cb = api.onShortcutPreset.mock.calls[0][0];
      cb({ index: 2 });
      const preset = _PRESET_LIST[2];
      expect(api.setDevicePreset).toHaveBeenCalledWith({ width: preset.width, height: preset.height });
    });

    test('onShortcutSettings opens settings modal', async () => {
      init();
      await flush();
      const cb = api.onShortcutSettings.mock.calls[0][0];
      cb();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
    });
  });

  // ===== Sidebar =====
  describe('Sidebar', () => {
    const mixedEntries = [
      { name: 'beta.txt', isDirectory: false, path: '/test/beta.txt' },
      { name: 'alpha', isDirectory: true, path: '/test/alpha' },
      { name: 'gamma.js', isDirectory: false, path: '/test/gamma.js' },
      { name: 'delta', isDirectory: true, path: '/test/delta' },
    ];

    function getTreeNames() {
      return Array.from(document.getElementById('sidebar-tree')!.querySelectorAll('.tree-item > .tree-name'))
        .map((el) => el.textContent);
    }

    async function openFolderWithEntries(entries?: any[]) {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue(entries || mixedEntries);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
    }

    // --- Toggle ---
    test('clicking toggle-sidebar opens sidebar and sets width', async () => {
      init();
      await flush();
      const sidebar = document.getElementById('sidebar')!;
      expect(sidebar.classList.contains('collapsed')).toBe(true);
      document.getElementById('toggle-sidebar')!.click();
      expect(sidebar.classList.contains('collapsed')).toBe(false);
      expect(document.body.classList.contains('sidebar-open')).toBe(true);
      expect(api.setSidebarWidth).toHaveBeenCalledWith({ width: 250 });
    });

    test('clicking toggle-sidebar twice closes sidebar', async () => {
      init();
      await flush();
      document.getElementById('toggle-sidebar')!.click();
      document.getElementById('toggle-sidebar')!.click();
      expect(document.getElementById('sidebar')!.classList.contains('collapsed')).toBe(true);
      expect(document.body.classList.contains('sidebar-open')).toBe(false);
      expect(api.setSidebarWidth).toHaveBeenLastCalledWith({ width: 0 });
    });

    // --- Folder selection ---
    test('selecting a folder renders tree entries', async () => {
      await openFolderWithEntries([
        { name: 'subdir', isDirectory: true, path: '/test/subdir' },
        { name: 'file.txt', isDirectory: false, path: '/test/file.txt' },
      ]);
      const items = document.getElementById('sidebar-tree')!.querySelectorAll('.tree-item');
      expect(items.length).toBe(2);
    });

    test('selecting null folder does not render tree', async () => {
      api.selectFolder.mockResolvedValue(null);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      expect(document.getElementById('sidebar-tree')!.children.length).toBe(0);
    });

    // --- Expand / Collapse ---
    test('clicking a directory expands children', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockResolvedValueOnce([
        { name: 'child.txt', isDirectory: false, path: '/test/sub/child.txt' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      (document.getElementById('sidebar-tree')!.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      const children = document.getElementById('sidebar-tree')!.querySelector('.tree-children')!;
      expect(children.classList.contains('expanded')).toBe(true);
      expect(children.querySelector('.tree-name')!.textContent).toBe('child.txt');
    });

    test('clicking an expanded directory collapses it', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockResolvedValueOnce([
        { name: 'child.txt', isDirectory: false, path: '/test/sub/child.txt' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree')!.querySelector('.tree-item') as HTMLElement;
      dirItem.click();
      await flush();
      dirItem.click();
      await flush();
      expect(document.getElementById('sidebar-tree')!.querySelector('.tree-children')!.classList.contains('expanded')).toBe(false);
    });

    test('readDirectory error is handled gracefully', async () => {
      api.selectFolder.mockResolvedValue('/nonexistent');
      api.readDirectory.mockRejectedValue(new Error('ENOENT'));
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      expect(document.getElementById('sidebar-tree')!.children.length).toBe(0);
    });

    test('child directory readDirectory error is handled gracefully', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockRejectedValueOnce(new Error('EPERM'));
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      (document.getElementById('sidebar-tree')!.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      const children = document.getElementById('sidebar-tree')!.querySelector('.tree-children')!;
      expect(children.classList.contains('expanded')).toBe(true);
      expect(children.querySelectorAll('.tree-item').length).toBe(0);
    });

    // --- Sort select ---
    test('sort select name-asc sorts alphabetically', async () => {
      await openFolderWithEntries();
      (document.getElementById('sidebar-sort') as HTMLSelectElement).value = 'name-asc';
      document.getElementById('sidebar-sort')!.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames()).toEqual(['alpha', 'beta.txt', 'delta', 'gamma.js']);
    });

    test('sort select name-desc sorts reverse alphabetically', async () => {
      await openFolderWithEntries();
      (document.getElementById('sidebar-sort') as HTMLSelectElement).value = 'name-desc';
      document.getElementById('sidebar-sort')!.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames()).toEqual(['gamma.js', 'delta', 'beta.txt', 'alpha']);
    });

    test('sort select type groups directories first', async () => {
      await openFolderWithEntries();
      (document.getElementById('sidebar-sort') as HTMLSelectElement).value = 'type';
      document.getElementById('sidebar-sort')!.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = getTreeNames();
      expect(names).toEqual(['alpha', 'delta', 'beta.txt', 'gamma.js']);
    });

    test('sort change without folder does nothing', async () => {
      init();
      await flush();
      (document.getElementById('sidebar-sort') as HTMLSelectElement).value = 'name-desc';
      document.getElementById('sidebar-sort')!.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree')!.children.length).toBe(0);
    });

    // --- Filter radio buttons ---
    test('filter radio "directories" shows only directories', async () => {
      await openFolderWithEntries();
      const radio = document.querySelector('input[name="sidebar-filter"][value="directories"]') as HTMLInputElement;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = getTreeNames();
      expect(names.every((n) => !n!.includes('.'))).toBe(true);
      expect(names.length).toBe(2);
    });

    test('filter radio "files" shows only files', async () => {
      await openFolderWithEntries();
      const radio = document.querySelector('input[name="sidebar-filter"][value="files"]') as HTMLInputElement;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = getTreeNames();
      expect(names.every((n) => n!.includes('.'))).toBe(true);
      expect(names.length).toBe(2);
    });

    test('filter radio "all" shows everything', async () => {
      await openFolderWithEntries();
      // Switch to files first
      const filesRadio = document.querySelector('input[name="sidebar-filter"][value="files"]') as HTMLInputElement;
      filesRadio.checked = true;
      filesRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      // Then switch back to all
      const allRadio = document.querySelector('input[name="sidebar-filter"][value="all"]') as HTMLInputElement;
      allRadio.checked = true;
      allRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames().length).toBe(4);
    });

    test('filter change without folder does nothing', async () => {
      init();
      await flush();
      const radio = document.querySelector('input[name="sidebar-filter"][value="files"]') as HTMLInputElement;
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree')!.children.length).toBe(0);
    });

    test('sort and filter combine correctly', async () => {
      await openFolderWithEntries();
      // Filter to directories only
      const dirsRadio = document.querySelector('input[name="sidebar-filter"][value="directories"]') as HTMLInputElement;
      dirsRadio.checked = true;
      dirsRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      // Sort descending
      (document.getElementById('sidebar-sort') as HTMLSelectElement).value = 'name-desc';
      document.getElementById('sidebar-sort')!.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames()).toEqual(['delta', 'alpha']);
    });

    // --- Keyboard navigation ---
    test('Enter key expands a directory', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockResolvedValueOnce([
        { name: 'child.txt', isDirectory: false, path: '/test/sub/child.txt' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree')!.querySelector('.tree-item')!;
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree')!.querySelector('.tree-children')!.classList.contains('expanded')).toBe(true);
    });

    test('Space key expands a directory', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockResolvedValueOnce([
        { name: 'inner.js', isDirectory: false, path: '/test/sub/inner.js' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree')!.querySelector('.tree-item')!;
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree')!.querySelector('.tree-children')!.classList.contains('expanded')).toBe(true);
    });

    test('Enter key collapses an expanded directory', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockResolvedValueOnce([
        { name: 'child.txt', isDirectory: false, path: '/test/sub/child.txt' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree')!.querySelector('.tree-item') as HTMLElement;
      dirItem.click();
      await flush();
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree')!.querySelector('.tree-children')!.classList.contains('expanded')).toBe(false);
    });

    test('non-Enter/Space key does not toggle directory', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree')!.querySelector('.tree-item')!;
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree')!.querySelector('.tree-children')!.classList.contains('expanded')).toBe(false);
    });

    // --- Accessibility ---
    test('tree items have tabindex and role attributes', async () => {
      await openFolderWithEntries([
        { name: 'dir', isDirectory: true, path: '/test/dir' },
        { name: 'file.txt', isDirectory: false, path: '/test/file.txt' },
      ]);
      const items = document.getElementById('sidebar-tree')!.querySelectorAll('.tree-item');
      items.forEach((item) => {
        expect(item.getAttribute('tabindex')).toBe('0');
      });
      expect(items[0].getAttribute('role')).toBe('treeitem');
      expect(items[1].getAttribute('role')).toBe('none');
    });

    // --- Output directory selection ---
    test('sidebar shows output directory from settings on init', async () => {
      api.getSettings.mockResolvedValue({
        leftUrl: 'http://localhost:3000',
        rightUrl: 'http://localhost:3001',
        matchingThreshold: 0,
        thresholdRate: 0,
        snapshotDir: '/home/user/snapshots',
      });
      api.readDirectory.mockResolvedValue([]);
      init();
      await flush();
      const outputDisplay = document.getElementById('sidebar-output-dir')!;
      expect(outputDisplay.textContent).toBe('snapshots');
      expect(outputDisplay.title).toBe('/home/user/snapshots');
    });

    test('relative snapshotDir does not auto-load tree', async () => {
      api.getSettings.mockResolvedValue({
        leftUrl: 'http://localhost:3000',
        rightUrl: 'http://localhost:3001',
        matchingThreshold: 0,
        thresholdRate: 0,
        snapshotDir: './snapshots',
      });
      init();
      await flush();
      expect(api.readDirectory).not.toHaveBeenCalled();
    });

    test('absolute snapshotDir auto-loads parent folder tree on init', async () => {
      api.getSettings.mockResolvedValue({
        leftUrl: 'http://localhost:3000',
        rightUrl: 'http://localhost:3001',
        matchingThreshold: 0,
        thresholdRate: 0,
        snapshotDir: '/home/user/snapshots',
      });
      api.readDirectory.mockResolvedValue([
        { name: 'snapshots', isDirectory: true, path: '/home/user/snapshots' },
      ]);
      init();
      await flush();
      expect(api.readDirectory).toHaveBeenCalledWith({ dirPath: '/home/user' });
    });

    test('clicking pin button on directory sets it as snapshotDir', async () => {
      await openFolderWithEntries([
        { name: 'output', isDirectory: true, path: '/test/output' },
      ]);
      const pinBtn = document.querySelector('.tree-pin-btn') as HTMLElement;
      expect(pinBtn).not.toBeNull();
      pinBtn.click();
      await flush();
      expect(api.saveSettings).toHaveBeenCalledWith({
        settings: { snapshotDir: '/test/output' },
      });
    });

    test('pin button click does not expand/collapse directory', async () => {
      await openFolderWithEntries([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]);
      const pinBtn = document.querySelector('.tree-pin-btn') as HTMLElement;
      pinBtn.click();
      await flush();
      const children = document.querySelector('.tree-children')!;
      expect(children.classList.contains('expanded')).toBe(false);
    });

    test('active output directory has tree-item-active-output class after pin', async () => {
      await openFolderWithEntries([
        { name: 'output', isDirectory: true, path: '/test/output' },
        { name: 'other', isDirectory: true, path: '/test/other' },
      ]);
      // Click pin on first directory to set it as output
      const pinBtn = document.querySelector('.tree-pin-btn') as HTMLElement;
      pinBtn.click();
      await flush();
      // After pin click, tree re-renders with active class
      const items = document.getElementById('sidebar-tree')!.querySelectorAll('.tree-item');
      expect(items[0].classList.contains('tree-item-active-output')).toBe(true);
      expect(items[1].classList.contains('tree-item-active-output')).toBe(false);
    });

    test('file entries do not have pin button', async () => {
      await openFolderWithEntries([
        { name: 'file.txt', isDirectory: false, path: '/test/file.txt' },
      ]);
      const pinBtns = document.querySelectorAll('.tree-pin-btn');
      expect(pinBtns.length).toBe(0);
    });

    test('output dir display updates when pin button is clicked', async () => {
      await openFolderWithEntries([
        { name: 'my-output', isDirectory: true, path: '/test/my-output' },
      ]);
      const pinBtn = document.querySelector('.tree-pin-btn') as HTMLElement;
      pinBtn.click();
      await flush();
      const outputDisplay = document.getElementById('sidebar-output-dir')!;
      expect(outputDisplay.textContent).toBe('my-output');
      expect(outputDisplay.title).toBe('/test/my-output');
    });

    // --- New Folder ---
    test('new folder button does nothing without open folder', async () => {
      init();
      await flush();
      document.getElementById('sidebar-new-folder')!.click();
      expect(document.getElementById('sidebar-new-folder-form')!.classList.contains('hidden')).toBe(true);
    });

    test('new folder button shows form when folder is open', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      const form = document.getElementById('sidebar-new-folder-form')!;
      expect(form.classList.contains('hidden')).toBe(false);
    });

    test('new folder cancel hides form', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      document.getElementById('sidebar-new-folder-cancel')!.click();
      expect(document.getElementById('sidebar-new-folder-form')!.classList.contains('hidden')).toBe(true);
    });

    test('new folder OK creates directory and sets as output', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      (document.getElementById('sidebar-new-folder-name') as HTMLInputElement).value = 'vrt-test';
      document.getElementById('sidebar-new-folder-ok')!.click();
      await flush();
      expect(api.createDirectory).toHaveBeenCalledWith({ dirPath: '/test/vrt-test' });
      expect(api.saveSettings).toHaveBeenCalledWith({
        settings: { snapshotDir: '/test/vrt-test' },
      });
    });

    test('new folder OK with empty name does nothing', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      (document.getElementById('sidebar-new-folder-name') as HTMLInputElement).value = '   ';
      document.getElementById('sidebar-new-folder-ok')!.click();
      await flush();
      expect(api.createDirectory).not.toHaveBeenCalled();
    });

    test('Enter key in new folder input creates folder', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      const input = document.getElementById('sidebar-new-folder-name') as HTMLInputElement;
      input.value = 'my-test';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(api.createDirectory).toHaveBeenCalledWith({ dirPath: '/test/my-test' });
    });

    test('Escape key in new folder input hides form', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      const input = document.getElementById('sidebar-new-folder-name')!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.getElementById('sidebar-new-folder-form')!.classList.contains('hidden')).toBe(true);
    });

    test('new folder creation error shows error toast', async () => {
      api.createDirectory.mockRejectedValue(new Error('EACCES'));
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      (document.getElementById('sidebar-new-folder-name') as HTMLInputElement).value = 'bad-folder';
      document.getElementById('sidebar-new-folder-ok')!.click();
      await flush();
      const toast = document.getElementById('toast')!;
      expect(toast.className).toContain('toast-error');
    });

    test('new folder hides form after successful creation', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-new-folder')!.click();
      (document.getElementById('sidebar-new-folder-name') as HTMLInputElement).value = 'new-dir';
      document.getElementById('sidebar-new-folder-ok')!.click();
      await flush();
      expect(document.getElementById('sidebar-new-folder-form')!.classList.contains('hidden')).toBe(true);
    });

    // --- File Preview ---
    test('clicking an image file opens preview modal immediately and loads data', async () => {
      await openFolderWithEntries([
        { name: 'screenshot.png', isDirectory: false, path: '/test/screenshot.png' },
      ]);
      const fileItem = document.querySelector('.tree-item') as HTMLElement;
      api.setViewsVisible.mockClear();
      fileItem.click();
      // Modal and view hiding happen immediately (before async load)
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
      await flush();
      // After data loads, image is set
      expect(api.readFileData).toHaveBeenCalledWith({ filePath: '/test/screenshot.png' });
      expect((document.getElementById('preview-image') as HTMLImageElement).src).toContain('data:image/png');
      expect(document.getElementById('preview-filename')!.textContent).toBe('test.png');
    });

    test('clicking HTML file opens report via openReport', async () => {
      await openFolderWithEntries([
        { name: 'report.html', isDirectory: false, path: '/test/report.html' },
      ]);
      (document.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/test/report.html' });
      expect(api.readFileData).not.toHaveBeenCalled();
    });

    test('closing preview modal hides it and restores views', async () => {
      await openFolderWithEntries([
        { name: 'img.jpg', isDirectory: false, path: '/test/img.jpg' },
      ]);
      (document.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      api.setViewsVisible.mockClear();
      document.getElementById('preview-close')!.click();
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('clicking overlay closes preview modal', async () => {
      await openFolderWithEntries([
        { name: 'img.png', isDirectory: false, path: '/test/img.png' },
      ]);
      (document.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      api.setViewsVisible.mockClear();
      document.getElementById('preview-overlay')!.click();
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('Escape key closes preview modal', async () => {
      await openFolderWithEntries([
        { name: 'img.webp', isDirectory: false, path: '/test/img.webp' },
      ]);
      (document.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      api.setViewsVisible.mockClear();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('non-previewable files do not trigger preview and have inert class', async () => {
      await openFolderWithEntries([
        { name: 'data.json', isDirectory: false, path: '/test/data.json' },
      ]);
      const item = document.querySelector('.tree-item') as HTMLElement;
      expect(item.classList.contains('tree-item-inert')).toBe(true);
      item.click();
      await flush();
      expect(api.readFileData).not.toHaveBeenCalled();
      expect(api.openReport).not.toHaveBeenCalled();
    });

    test('previewable files have tree-item-previewable class', async () => {
      // sorted name-asc: data.txt, img.png, report.html
      await openFolderWithEntries([
        { name: 'img.png', isDirectory: false, path: '/test/img.png' },
        { name: 'report.html', isDirectory: false, path: '/test/report.html' },
        { name: 'data.txt', isDirectory: false, path: '/test/data.txt' },
      ]);
      const items = document.querySelectorAll('.tree-item');
      // data.txt - inert
      expect(items[0].classList.contains('tree-item-inert')).toBe(true);
      // img.png - previewable
      expect(items[1].classList.contains('tree-item-previewable')).toBe(true);
      // report.html - previewable
      expect(items[2].classList.contains('tree-item-previewable')).toBe(true);
    });

    test('Enter key on image file opens preview', async () => {
      await openFolderWithEntries([
        { name: 'img.gif', isDirectory: false, path: '/test/img.gif' },
      ]);
      const item = document.querySelector('.tree-item')!;
      item.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(api.readFileData).toHaveBeenCalledWith({ filePath: '/test/img.gif' });
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
    });

    test('tree preserves expanded state after capture result', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory
        .mockResolvedValueOnce([
          { name: 'sub', isDirectory: true, path: '/test/sub' },
        ])
        .mockResolvedValueOnce([
          { name: 'child.png', isDirectory: false, path: '/test/sub/child.png' },
        ])
        // After capture triggers loadAndRenderTree -> root re-read
        .mockResolvedValueOnce([
          { name: 'sub', isDirectory: true, path: '/test/sub' },
        ])
        // Auto-expand of 'sub' during rebuild
        .mockResolvedValueOnce([
          { name: 'child.png', isDirectory: false, path: '/test/sub/child.png' },
          { name: 'new.png', isDirectory: false, path: '/test/sub/new.png' },
        ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      // Expand 'sub'
      (document.getElementById('sidebar-tree')!.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      expect(document.querySelector('.tree-children')!.classList.contains('expanded')).toBe(true);
      // Trigger capture result
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({
        summary: { passed: 1, failed: 0, new: 1, deleted: 0 },
        reportPath: '/tmp/report.html',
      });
      await flush();
      // 'sub' should still be expanded with updated children
      expect(document.querySelector('.tree-children')!.classList.contains('expanded')).toBe(true);
      const childNames = Array.from(document.querySelectorAll('.tree-children .tree-name'))
        .map((el) => el.textContent);
      expect(childNames).toContain('new.png');
    });

    test('readFileData error closes preview and shows error toast', async () => {
      api.readFileData.mockRejectedValue(new Error('EACCES'));
      await openFolderWithEntries([
        { name: 'bad.png', isDirectory: false, path: '/test/bad.png' },
      ]);
      (document.querySelector('.tree-item') as HTMLElement).click();
      // Modal opens immediately before async load
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
      await flush();
      // After error, modal is closed
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(true);
      const toast = document.getElementById('toast')!;
      expect(toast.className).toContain('toast-error');
    });
  });

  // ===== Toast =====
  describe('showToast', () => {
    test('toast shows with correct class and removes after timeout', async () => {
      jest.useFakeTimers();
      init();
      // Manually resolve the getSettings promise
      await api.getSettings();
      jest.runAllTicks();

      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({
        summary: { passed: 1, failed: 0, new: 0, deleted: 0 },
        reportPath: '/tmp/r.html',
      });
      const toast = document.getElementById('toast')!;
      expect(toast.classList.contains('show')).toBe(true);
      expect(toast.className).toContain('toast-success');

      jest.advanceTimersByTime(2500);
      expect(toast.classList.contains('show')).toBe(false);
      jest.useRealTimers();
    });

    test('error toast has toast-error class', async () => {
      init();
      await flush();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ error: 'fail' });
      const toast = document.getElementById('toast')!;
      expect(toast.className).toContain('toast-error');
    });
  });

  // ===== Initial URL Loading =====
  describe('Initial URL loading', () => {
    test('loads default URLs from settings into inputs', async () => {
      api.getSettings.mockResolvedValue({
        leftUrl: 'http://my-left.com',
        rightUrl: 'http://my-right.com',
        matchingThreshold: 0,
        thresholdRate: 0,
        snapshotDir: './snapshots',
      });
      init();
      await flush();
      expect((document.getElementById('left-url') as HTMLInputElement).value).toBe('http://my-left.com');
      expect((document.getElementById('right-url') as HTMLInputElement).value).toBe('http://my-right.com');
    });

    test('uses fallback URLs when settings have no URL', async () => {
      api.getSettings.mockResolvedValue({
        matchingThreshold: 0,
        thresholdRate: 0,
        snapshotDir: './snapshots',
      });
      init();
      await flush();
      expect((document.getElementById('left-url') as HTMLInputElement).value).toBe('http://localhost:3000');
      expect((document.getElementById('right-url') as HTMLInputElement).value).toBe('http://localhost:3001');
    });
  });

  // ===== Report Button =====
  describe('Report button', () => {
    test('clicking report does nothing when no report path', async () => {
      init();
      await flush();
      document.getElementById('report-btn')!.click();
      expect(api.openReport).not.toHaveBeenCalled();
    });

    test('clicking report opens report when path exists', async () => {
      init();
      await flush();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({
        summary: { passed: 1, failed: 0, new: 0, deleted: 0 },
        reportPath: '/tmp/my-report/index.html',
      });
      document.getElementById('report-btn')!.click();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/tmp/my-report/index.html' });
    });
  });

  // ===== Capture Error Handling =====
  describe('Capture error handling', () => {
    test('captureAndCompare rejection updates status', async () => {
      api.captureAndCompare.mockRejectedValue(new Error('Network error'));
      init();
      await flush();
      document.getElementById('capture-btn')!.click();
      await flush();
      expect(document.getElementById('status-result')!.textContent).toBe('Error: Network error');
    });
  });

  // ===== Modal Interaction Combinations (組み合わせテスト) =====
  describe('Modal interaction combinations', () => {
    test('opening settings modal then closing restores views before opening new report modal', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
      document.getElementById('settings-cancel')!.click();
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
      api.setViewsVisible.mockClear();
      document.getElementById('new-report-btn')!.click();
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(false);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
    });

    test('settings save then open new report maintains correct view visibility', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      document.getElementById('settings-save')!.click();
      api.setViewsVisible.mockClear();
      document.getElementById('new-report-btn')!.click();
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(false);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
      document.getElementById('new-report-cancel')!.click();
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('preview modal + Escape key closes preview only', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'img.png', isDirectory: false, path: '/test/img.png' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      (document.querySelector('.tree-item') as HTMLElement).click();
      await flush();
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(true);
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(true);
    });

    test('new report modal + sidebar open maintains view state correctly', async () => {
      init();
      await flush();
      document.getElementById('toggle-sidebar')!.click();
      expect(document.body.classList.contains('sidebar-open')).toBe(true);
      document.getElementById('new-report-btn')!.click();
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
      api.setViewsVisible.mockClear();
      document.getElementById('new-report-cancel')!.click();
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
      expect(document.body.classList.contains('sidebar-open')).toBe(true);
    });

    test('capture during new report modal flow closes modal and performs capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      (document.getElementById('report-test-name') as HTMLInputElement).value = 'my-test';
      document.getElementById('new-report-capture')!.click();
      await flush();
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(true);
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'my-test' });
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('settings modal loads and displays current settings values', async () => {
      api.getSettings.mockResolvedValue({
        leftUrl: 'http://test.com',
        rightUrl: 'http://test2.com',
        matchingThreshold: 0.3,
        thresholdRate: 0.2,
        snapshotDir: '/custom/path',
      });
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      await flush();
      expect((document.getElementById('setting-matching-threshold') as HTMLInputElement).value).toBe('0.3');
      expect((document.getElementById('setting-threshold-rate') as HTMLInputElement).value).toBe('0.2');
      expect((document.getElementById('setting-snapshot-dir') as HTMLInputElement).value).toBe('/custom/path');
    });

    test('rapid open/close of settings modal maintains consistent state', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
      document.getElementById('settings-cancel')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(true);
      document.getElementById('settings-btn')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
      document.getElementById('settings-cancel')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(true);
    });

    test('capture result updates sidebar tree when folder is open', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'file.png', isDirectory: false, path: '/test/file.png' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      expect(document.querySelectorAll('.tree-item').length).toBe(1);
      api.readDirectory.mockResolvedValue([
        { name: 'file.png', isDirectory: false, path: '/test/file.png' },
        { name: 'new.png', isDirectory: false, path: '/test/new.png' },
      ]);
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ summary: { passed: 1, failed: 0, new: 1, deleted: 0 }, reportPath: '/tmp/report.html' });
      await flush();
      expect(document.querySelectorAll('.tree-item').length).toBe(2);
    });

    test('shortcut-settings opens settings even after other shortcuts', async () => {
      init();
      await flush();
      const captureCb = api.onShortcutCapture.mock.calls[0][0];
      captureCb();
      expect(api.captureAndCompare).toHaveBeenCalled();
      const settingsCb = api.onShortcutSettings.mock.calls[0][0];
      settingsCb();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
    });
  });

  // ===== State Transition Tests =====
  describe('State transitions', () => {
    test('sidebar toggle updates width correctly across multiple toggles', async () => {
      init();
      await flush();
      document.getElementById('toggle-sidebar')!.click();
      expect(api.setSidebarWidth).toHaveBeenCalledWith({ width: 250 });
      document.getElementById('toggle-sidebar')!.click();
      expect(api.setSidebarWidth).toHaveBeenCalledWith({ width: 0 });
      document.getElementById('toggle-sidebar')!.click();
      expect(api.setSidebarWidth).toHaveBeenLastCalledWith({ width: 250 });
    });

    test('sync toggle cycles through ON/OFF/ON correctly', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync')!;
      expect(btn.classList.contains('sync-on')).toBe(true);
      btn.click();
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: false });
      btn.click();
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: true });
      btn.click();
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: false });
    });

    test('zoom changes persist across preset changes', async () => {
      init();
      await flush();
      document.getElementById('zoom-in-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: expect.closeTo(1.1, 1) });
      (document.querySelector('.btn-preset[data-preset="0"]') as HTMLElement).click();
      const preset = _PRESET_LIST[0];
      expect(api.setDevicePreset).toHaveBeenCalledWith({ width: preset.width, height: preset.height });
      document.getElementById('zoom-in-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledTimes(2);
    });

    test('multiple preset clicks only keep the last one active', async () => {
      init();
      await flush();
      for (let i = 0; i < 5; i++) {
        (document.querySelector(`.btn-preset[data-preset="${i}"]`) as HTMLElement).click();
      }
      const presetBtns = document.querySelectorAll('.btn-preset');
      presetBtns.forEach((btn, idx) => {
        if (idx === 4) {
          expect(btn.classList.contains('active')).toBe(true);
        } else {
          expect(btn.classList.contains('active')).toBe(false);
        }
      });
    });

    test('capture result with report path enables report button', async () => {
      init();
      await flush();
      document.getElementById('report-btn')!.click();
      expect(api.openReport).not.toHaveBeenCalled();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ summary: { passed: 1, failed: 0, new: 0, deleted: 0 }, reportPath: '/path/report.html' });
      document.getElementById('report-btn')!.click();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/path/report.html' });
    });

    test('capture error result does not set report path', async () => {
      init();
      await flush();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ error: 'Capture failed' });
      document.getElementById('report-btn')!.click();
      expect(api.openReport).not.toHaveBeenCalled();
    });

    test('multiple capture results update report path to latest', async () => {
      init();
      await flush();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ summary: { passed: 1, failed: 0, new: 0, deleted: 0 }, reportPath: '/first/report.html' });
      cb({ summary: { passed: 1, failed: 0, new: 0, deleted: 0 }, reportPath: '/second/report.html' });
      document.getElementById('report-btn')!.click();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/second/report.html' });
    });
  });

  // ===== Zoom Edge Cases =====
  describe('Zoom edge cases', () => {
    test('zoom near max does not exceed 3.0', async () => {
      api.getZoom.mockResolvedValue({ zoom: 2.9 });
      init();
      await flush();
      document.getElementById('zoom-in-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 3.0 });
    });

    test('zoom near min does not go below 0.25', async () => {
      api.getZoom.mockResolvedValue({ zoom: 0.35 });
      init();
      await flush();
      document.getElementById('zoom-out-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: expect.closeTo(0.25, 1) });
    });

    test('zoom reset always returns to 1.0', async () => {
      api.getZoom.mockResolvedValue({ zoom: 2.5 });
      init();
      await flush();
      document.getElementById('zoom-level-btn')!.click();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 1.0 });
    });

    test('zoom changed callback updates display for various levels', async () => {
      init();
      await flush();
      const cb = api.onZoomChanged.mock.calls[0][0];
      cb({ zoom: 0.5 });
      expect(document.getElementById('zoom-level-btn')!.textContent).toBe('50%');
      expect(document.getElementById('status-zoom')!.textContent).toBe('Zoom: 50%');
      cb({ zoom: 2.0 });
      expect(document.getElementById('zoom-level-btn')!.textContent).toBe('200%');
    });
  });

  // ===== Sidebar Advanced Interactions =====
  describe('Sidebar advanced interactions', () => {
    test('sort and filter combination: type sort + files filter', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'beta.txt', isDirectory: false, path: '/test/beta.txt' },
        { name: 'alpha', isDirectory: true, path: '/test/alpha' },
        { name: 'gamma.js', isDirectory: false, path: '/test/gamma.js' },
        { name: 'delta', isDirectory: true, path: '/test/delta' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const filesRadio = document.querySelector('input[name="sidebar-filter"][value="files"]') as HTMLInputElement;
      filesRadio.checked = true;
      filesRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = Array.from(document.querySelectorAll('.tree-name')).map(el => el.textContent);
      expect(names).toEqual(['beta.txt', 'gamma.js']);
    });

    test('new folder creation refreshes tree and sets output dir', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([]).mockResolvedValueOnce([
        { name: 'new-folder', isDirectory: true, path: '/test/new-folder' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      document.getElementById('sidebar-new-folder')!.click();
      (document.getElementById('sidebar-new-folder-name') as HTMLInputElement).value = 'new-folder';
      document.getElementById('sidebar-new-folder-ok')!.click();
      await flush();
      expect(api.createDirectory).toHaveBeenCalledWith({ dirPath: '/test/new-folder' });
      expect(api.saveSettings).toHaveBeenCalledWith({ settings: { snapshotDir: '/test/new-folder' } });
      const output = document.getElementById('sidebar-output-dir')!;
      expect(output.textContent).toBe('new-folder');
    });

    test('Space key on image file opens preview', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'img.png', isDirectory: false, path: '/test/img.png' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const item = document.querySelector('.tree-item')!;
      item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await flush();
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
    });

    test('Space key on HTML file opens report', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'report.html', isDirectory: false, path: '/test/report.html' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      const item = document.querySelector('.tree-item')!;
      item.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await flush();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/test/report.html' });
    });

    test('WEBP file opens in preview modal', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'photo.webp', isDirectory: false, path: '/test/photo.webp' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      (document.querySelector('.tree-item') as HTMLElement).click();
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
      await flush();
      expect(api.readFileData).toHaveBeenCalledWith({ filePath: '/test/photo.webp' });
    });

    test('SVG file opens in preview modal', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue([
        { name: 'icon.svg', isDirectory: false, path: '/test/icon.svg' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      (document.querySelector('.tree-item') as HTMLElement).click();
      expect(document.getElementById('preview-modal')!.classList.contains('hidden')).toBe(false);
      await flush();
      expect(api.readFileData).toHaveBeenCalledWith({ filePath: '/test/icon.svg' });
    });
  });

  // ===== Capture Result Display Variants =====
  describe('Capture result display variants', () => {
    test('capture result with new items shows correct count', async () => {
      init();
      await flush();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ summary: { passed: 2, failed: 0, new: 3, deleted: 1 }, reportPath: '/tmp/r.html' });
      const statusResult = document.getElementById('status-result')!;
      expect(statusResult.innerHTML).toContain('Passed: 2');
      expect(statusResult.innerHTML).toContain('New: 3');
      expect(statusResult.innerHTML).toContain('Deleted: 1');
    });

    test('toast shows when differences found (failed > 0)', async () => {
      init();
      await flush();
      const cb = api.onCaptureResult.mock.calls[0][0];
      cb({ summary: { passed: 1, failed: 3, new: 0, deleted: 0 }, reportPath: '/tmp/r.html' });
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toBe('Captured! 3 difference(s) found');
    });
  });

  // ===== New Report with Folder Integration =====
  describe('New Report with folder integration', () => {
    test('new report with folder displays folder path', async () => {
      api.selectFolder.mockResolvedValue('/vrt');
      api.readDirectory.mockResolvedValue([
        { name: 'test-dir', isDirectory: true, path: '/vrt/test-dir' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      document.getElementById('new-report-btn')!.click();
      const folderInfo = document.getElementById('new-report-folder-info')!;
      expect(folderInfo.classList.contains('hidden')).toBe(false);
    });

    test('new report capture proceeds even if createDirectory fails', async () => {
      api.selectFolder.mockResolvedValue('/vrt');
      api.readDirectory.mockResolvedValue([]);
      api.createDirectory.mockRejectedValue(new Error('EEXIST'));
      init();
      await flush();
      document.getElementById('sidebar-select-folder')!.click();
      await flush();
      document.getElementById('new-report-btn')!.click();
      (document.getElementById('report-test-name') as HTMLInputElement).value = 'existing-dir';
      document.getElementById('new-report-capture')!.click();
      await flush();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'existing-dir' });
    });
  });

  // ===== URL Input Edge Cases =====
  describe('URL input edge cases', () => {
    test('empty URL input triggers navigate with empty string on Enter', async () => {
      init();
      await flush();
      const leftInput = document.getElementById('left-url') as HTMLInputElement;
      leftInput.value = '';
      leftInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(api.navigate).toHaveBeenCalledWith({ url: '', target: 'left' });
    });

    test('right URL Enter key triggers navigation for right target', async () => {
      init();
      await flush();
      const rightInput = document.getElementById('right-url') as HTMLInputElement;
      rightInput.value = 'http://example.com';
      rightInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(api.navigate).toHaveBeenCalledWith({ url: 'http://example.com', target: 'right' });
    });
  });

  // ===== Keyboard Shortcuts During Modal =====
  describe('Keyboard shortcuts during modal states', () => {
    test('new report modal opens when button is clicked', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn')!.click();
      expect(document.getElementById('new-report-modal')!.classList.contains('hidden')).toBe(false);
    });

    test('settings modal opens when button is clicked', async () => {
      init();
      await flush();
      document.getElementById('settings-btn')!.click();
      expect(document.getElementById('settings-modal')!.classList.contains('hidden')).toBe(false);
    });

    test('preset shortcut applies correct device', async () => {
      init();
      await flush();
      const cb = api.onShortcutPreset.mock.calls[0][0];
      cb({ index: 2 });
      const preset = _PRESET_LIST[2];
      expect(api.setDevicePreset).toHaveBeenCalledWith({ width: preset.width, height: preset.height });
    });

    test('zoom shortcuts work in sequence', async () => {
      init();
      await flush();
      const zoomInCb = api.onShortcutZoomIn.mock.calls[0][0];
      const zoomOutCb = api.onShortcutZoomOut.mock.calls[0][0];
      const zoomResetCb = api.onShortcutZoomReset.mock.calls[0][0];
      zoomInCb();
      expect(api.setZoom).toHaveBeenCalled();
      api.setZoom.mockClear();
      zoomOutCb();
      expect(api.setZoom).toHaveBeenCalled();
      api.setZoom.mockClear();
      zoomResetCb();
      expect(api.setZoom).toHaveBeenCalledWith({ zoom: 1.0 });
    });
  });
});
