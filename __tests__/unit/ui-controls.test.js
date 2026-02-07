/** @jest-environment jsdom */

const { getPresetByIndex, PRESET_LIST } = require('../../src/renderer/scripts/device-presets');

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
    <div id="sidebar" class="sidebar collapsed">
      <button id="sidebar-select-folder"></button>
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
      <input id="report-test-name" />
      <input id="report-description" />
      <button id="new-report-capture"></button>
      <button id="new-report-cancel"></button>
    </div>
    <span id="status-size">-- x --</span>
    <span id="status-sync">Sync: ON</span>
    <span id="status-result">Ready</span>
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
    setSidebarWidth: jest.fn().mockResolvedValue(undefined),
    onCaptureResult: jest.fn(),
    onShortcutCapture: jest.fn(),
    onShortcutOpenReport: jest.fn(),
    onShortcutPreset: jest.fn(),
    onShortcutSettings: jest.fn(),
  };
  window.electronAPI = api;
  return api;
}

// Flush microtasks (let promises resolve)
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------- suite ----------
describe('ui-controls', () => {
  let api;

  beforeEach(() => {
    buildDOM();
    api = mockElectronAPI();
    global.getPresetByIndex = getPresetByIndex;
    jest.resetModules();
  });

  afterEach(() => {
    delete global.getPresetByIndex;
    delete window.electronAPI;
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
      const input = document.getElementById('left-url');
      input.value = 'http://example.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(api.navigate).toHaveBeenCalledWith({ url: 'http://example.com', target: 'left' });
    });

    test('Enter key on right-url calls navigate with right target', async () => {
      init();
      await flush();
      const input = document.getElementById('right-url');
      input.value = 'http://other.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(api.navigate).toHaveBeenCalledWith({ url: 'http://other.com', target: 'right' });
    });

    test('non-Enter key does not trigger navigate', async () => {
      init();
      await flush();
      const input = document.getElementById('left-url');
      input.value = 'http://example.com';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      expect(api.navigate).not.toHaveBeenCalled();
    });

    test('Enter during IME composition does not trigger navigate', async () => {
      init();
      await flush();
      const input = document.getElementById('left-url');
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
      document.getElementById('reload-left').click();
      expect(api.reloadViews).toHaveBeenCalledWith({ target: 'left' });
    });

    test('reload-right button calls reloadViews with right', async () => {
      init();
      await flush();
      document.getElementById('reload-right').click();
      expect(api.reloadViews).toHaveBeenCalledWith({ target: 'right' });
    });
  });

  // ===== Capture Button =====
  describe('Capture button', () => {
    test('capture-btn calls captureAndCompare with pageName "page"', async () => {
      init();
      await flush();
      document.getElementById('capture-btn').click();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'page' });
    });
  });

  // ===== onCaptureResult =====
  describe('onCaptureResult', () => {
    function triggerCaptureResult(data) {
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
      const statusResult = document.getElementById('status-result');
      expect(statusResult.innerHTML).toContain('Passed: 1');
      expect(statusResult.innerHTML).toContain('Failed: 0');
      const toast = document.getElementById('toast');
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
      const toast = document.getElementById('toast');
      expect(toast.textContent).toBe('Captured! 2 difference(s) found');
      expect(toast.className).toContain('toast-error');
    });

    test('error updates status and shows error toast', async () => {
      init();
      await flush();
      triggerCaptureResult({ error: 'Something broke' });
      const statusResult = document.getElementById('status-result');
      expect(statusResult.textContent).toBe('Error: Something broke');
      const toast = document.getElementById('toast');
      expect(toast.textContent).toContain('Capture failed');
      expect(toast.className).toContain('toast-error');
    });
  });

  // ===== New Report Modal =====
  describe('New Report modal', () => {
    test('clicking New opens modal, hides BrowserViews, and clears inputs', async () => {
      init();
      await flush();
      const modal = document.getElementById('new-report-modal');
      expect(modal.classList.contains('hidden')).toBe(true);
      document.getElementById('new-report-btn').click();
      expect(modal.classList.contains('hidden')).toBe(false);
      expect(document.getElementById('report-test-name').value).toBe('');
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
    });

    test('empty test name does not trigger capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn').click();
      document.getElementById('report-test-name').value = '  ';
      document.getElementById('new-report-capture').click();
      expect(api.captureAndCompare).not.toHaveBeenCalled();
      expect(document.getElementById('new-report-modal').classList.contains('hidden')).toBe(false);
    });

    test('valid test name triggers capture, closes modal, and restores BrowserViews', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn').click();
      api.setViewsVisible.mockClear();
      document.getElementById('report-test-name').value = 'login-page';
      document.getElementById('new-report-capture').click();
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'login-page' });
      expect(document.getElementById('new-report-modal').classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('cancel closes modal and restores BrowserViews', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn').click();
      api.setViewsVisible.mockClear();
      document.getElementById('new-report-cancel').click();
      expect(document.getElementById('new-report-modal').classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('Enter key in test name input triggers capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn').click();
      const nameInput = document.getElementById('report-test-name');
      nameInput.value = 'my-test';
      nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(api.captureAndCompare).toHaveBeenCalledWith({ pageName: 'my-test' });
    });

    test('Enter during IME composition does not trigger capture', async () => {
      init();
      await flush();
      document.getElementById('new-report-btn').click();
      const nameInput = document.getElementById('report-test-name');
      nameInput.value = 'テスト';
      nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
      expect(api.captureAndCompare).not.toHaveBeenCalled();
    });
  });

  // ===== Sync Toggle =====
  describe('Sync toggle', () => {
    test('initial state has sync-on class', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync');
      expect(btn.classList.contains('sync-on')).toBe(true);
    });

    test('clicking toggle switches to sync-off', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync');
      btn.click();
      expect(btn.classList.contains('sync-off')).toBe(true);
      expect(btn.classList.contains('sync-on')).toBe(false);
      expect(btn.textContent).toContain('Sync OFF');
      expect(document.getElementById('status-sync').textContent).toBe('Sync: OFF');
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: false });
    });

    test('clicking toggle twice restores sync-on', async () => {
      init();
      await flush();
      const btn = document.getElementById('toggle-sync');
      btn.click();
      btn.click();
      expect(btn.classList.contains('sync-on')).toBe(true);
      expect(btn.textContent).toContain('Sync ON');
      expect(document.getElementById('status-sync').textContent).toBe('Sync: ON');
      expect(api.setSyncEnabled).toHaveBeenCalledWith({ enabled: true });
    });
  });

  // ===== Device Presets =====
  describe('Device presets', () => {
    test('clicking a preset calls setDevicePreset with correct size', async () => {
      init();
      await flush();
      const btn = document.querySelector('.btn-preset[data-preset="0"]');
      btn.click();
      const preset = PRESET_LIST[0];
      expect(api.setDevicePreset).toHaveBeenCalledWith({ width: preset.width, height: preset.height });
    });

    test('clicking a preset updates status-size', async () => {
      init();
      await flush();
      document.querySelector('.btn-preset[data-preset="3"]').click();
      const preset = PRESET_LIST[3];
      expect(document.getElementById('status-size').textContent).toBe(`${preset.width} x ${preset.height}`);
    });

    test('active class is set on clicked preset and removed from others', async () => {
      init();
      await flush();
      document.querySelector('.btn-preset[data-preset="1"]').click();
      expect(document.querySelector('.btn-preset[data-preset="1"]').classList.contains('active')).toBe(true);
      expect(document.querySelector('.btn-preset[data-preset="0"]').classList.contains('active')).toBe(false);

      document.querySelector('.btn-preset[data-preset="2"]').click();
      expect(document.querySelector('.btn-preset[data-preset="2"]').classList.contains('active')).toBe(true);
      expect(document.querySelector('.btn-preset[data-preset="1"]').classList.contains('active')).toBe(false);
    });
  });

  // ===== Settings Modal =====
  describe('Settings modal', () => {
    test('clicking settings button opens modal, hides BrowserViews, and loads settings', async () => {
      init();
      await flush();
      document.getElementById('settings-btn').click();
      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(false);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: false });
      await flush();
      expect(api.getSettings).toHaveBeenCalled();
    });

    test('saving settings closes modal and restores BrowserViews', async () => {
      init();
      await flush();
      document.getElementById('settings-btn').click();
      await flush();
      api.setViewsVisible.mockClear();
      document.getElementById('setting-matching-threshold').value = '0.5';
      document.getElementById('setting-threshold-rate').value = '0.1';
      document.getElementById('setting-snapshot-dir').value = './my-snaps';
      document.getElementById('settings-save').click();
      expect(api.saveSettings).toHaveBeenCalledWith({
        settings: {
          matchingThreshold: 0.5,
          thresholdRate: 0.1,
          snapshotDir: './my-snaps',
        },
      });
      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(true);
      expect(api.setViewsVisible).toHaveBeenCalledWith({ visible: true });
    });

    test('cancel closes settings modal, restores BrowserViews, without saving', async () => {
      init();
      await flush();
      document.getElementById('settings-btn').click();
      await flush();
      api.setViewsVisible.mockClear();
      document.getElementById('settings-cancel').click();
      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(true);
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
      const preset = PRESET_LIST[2];
      expect(api.setDevicePreset).toHaveBeenCalledWith({ width: preset.width, height: preset.height });
    });

    test('onShortcutSettings opens settings modal', async () => {
      init();
      await flush();
      const cb = api.onShortcutSettings.mock.calls[0][0];
      cb();
      expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(false);
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
      return Array.from(document.getElementById('sidebar-tree').querySelectorAll('.tree-item > .tree-name'))
        .map((el) => el.textContent);
    }

    async function openFolderWithEntries(entries) {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValue(entries || mixedEntries);
      init();
      await flush();
      document.getElementById('sidebar-select-folder').click();
      await flush();
    }

    // --- Toggle ---
    test('clicking toggle-sidebar opens sidebar and sets width', async () => {
      init();
      await flush();
      const sidebar = document.getElementById('sidebar');
      expect(sidebar.classList.contains('collapsed')).toBe(true);
      document.getElementById('toggle-sidebar').click();
      expect(sidebar.classList.contains('collapsed')).toBe(false);
      expect(api.setSidebarWidth).toHaveBeenCalledWith({ width: 250 });
    });

    test('clicking toggle-sidebar twice closes sidebar', async () => {
      init();
      await flush();
      document.getElementById('toggle-sidebar').click();
      document.getElementById('toggle-sidebar').click();
      expect(document.getElementById('sidebar').classList.contains('collapsed')).toBe(true);
      expect(api.setSidebarWidth).toHaveBeenLastCalledWith({ width: 0 });
    });

    // --- Folder selection ---
    test('selecting a folder renders tree entries', async () => {
      await openFolderWithEntries([
        { name: 'subdir', isDirectory: true, path: '/test/subdir' },
        { name: 'file.txt', isDirectory: false, path: '/test/file.txt' },
      ]);
      const items = document.getElementById('sidebar-tree').querySelectorAll('.tree-item');
      expect(items.length).toBe(2);
    });

    test('selecting null folder does not render tree', async () => {
      api.selectFolder.mockResolvedValue(null);
      init();
      await flush();
      document.getElementById('sidebar-select-folder').click();
      await flush();
      expect(document.getElementById('sidebar-tree').children.length).toBe(0);
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
      document.getElementById('sidebar-select-folder').click();
      await flush();
      document.getElementById('sidebar-tree').querySelector('.tree-item').click();
      await flush();
      const children = document.getElementById('sidebar-tree').querySelector('.tree-children');
      expect(children.classList.contains('expanded')).toBe(true);
      expect(children.querySelector('.tree-name').textContent).toBe('child.txt');
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
      document.getElementById('sidebar-select-folder').click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree').querySelector('.tree-item');
      dirItem.click();
      await flush();
      dirItem.click();
      await flush();
      expect(document.getElementById('sidebar-tree').querySelector('.tree-children').classList.contains('expanded')).toBe(false);
    });

    test('readDirectory error is handled gracefully', async () => {
      api.selectFolder.mockResolvedValue('/nonexistent');
      api.readDirectory.mockRejectedValue(new Error('ENOENT'));
      init();
      await flush();
      document.getElementById('sidebar-select-folder').click();
      await flush();
      expect(document.getElementById('sidebar-tree').children.length).toBe(0);
    });

    test('child directory readDirectory error is handled gracefully', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]).mockRejectedValueOnce(new Error('EPERM'));
      init();
      await flush();
      document.getElementById('sidebar-select-folder').click();
      await flush();
      document.getElementById('sidebar-tree').querySelector('.tree-item').click();
      await flush();
      const children = document.getElementById('sidebar-tree').querySelector('.tree-children');
      expect(children.classList.contains('expanded')).toBe(true);
      expect(children.querySelectorAll('.tree-item').length).toBe(0);
    });

    // --- Sort select ---
    test('sort select name-asc sorts alphabetically', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-sort').value = 'name-asc';
      document.getElementById('sidebar-sort').dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames()).toEqual(['alpha', 'beta.txt', 'delta', 'gamma.js']);
    });

    test('sort select name-desc sorts reverse alphabetically', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-sort').value = 'name-desc';
      document.getElementById('sidebar-sort').dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames()).toEqual(['gamma.js', 'delta', 'beta.txt', 'alpha']);
    });

    test('sort select type groups directories first', async () => {
      await openFolderWithEntries();
      document.getElementById('sidebar-sort').value = 'type';
      document.getElementById('sidebar-sort').dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = getTreeNames();
      expect(names).toEqual(['alpha', 'delta', 'beta.txt', 'gamma.js']);
    });

    test('sort change without folder does nothing', async () => {
      init();
      await flush();
      document.getElementById('sidebar-sort').value = 'name-desc';
      document.getElementById('sidebar-sort').dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree').children.length).toBe(0);
    });

    // --- Filter radio buttons ---
    test('filter radio "directories" shows only directories', async () => {
      await openFolderWithEntries();
      const radio = document.querySelector('input[name="sidebar-filter"][value="directories"]');
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = getTreeNames();
      expect(names.every((n) => !n.includes('.'))).toBe(true);
      expect(names.length).toBe(2);
    });

    test('filter radio "files" shows only files', async () => {
      await openFolderWithEntries();
      const radio = document.querySelector('input[name="sidebar-filter"][value="files"]');
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      const names = getTreeNames();
      expect(names.every((n) => n.includes('.'))).toBe(true);
      expect(names.length).toBe(2);
    });

    test('filter radio "all" shows everything', async () => {
      await openFolderWithEntries();
      // Switch to files first
      const filesRadio = document.querySelector('input[name="sidebar-filter"][value="files"]');
      filesRadio.checked = true;
      filesRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      // Then switch back to all
      const allRadio = document.querySelector('input[name="sidebar-filter"][value="all"]');
      allRadio.checked = true;
      allRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(getTreeNames().length).toBe(4);
    });

    test('filter change without folder does nothing', async () => {
      init();
      await flush();
      const radio = document.querySelector('input[name="sidebar-filter"][value="files"]');
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree').children.length).toBe(0);
    });

    test('sort and filter combine correctly', async () => {
      await openFolderWithEntries();
      // Filter to directories only
      const dirsRadio = document.querySelector('input[name="sidebar-filter"][value="directories"]');
      dirsRadio.checked = true;
      dirsRadio.dispatchEvent(new Event('change', { bubbles: true }));
      await flush();
      // Sort descending
      document.getElementById('sidebar-sort').value = 'name-desc';
      document.getElementById('sidebar-sort').dispatchEvent(new Event('change', { bubbles: true }));
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
      document.getElementById('sidebar-select-folder').click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree').querySelector('.tree-item');
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree').querySelector('.tree-children').classList.contains('expanded')).toBe(true);
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
      document.getElementById('sidebar-select-folder').click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree').querySelector('.tree-item');
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree').querySelector('.tree-children').classList.contains('expanded')).toBe(true);
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
      document.getElementById('sidebar-select-folder').click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree').querySelector('.tree-item');
      dirItem.click();
      await flush();
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree').querySelector('.tree-children').classList.contains('expanded')).toBe(false);
    });

    test('non-Enter/Space key does not toggle directory', async () => {
      api.selectFolder.mockResolvedValue('/test');
      api.readDirectory.mockResolvedValueOnce([
        { name: 'sub', isDirectory: true, path: '/test/sub' },
      ]);
      init();
      await flush();
      document.getElementById('sidebar-select-folder').click();
      await flush();
      const dirItem = document.getElementById('sidebar-tree').querySelector('.tree-item');
      dirItem.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
      await flush();
      expect(document.getElementById('sidebar-tree').querySelector('.tree-children').classList.contains('expanded')).toBe(false);
    });

    // --- Accessibility ---
    test('tree items have tabindex and role attributes', async () => {
      await openFolderWithEntries([
        { name: 'dir', isDirectory: true, path: '/test/dir' },
        { name: 'file.txt', isDirectory: false, path: '/test/file.txt' },
      ]);
      const items = document.getElementById('sidebar-tree').querySelectorAll('.tree-item');
      items.forEach((item) => {
        expect(item.getAttribute('tabindex')).toBe('0');
      });
      expect(items[0].getAttribute('role')).toBe('treeitem');
      expect(items[1].getAttribute('role')).toBe('none');
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
      const toast = document.getElementById('toast');
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
      const toast = document.getElementById('toast');
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
      expect(document.getElementById('left-url').value).toBe('http://my-left.com');
      expect(document.getElementById('right-url').value).toBe('http://my-right.com');
    });

    test('uses fallback URLs when settings have no URL', async () => {
      api.getSettings.mockResolvedValue({
        matchingThreshold: 0,
        thresholdRate: 0,
        snapshotDir: './snapshots',
      });
      init();
      await flush();
      expect(document.getElementById('left-url').value).toBe('http://localhost:3000');
      expect(document.getElementById('right-url').value).toBe('http://localhost:3001');
    });
  });

  // ===== Report Button =====
  describe('Report button', () => {
    test('clicking report does nothing when no report path', async () => {
      init();
      await flush();
      document.getElementById('report-btn').click();
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
      document.getElementById('report-btn').click();
      expect(api.openReport).toHaveBeenCalledWith({ reportPath: '/tmp/my-report/index.html' });
    });
  });

  // ===== Capture Error Handling =====
  describe('Capture error handling', () => {
    test('captureAndCompare rejection updates status', async () => {
      api.captureAndCompare.mockRejectedValue(new Error('Network error'));
      init();
      await flush();
      document.getElementById('capture-btn').click();
      await flush();
      expect(document.getElementById('status-result').textContent).toBe('Error: Network error');
    });
  });
});
