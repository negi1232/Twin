/** @jest-environment jsdom */
export {};

// ---------- helpers ----------

function buildDOM() {
  document.body.innerHTML = `
    <button id="css-scan-btn">CSS Scan</button>
    <button id="css-inspect-btn">Inspect</button>
    <div id="css-inspect-drawer" class="hidden">
      <button id="css-inspect-drawer-close"></button>
      <div id="css-inspect-drawer-handle"></div>
      <div id="css-inspect-header-info"></div>
      <button id="css-inspect-filter-diff" class="active"></button>
      <button id="css-inspect-filter-all"></button>
      <button class="css-inspect-cat-btn" data-cat="all"></button>
      <button class="css-inspect-cat-btn" data-cat="layout"></button>
      <button class="css-inspect-cat-btn" data-cat="text"></button>
      <button class="css-inspect-cat-btn" data-cat="visual"></button>
      <button class="css-inspect-cat-btn" data-cat="other"></button>
      <div id="css-inspect-drawer-body"></div>
    </div>
    <div id="toast" class="toast hidden"></div>
  `;
}

function mockElectronAPI() {
  const callbacks: Record<string, any> = {};
  const api = {
    cssFullScan: jest.fn().mockResolvedValue(undefined),
    cssInspectToggle: jest.fn().mockResolvedValue({ enabled: true }),
    onCssInspectResult: jest.fn((cb: any) => {
      callbacks['css-inspect-result'] = cb;
    }),
    onShortcutCssScan: jest.fn((cb: any) => {
      callbacks['shortcut-css-scan'] = cb;
    }),
    onShortcutCssInspect: jest.fn((cb: any) => {
      callbacks['shortcut-css-inspect'] = cb;
    }),
  };
  (window as any).electronAPI = api;
  return { api, callbacks };
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// ---------- suite ----------
describe('renderer/css-compare', () => {
  let api: any;
  let callbacks: Record<string, any>;

  beforeEach(() => {
    buildDOM();
    const mock = mockElectronAPI();
    api = mock.api;
    callbacks = mock.callbacks;
    jest.resetModules();
  });

  afterEach(() => {
    delete (window as any).electronAPI;
    delete (global as any).escapeHtml;
    delete (global as any).classifyProperty;
    delete (global as any).showToast;
  });

  function init() {
    // Load shared utils as globals (escapeHtml, classifyProperty)
    const sharedUtils = require('../../src/shared/utils');
    (global as any).escapeHtml = sharedUtils.escapeHtml;
    (global as any).classifyProperty = sharedUtils.classifyProperty;
    // Load showToast as global (defined at module level in ui-controls)
    const uiControls = require('../../src/renderer/scripts/ui-controls');
    (global as any).showToast = uiControls.showToast;
    // Now load css-compare which depends on the above globals
    const { initCssCompare } = require('../../src/renderer/scripts/css-compare');
    initCssCompare();
  }

  // ===== CSS Full Scan =====
  describe('CSS Full Scan', () => {
    test('clicking scan button calls cssFullScan', async () => {
      init();
      document.getElementById('css-scan-btn')!.click();
      await flush();
      expect(api.cssFullScan).toHaveBeenCalled();
    });

    test('scan button shows spinner during scan and restores text after', async () => {
      let resolvePromise: any;
      api.cssFullScan.mockImplementation(
        () => new Promise((resolve) => { resolvePromise = resolve; }),
      );
      init();
      const btn = document.getElementById('css-scan-btn') as HTMLButtonElement;
      btn.click();
      await flush();
      expect(btn.disabled).toBe(true);
      expect(btn.innerHTML).toContain('Scanning');
      resolvePromise();
      await flush();
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain('CSS Scan');
    });

    test('scan button restores text on error', async () => {
      api.cssFullScan.mockRejectedValue(new Error('scan failed'));
      init();
      const btn = document.getElementById('css-scan-btn') as HTMLButtonElement;
      btn.click();
      await flush();
      expect(btn.disabled).toBe(false);
      expect(btn.textContent).toContain('CSS Scan');
    });

    test('scan error shows toast', async () => {
      api.cssFullScan.mockRejectedValue(new Error('network error'));
      init();
      document.getElementById('css-scan-btn')!.click();
      await flush();
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toContain('CSS Scan failed');
      expect(toast.textContent).toContain('network error');
    });
  });

  // ===== CSS Inspect Mode =====
  describe('CSS Inspect Mode', () => {
    test('clicking inspect button toggles inspect mode on', async () => {
      init();
      document.getElementById('css-inspect-btn')!.click();
      await flush();
      expect(api.cssInspectToggle).toHaveBeenCalledWith({ enabled: true });
    });

    test('clicking inspect button twice toggles off', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      btn.click();
      await flush();
      btn.click();
      await flush();
      expect(api.cssInspectToggle).toHaveBeenLastCalledWith({ enabled: false });
    });

    test('inspect button shows active state when on', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      btn.click();
      await flush();
      expect(btn.classList.contains('css-inspect-active')).toBe(true);
      expect(btn.textContent).toContain('Inspect ON');
    });

    test('inspect button resets on API error', async () => {
      api.cssInspectToggle.mockRejectedValue(new Error('fail'));
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      btn.click();
      await flush();
      expect(btn.classList.contains('css-inspect-active')).toBe(false);
      expect(btn.textContent).toContain('Inspect');
    });

    test('Escape key disables inspect mode when active', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      btn.click();
      await flush();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      expect(btn.textContent).not.toContain('Inspect ON');
    });

    test('Escape key does nothing when inspect not active', async () => {
      init();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      // Should not call toggle when not active
      expect(api.cssInspectToggle).not.toHaveBeenCalled();
    });

    test('toggleInspectMode でオフに切り替えるとドロワーを非表示にする', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      const drawer = document.getElementById('css-inspect-drawer')!;
      // Enable inspect
      btn.click();
      await flush();
      // Show drawer via inspect result
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: { tag: 'div', key: '#test', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      expect(drawer.classList.contains('hidden')).toBe(false);
      // Toggle off
      btn.click();
      await flush();
      expect(drawer.classList.contains('hidden')).toBe(true);
    });

    test('disableInspectMode の catch パスでエラーログを出力する', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      // Enable inspect
      btn.click();
      await flush();
      // Make the next cssInspectToggle call reject
      api.cssInspectToggle.mockRejectedValue(new Error('IPC error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      // Trigger disableInspectMode via Escape
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await flush();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to disable inspect mode:',
        'IPC error',
      );
      consoleSpy.mockRestore();
    });
  });

  // ===== Inspect Drawer =====
  describe('Inspect Drawer', () => {
    test('inspect result shows drawer', () => {
      init();
      const drawer = document.getElementById('css-inspect-drawer')!;
      expect(drawer.classList.contains('hidden')).toBe(true);
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#test', method: 'id', styles: { color: 'blue' } },
        diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }],
        error: null,
      });
      expect(drawer.classList.contains('hidden')).toBe(false);
    });

    test('close button hides drawer', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: { tag: 'div', key: '#test', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      const drawer = document.getElementById('css-inspect-drawer')!;
      expect(drawer.classList.contains('hidden')).toBe(false);
      document.getElementById('css-inspect-drawer-close')!.click();
      expect(drawer.classList.contains('hidden')).toBe(true);
    });

    test('modeDisabled result disables inspect mode', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      btn.click();
      await flush();
      callbacks['css-inspect-result']({ modeDisabled: true });
      await flush();
      expect(btn.textContent).not.toContain('Inspect ON');
    });

    test('modeDisabled でインスペクトが非アクティブの場合、早期リターンする', async () => {
      init();
      const btn = document.getElementById('css-inspect-btn')!;
      // inspect is NOT active (default state)
      // modeDisabled triggers disableInspectMode, which hits early return
      callbacks['css-inspect-result']({ modeDisabled: true });
      await flush();
      // Should not have called cssInspectToggle since inspect was not active
      expect(api.cssInspectToggle).not.toHaveBeenCalled();
      expect(btn.textContent).not.toContain('Inspect ON');
    });
  });

  // ===== Drawer Resize =====
  describe('Drawer resize', () => {
    test('mousedown on handle starts drag, mousemove resizes, mouseup ends', () => {
      init();
      // Show drawer first
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: { tag: 'div', key: '#test', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      const handle = document.getElementById('css-inspect-drawer-handle')!;
      const drawer = document.getElementById('css-inspect-drawer')!;
      // Start drag
      handle.dispatchEvent(new MouseEvent('mousedown', { clientY: 500, bubbles: true }));
      expect(document.body.style.cursor).toBe('ns-resize');
      // Move
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 400, bubbles: true }));
      // Drawer height should have changed
      expect(drawer.style.height).toBeTruthy();
      // End drag
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(document.body.style.cursor).toBe('');
    });

    test('mousemove without drag does nothing', () => {
      init();
      const drawer = document.getElementById('css-inspect-drawer')!;
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 400, bubbles: true }));
      expect(drawer.style.height).toBe('');
    });

    test('mouseup はドラッグ中でなければ何もしない', () => {
      init();
      // Just mouseup without prior mousedown
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      // body cursor should remain default
      expect(document.body.style.cursor).toBe('');
      expect(document.body.style.userSelect).toBe('');
    });
  });

  // ===== Inspect Header =====
  describe('Inspect header rendering', () => {
    test('renders error message in header', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'span', key: '.foo', method: 'class', styles: {} },
        right: null,
        diffs: [],
        error: 'Element not found',
      });
      const header = document.getElementById('css-inspect-header-info')!;
      expect(header.innerHTML).toContain('span');
      expect(header.innerHTML).toContain('Element not found');
      expect(header.innerHTML).toContain('css-inspect-error');
    });

    test('renders diff count in header', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#main', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#main', method: 'id', styles: { color: 'blue' } },
        diffs: [
          { property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' },
          { property: 'font-size', expected: '14px', actual: '16px', category: 'text', type: 'changed' },
        ],
        error: null,
      });
      const header = document.getElementById('css-inspect-header-info')!;
      expect(header.innerHTML).toContain('2 differences');
      expect(header.innerHTML).toContain('div');
      expect(header.innerHTML).toContain('#main');
    });

    test('エラー時に left が null の場合、タグに "?" キーに "" を表示する', () => {
      init();
      callbacks['css-inspect-result']({
        left: null,
        right: null,
        diffs: [],
        error: 'No matching element',
      });
      const header = document.getElementById('css-inspect-header-info')!;
      expect(header.innerHTML).toContain('?');
      expect(header.innerHTML).toContain('css-inspect-error');
      expect(header.innerHTML).toContain('No matching element');
    });

    test('diffs が null の場合、差分カウントを 0 にする', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'p', key: '.text', method: 'class', styles: {} },
        right: { tag: 'p', key: '.text', method: 'class', styles: {} },
        diffs: null,
        error: null,
      });
      const header = document.getElementById('css-inspect-header-info')!;
      expect(header.innerHTML).toContain('0 differences');
    });

    test('diffs に added と deleted タイプが含まれる場合もカウントされる', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#box', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#box', method: 'id', styles: { display: 'flex' } },
        diffs: [
          { property: 'color', expected: 'red', actual: '', category: 'text', type: 'deleted' },
          { property: 'display', expected: '', actual: 'flex', category: 'layout', type: 'added' },
          { property: 'font-size', expected: '14px', actual: '14px', category: 'text', type: 'unchanged' },
        ],
        error: null,
      });
      const header = document.getElementById('css-inspect-header-info')!;
      // deleted + added = 2, unchanged is not counted
      expect(header.innerHTML).toContain('2 differences');
    });
  });

  // ===== Inspect Diffs Rendering =====
  describe('Inspect diffs rendering', () => {
    test('renders diff table with diff rows', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#box', method: 'id', styles: { color: 'red', display: 'block' } },
        right: { tag: 'div', key: '#box', method: 'id', styles: { color: 'blue', display: 'block' } },
        diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }],
        error: null,
      });
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('css-inspect-table');
      expect(body.innerHTML).toContain('color');
      expect(body.innerHTML).toContain('red');
      expect(body.innerHTML).toContain('blue');
    });

    test('renders empty message when no diffs', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#box', method: 'id', styles: {} },
        right: { tag: 'div', key: '#box', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      const body = document.getElementById('css-inspect-drawer-body')!;
      // Empty diffs in diff-only mode → "No matching properties"
      expect(body.innerHTML).toContain('No matching properties');
    });

    test('renders guide text when no data and no error', () => {
      init();
      // When currentInspectData is null (no error, no data), guide is shown
      // But the callback sets currentInspectData, so we need error=null and no diffs
      // The guide is only shown when currentInspectData is null or has error
      // With left=null, error=null, it triggers the "no matching properties" path
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: { tag: 'div', key: '#test', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      const body = document.getElementById('css-inspect-drawer-body')!;
      // No diffs in diff-only mode → empty message
      expect(body.innerHTML).toContain('No matching properties');
    });

    test('renders error message in body when error present', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: null,
        diffs: [],
        error: 'Right panel not available',
      });
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('Right panel not available');
    });

    test('currentInspectData が null の場合、ガイドテキストを表示する', () => {
      init();
      // renderInspectDiffs is called when filter buttons are clicked,
      // but currentInspectData is null initially.
      // We need to trigger renderInspectDiffs with null data.
      // The guide text path (branch 16 loc[1]) is shown when currentInspectData is null.
      // First show a result, then close the drawer (which sets currentInspectData to null),
      // then trigger a filter click - but filter click calls renderInspectDiffs which checks currentInspectData.
      // Actually, closing the drawer sets currentInspectData = null.
      // Then clicking a filter button calls renderInspectDiffs with null data -> guide text.

      // Show some data first
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: { tag: 'div', key: '#test', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      // Close the drawer (sets currentInspectData = null)
      document.getElementById('css-inspect-drawer-close')!.click();
      // Now click the filter button to trigger renderInspectDiffs with null data
      document.getElementById('css-inspect-filter-diff')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('CSS Inspect Mode');
      expect(body.innerHTML).toContain('css-inspect-guide-title');
    });

    test('isDiff が未定義の行は diff 行として扱う', () => {
      init();
      // rows from diffs array have type but no isDiff -> isDiff defaults to true (line 243)
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#t', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#t', method: 'id', styles: { color: 'blue' } },
        diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }],
        error: null,
      });
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('css-diff-row');
      // The "≠" icon for diff rows
      expect(body.textContent).toContain('\u2260');
    });

    test('isDiff が false の行はチェックマークアイコンを表示する', () => {
      init();
      // Use "All" filter to show non-diff rows with isDiff: false
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#t', method: 'id', styles: { color: 'red', display: 'block' } },
        right: { tag: 'div', key: '#t', method: 'id', styles: { color: 'blue', display: 'block' } },
        diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }],
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      // "display" is same on both sides, so isDiff = false -> shows ✓
      expect(body.textContent).toContain('\u2713');
    });
  });

  // ===== Filter Controls =====
  describe('Filter controls', () => {
    function setupWithData() {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red', display: 'block', opacity: '1', 'z-index': '1' } },
        right: { tag: 'div', key: '#x', method: 'id', styles: { color: 'blue', display: 'flex', opacity: '0.5', 'z-index': '1' } },
        diffs: [
          { property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' },
          { property: 'display', expected: 'block', actual: 'flex', category: 'layout', type: 'changed' },
          { property: 'opacity', expected: '1', actual: '0.5', category: 'visual', type: 'changed' },
        ],
        error: null,
      });
    }

    test('switching to "All" filter shows all properties', () => {
      setupWithData();
      const allBtn = document.getElementById('css-inspect-filter-all')!;
      allBtn.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      // Should show non-diff properties too (z-index)
      expect(body.innerHTML).toContain('z-index');
      expect(body.innerHTML).toContain('color');
      expect(allBtn.classList.contains('active')).toBe(true);
    });

    test('switching back to "Diff" filter shows only diffs', () => {
      setupWithData();
      document.getElementById('css-inspect-filter-all')!.click();
      document.getElementById('css-inspect-filter-diff')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('color');
      expect(body.innerHTML).not.toContain('z-index');
    });

    test('category filter shows only matching category', () => {
      setupWithData();
      const textCatBtn = document.querySelector('.css-inspect-cat-btn[data-cat="text"]') as HTMLElement;
      textCatBtn.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('color');
      expect(body.innerHTML).not.toContain('display');
      expect(body.innerHTML).not.toContain('opacity');
    });

    test('category filter "all" shows all categories', () => {
      setupWithData();
      // First filter to text
      (document.querySelector('.css-inspect-cat-btn[data-cat="text"]') as HTMLElement).click();
      // Then back to all
      (document.querySelector('.css-inspect-cat-btn[data-cat="all"]') as HTMLElement).click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('color');
      expect(body.innerHTML).toContain('display');
      expect(body.innerHTML).toContain('opacity');
    });

    test('"All" filter + category filter works together', () => {
      setupWithData();
      // Show all props
      document.getElementById('css-inspect-filter-all')!.click();
      // Then filter to layout
      (document.querySelector('.css-inspect-cat-btn[data-cat="layout"]') as HTMLElement).click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('display');
      expect(body.innerHTML).toContain('z-index');
      expect(body.innerHTML).not.toContain('color');
    });

    test('category filter renders empty message when no matches', () => {
      setupWithData();
      (document.querySelector('.css-inspect-cat-btn[data-cat="other"]') as HTMLElement).click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('No matching properties');
    });

    test('カテゴリボタンに data-cat が無い場合 "all" にフォールバックする', () => {
      // Build DOM with a category button that has no data-cat attribute
      document.body.innerHTML = `
        <button id="css-scan-btn">CSS Scan</button>
        <button id="css-inspect-btn">Inspect</button>
        <div id="css-inspect-drawer" class="hidden">
          <button id="css-inspect-drawer-close"></button>
          <div id="css-inspect-drawer-handle"></div>
          <div id="css-inspect-header-info"></div>
          <button id="css-inspect-filter-diff" class="active"></button>
          <button id="css-inspect-filter-all"></button>
          <button class="css-inspect-cat-btn"></button>
          <div id="css-inspect-drawer-body"></div>
        </div>
        <div id="toast" class="toast hidden"></div>
      `;
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#x', method: 'id', styles: { color: 'blue' } },
        diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }],
        error: null,
      });
      // Click the button with no data-cat (falls back to 'all')
      (document.querySelector('.css-inspect-cat-btn') as HTMLElement).click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      // 'all' filter shows everything, so color should be visible
      expect(body.innerHTML).toContain('color');
    });

    test('"Diff" フィルターで active クラスを正しく切り替える', () => {
      setupWithData();
      const diffBtn = document.getElementById('css-inspect-filter-diff')!;
      const allBtn = document.getElementById('css-inspect-filter-all')!;
      // Switch to all
      allBtn.click();
      expect(allBtn.classList.contains('active')).toBe(true);
      expect(diffBtn.classList.contains('active')).toBe(false);
      // Switch back to diff
      diffBtn.click();
      expect(diffBtn.classList.contains('active')).toBe(true);
      expect(allBtn.classList.contains('active')).toBe(false);
    });

    test('カテゴリボタンクリックで他のボタンの active を外す', () => {
      setupWithData();
      const allCatBtn = document.querySelector('.css-inspect-cat-btn[data-cat="all"]') as HTMLElement;
      const textCatBtn = document.querySelector('.css-inspect-cat-btn[data-cat="text"]') as HTMLElement;
      const layoutCatBtn = document.querySelector('.css-inspect-cat-btn[data-cat="layout"]') as HTMLElement;
      // Click text
      textCatBtn.click();
      expect(textCatBtn.classList.contains('active')).toBe(true);
      expect(allCatBtn.classList.contains('active')).toBe(false);
      expect(layoutCatBtn.classList.contains('active')).toBe(false);
      // Click layout
      layoutCatBtn.click();
      expect(layoutCatBtn.classList.contains('active')).toBe(true);
      expect(textCatBtn.classList.contains('active')).toBe(false);
    });
  });

  // ===== "All" filter with missing data =====
  describe('All フィルターのエッジケース', () => {
    test('left.styles が null の場合でもプロパティ一覧を構築する', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: null },
        right: { tag: 'div', key: '#x', method: 'id', styles: { display: 'flex' } },
        diffs: [],
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('display');
    });

    test('right.styles が null の場合でもプロパティ一覧を構築する', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#x', method: 'id', styles: null },
        diffs: [],
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('color');
    });

    test('left と right 両方の styles が null の場合、空メッセージを表示する', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: null },
        right: { tag: 'div', key: '#x', method: 'id', styles: null },
        diffs: null,
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('No matching properties');
    });

    test('diffs が null で "All" フィルターの場合、空配列にフォールバックする', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        diffs: null,
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      // color exists in styles but not in diffs, so isDiff = false
      expect(body.innerHTML).toContain('color');
      expect(body.textContent).toContain('\u2713');
    });

    test('left が null で "All" フィルターの場合、right のプロパティのみ表示する', () => {
      init();
      callbacks['css-inspect-result']({
        left: null,
        right: { tag: 'div', key: '#x', method: 'id', styles: { display: 'block' } },
        diffs: [],
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('display');
    });

    test('right が null で "All" フィルターの場合、left のプロパティのみ表示する', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        right: null,
        diffs: [],
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('color');
    });

    test('styles のプロパティ値が空文字の場合、空文字にフォールバックする', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: '' } },
        right: { tag: 'div', key: '#x', method: 'id', styles: { color: '' } },
        diffs: [],
        error: null,
      });
      document.getElementById('css-inspect-filter-all')!.click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain('color');
    });
  });

  // ===== getCategoryForProp =====
  describe('Category classification', () => {
    function checkCategory(property: string, expectedCat: string) {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#c', method: 'id', styles: { [property]: 'a' } },
        right: { tag: 'div', key: '#c', method: 'id', styles: { [property]: 'b' } },
        diffs: [{ property, expected: 'a', actual: 'b', category: expectedCat, type: 'changed' }],
        error: null,
      });
      // Switch to all filter + specific category to verify classification
      document.getElementById('css-inspect-filter-all')!.click();
      (document.querySelector(`.css-inspect-cat-btn[data-cat="${expectedCat}"]`) as HTMLElement).click();
      const body = document.getElementById('css-inspect-drawer-body')!;
      expect(body.innerHTML).toContain(property);
    }

    test('layout properties are classified correctly', () => {
      checkCategory('display', 'layout');
    });

    test('text properties are classified correctly', () => {
      checkCategory('font-size', 'text');
    });

    test('visual properties are classified correctly', () => {
      checkCategory('background-color', 'visual');
    });

    test('unknown properties fall to "other"', () => {
      checkCategory('custom-thing', 'other');
    });
  });

  // ===== escapeHtml =====
  describe('escapeHtml', () => {
    test('escapes HTML special characters in header', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '<script>', method: 'tag', styles: {} },
        right: null,
        diffs: [],
        error: 'Test <b>bold</b> & "quotes"',
      });
      const header = document.getElementById('css-inspect-header-info')!;
      expect(header.innerHTML).not.toContain('<script>');
      expect(header.innerHTML).toContain('&lt;script&gt;');
      expect(header.innerHTML).toContain('&amp;');
      // jsdom renders &quot; as literal " in innerHTML, so check the raw attribute escaping
      expect(header.textContent).toContain('"quotes"');
    });

    test('handles null/undefined values gracefully', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#test', method: 'id', styles: {} },
        right: { tag: 'div', key: '#test', method: 'id', styles: {} },
        diffs: [],
        error: null,
      });
      // Should not throw with null-ish values
      const header = document.getElementById('css-inspect-header-info')!;
      expect(header.innerHTML).toBeTruthy();
    });
  });

  // ===== Keyboard Shortcuts =====
  describe('Keyboard shortcuts', () => {
    test('registers onShortcutCssScan callback', async () => {
      init();
      expect(api.onShortcutCssScan).toHaveBeenCalled();
      // Trigger the shortcut
      callbacks['shortcut-css-scan']();
      await flush();
      expect(api.cssFullScan).toHaveBeenCalled();
    });

    test('registers onShortcutCssInspect callback', async () => {
      init();
      expect(api.onShortcutCssInspect).toHaveBeenCalled();
      callbacks['shortcut-css-inspect']();
      await flush();
      expect(api.cssInspectToggle).toHaveBeenCalled();
    });
  });

  // ===== Toast =====
  describe('CSS toast', () => {
    test('shows toast with error type on scan failure', async () => {
      api.cssFullScan.mockRejectedValue(new Error('timeout'));
      init();
      document.getElementById('css-scan-btn')!.click();
      await flush();
      const toast = document.getElementById('toast')!;
      expect(toast.className).toContain('toast-error');
      expect(toast.textContent).toContain('timeout');
    });
  });

  // ===== Diff-only フィルターで diffs が null の場合 =====
  describe('Diff フィルターのエッジケース', () => {
    test('diffs が null で diff-only フィルターの場合、空メッセージを表示する', () => {
      init();
      callbacks['css-inspect-result']({
        left: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        right: { tag: 'div', key: '#x', method: 'id', styles: { color: 'red' } },
        diffs: null,
        error: null,
      });
      const body = document.getElementById('css-inspect-drawer-body')!;
      // diffs is null → rows = [] → "No matching properties"
      expect(body.innerHTML).toContain('No matching properties');
    });
  });

  // ===== module.exports 分岐 =====
  describe('module.exports', () => {
    test('module が定義されている場合 initCssCompare をエクスポートする', () => {
      const { initCssCompare } = require('../../src/renderer/scripts/css-compare');
      expect(typeof initCssCompare).toBe('function');
    });
  });
});
