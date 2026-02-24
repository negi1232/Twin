export {};

const { createSyncManager, SYNC_PREFIX, INJECTION_SCRIPT, HEALTH_CHECK_INTERVAL, HOVER_REPLAY_INTERVAL, escapeForScript } = require('../../src/main/sync-manager');

function createMockDebugger() {
  const dbgListeners: Record<string, any[]> = {};
  return {
    isAttached: jest.fn(() => false),
    attach: jest.fn(),
    detach: jest.fn(),
    sendCommand: jest.fn().mockImplementation((cmd: string) => {
      if (cmd === 'DOM.getDocument') return Promise.resolve({ root: { nodeId: 1 } });
      if (cmd === 'DOM.querySelector') return Promise.resolve({ nodeId: 2 });
      return Promise.resolve({});
    }),
    on: jest.fn((event: any, cb: any) => {
      if (!dbgListeners[event]) dbgListeners[event] = [];
      dbgListeners[event].push(cb);
    }),
    removeListener: jest.fn((event: any, cb: any) => {
      if (dbgListeners[event]) {
        dbgListeners[event] = dbgListeners[event].filter((l: any) => l !== cb);
      }
    }),
    _listeners: dbgListeners,
  };
}

function createMockView() {
  const listeners: Record<string, any[]> = {};
  return {
    webContents: {
      on: jest.fn((event: any, cb: any) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeListener: jest.fn((event: any, cb: any) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l: any) => l !== cb);
        }
      }),
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      sendInputEvent: jest.fn(),
      isDestroyed: jest.fn(() => false),
      getZoomFactor: jest.fn(() => 1.0),
      getURL: jest.fn(() => 'http://localhost:3001/'),
      loadURL: jest.fn().mockResolvedValue(undefined),
      debugger: createMockDebugger(),
    },
    _listeners: listeners,
    _emit(event: any, ...args: any[]) {
      (listeners[event] || []).forEach((cb: any) => cb(...args));
    },
  };
}

describe('SyncManager', () => {
  let leftView: any;
  let rightView: any;
  let manager: any;

  beforeEach(() => {
    leftView = createMockView();
    rightView = createMockView();
    manager = createSyncManager(leftView, rightView);
  });

  test('isEnabled returns true by default', () => {
    expect(manager.isEnabled()).toBe(true);
  });

  test('setEnabled toggles sync state', () => {
    manager.setEnabled(false);
    expect(manager.isEnabled()).toBe(false);
    manager.setEnabled(true);
    expect(manager.isEnabled()).toBe(true);
  });

  test('start registers did-finish-load and console-message listeners', () => {
    manager.start();
    expect(leftView.webContents.on).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    expect(leftView.webContents.on).toHaveBeenCalledWith('console-message', expect.any(Function));
  });

  test('stop removes listeners', () => {
    manager.start();
    manager.stop();
    expect(leftView.webContents.removeListener).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    expect(leftView.webContents.removeListener).toHaveBeenCalledWith('console-message', expect.any(Function));
  });

  test('inject executes JavaScript on left view', () => {
    manager.inject();
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  // --- Scroll sync ---
  test('scroll message replays scrollTo on right view', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 100, scrollY: 200 } });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledWith(
      'window.scrollTo(100, 200)'
    );
  });

  // --- Element scroll sync (modals, horizontal overflow) ---
  test('elementscroll message replays scrollLeft and scrollTop on matching element', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.modal-body', scrollLeft: 50, scrollTop: 300 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('.modal-body');
    expect(script).toContain('scrollLeft=50');
    expect(script).toContain('scrollTop=300');
  });

  test('elementscroll handles horizontal-only scroll', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.table-wrapper', scrollLeft: 200, scrollTop: 0 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('.table-wrapper');
    expect(script).toContain('scrollLeft=200');
  });

  test('elementscroll ignores non-finite scrollLeft', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.box', scrollLeft: null, scrollTop: 0 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('elementscroll ignores non-finite scrollTop', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.box', scrollLeft: 0, scrollTop: 'abc' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('elementscroll escapes special characters in selector', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: "#it\\'s", scrollLeft: 0, scrollTop: 10 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  test('elementscroll handles executeJavaScript rejection gracefully', async () => {
    rightView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('fail'));
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.modal', scrollLeft: 0, scrollTop: 100 },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
  });

  // --- Element scroll sync with form elements inside modals ---
  test('elementscroll works for a modal container with form elements inside', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.modal-dialog > .modal-body', scrollLeft: 0, scrollTop: 450 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('.modal-dialog > .modal-body');
    expect(script).toContain('scrollTop=450');
  });

  test('elementscroll and inputvalue can work independently for same modal', () => {
    // Scroll the modal body
    const scrollMsg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.modal-body', scrollLeft: 0, scrollTop: 200 },
    });
    manager._handleMessage(null, 0, scrollMsg);

    // Input value in a form field inside the modal
    const inputMsg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '.modal-body input#email', value: 'test@example.com' },
    });
    manager._handleMessage(null, 0, inputMsg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(2);
    const scrollScript = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(scrollScript).toContain('scrollTop=200');
    const inputScript = rightView.webContents.executeJavaScript.mock.calls[1][0];
    expect(inputScript).toContain('test@example.com');
  });

  test('elementscroll works for form element used as scroll container', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: 'form.signup-form', scrollLeft: 0, scrollTop: 800 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('form.signup-form');
    expect(script).toContain('scrollTop=800');
  });

  test('elementscroll for modal with both vertical and horizontal scroll', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.modal-body', scrollLeft: 120, scrollTop: 350 },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('scrollLeft=120');
    expect(script).toContain('scrollTop=350');
  });

  // --- Hover sync (element-based) ---
  test('hover message finds element on right view and sends mouseMove to its center', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 150, y: 200 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#my-btn' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('#my-btn')
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseMove', x: 150, y: 200 })
    );
  });

  test('hover message does nothing when element not found on right view', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce(null);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#missing' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  test('hover message handles executeJavaScript rejection gracefully', async () => {
    rightView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('fail'));
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#btn' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  // --- Click sync (element-based) ---
  test('click message finds element on right view and sends mouseDown + mouseUp', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 100, y: 50 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'left' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('#btn')
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', x: 100, y: 50, button: 'left' })
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseUp', x: 100, y: 50, button: 'left' })
    );
  });

  test('click message does nothing when element not found on right view', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce(null);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#missing', button: 'left' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  test('click message handles executeJavaScript rejection gracefully', async () => {
    rightView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('fail'));
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'left' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  // --- Click sync with zoom ---
  test('click at zoom 1.5x scales coordinates by zoom factor', async () => {
    rightView.webContents.getZoomFactor.mockReturnValue(1.5);
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 100, y: 50 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'left' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', x: 150, y: 75, button: 'left' })
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseUp', x: 150, y: 75, button: 'left' })
    );
  });

  test('click at zoom 0.5x scales coordinates down', async () => {
    rightView.webContents.getZoomFactor.mockReturnValue(0.5);
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 200, y: 100 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#link', button: 'left' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', x: 100, y: 50 })
    );
  });

  // --- Hover sync with zoom ---
  test('hover at zoom 1.5x scales coordinates by zoom factor', async () => {
    rightView.webContents.getZoomFactor.mockReturnValue(1.5);
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 100, y: 200 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#btn' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseMove', x: 150, y: 300 })
    );
  });

  test('hover at zoom 0.5x scales coordinates down', async () => {
    rightView.webContents.getZoomFactor.mockReturnValue(0.5);
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 200, y: 100 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#nav' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseMove', x: 100, y: 50 })
    );
  });

  // --- Key sync ---
  test('keydown for printable char sends keyDown + char', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keydown',
      data: { key: 'a', code: 'KeyA', keyCode: 65, shift: false, ctrl: false, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(2);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown', modifiers: [] })
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'char', keyCode: 'a', modifiers: [] })
    );
  });

  test('keydown for non-printable key (Enter) sends only keyDown', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keydown',
      data: { key: 'Enter', code: 'Enter', keyCode: 13, shift: false, ctrl: false, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(1);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown' })
    );
  });

  test('keydown with modifiers passes them through', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keydown',
      data: { key: 'A', code: 'KeyA', keyCode: 65, shift: true, ctrl: true, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown', modifiers: ['shift', 'control'] })
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'char', keyCode: 'A', modifiers: ['shift', 'control'] })
    );
  });

  test('keyup message replays keyUp only (no char)', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keyup',
      data: { key: 'a', code: 'KeyA', keyCode: 65, shift: false, ctrl: false, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(1);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyUp' })
    );
  });

  // --- Input value sync ---
  test('inputvalue message sets value on right view via executeJavaScript', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#search', value: 'こんにちは' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('#search');
    expect(script).toContain('こんにちは');
  });

  test('inputvalue for contenteditable sets textContent', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '.editor', textContent: 'テスト' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('textContent');
    expect(script).toContain('テスト');
  });

  test('inputvalue escapes special characters in value', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#q', value: "it's a \"test\"\nline2" },
    });
    manager._handleMessage(null, 0, msg);

    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain("\\'");
    expect(script).toContain('\\n');
  });

  // --- Paste with special characters (backticks, template expressions) ---
  test('inputvalue escapes backticks in pasted value', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#code', value: 'const x = `hello`' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('\\`hello\\`');
    expect(script).not.toMatch(/[^\\]`hello/);
  });

  test('inputvalue escapes template expressions in pasted value', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#code', value: 'price is ${amount}' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('\\${amount}');
  });

  test('inputvalue escapes mixed special characters from paste', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#editor', value: "line1\nconst tpl = `${name}'s value`" },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('\\n');
    expect(script).toContain('\\`');
    expect(script).toContain('\\$');
    expect(script).toContain("\\'");
  });

  test('inputvalue for contenteditable escapes backticks in pasted HTML', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '.editor', textContent: 'code: `example` done' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('\\`example\\`');
  });

  // --- Textarea native setter ---
  test('inputvalue uses HTMLTextAreaElement setter for textarea elements', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: 'textarea#comment', value: 'line1\nline2' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain("el.tagName === 'TEXTAREA'");
    expect(script).toContain('HTMLTextAreaElement.prototype');
    expect(script).toContain('HTMLInputElement.prototype');
  });

  test('inputvalue sets value on textarea with multiline pasted text', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: 'textarea.modal-textarea', value: 'first\nsecond\nthird' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('textarea.modal-textarea');
    expect(script).toContain('first\\nsecond\\nthird');
  });

  // --- Navigation sync suppression ---
  test('isNavSyncSuppressed returns false by default', () => {
    expect(manager.isNavSyncSuppressed()).toBe(false);
  });

  test('click replay suppresses nav sync', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 10, y: 20 });
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'click',
      data: { selector: '#search-btn', button: 'left' },
    });
    manager._handleMessage(null, 0, msg);

    expect(manager.isNavSyncSuppressed()).toBe(true);
  });

  // --- Navigate sync (SPA navigation) ---
  test('navigate message replays loadURL on right view with updated pathname', () => {
    rightView.webContents.getURL.mockReturnValue('http://localhost:3001/');
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'http://localhost:3000/about', pathname: '/about' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).toHaveBeenCalledWith('http://localhost:3001/about');
  });

  test('navigate message preserves search and hash from left URL', () => {
    rightView.webContents.getURL.mockReturnValue('http://localhost:3001/');
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'http://localhost:3000/page?q=test#section', pathname: '/page' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).toHaveBeenCalledWith('http://localhost:3001/page?q=test#section');
  });

  test('navigate is suppressed when navSyncSuppressed is true', () => {
    manager.suppressNavSync();
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'http://localhost:3000/about', pathname: '/about' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).not.toHaveBeenCalled();
  });

  test('navigate does not replay when disabled', () => {
    manager.setEnabled(false);
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'http://localhost:3000/about', pathname: '/about' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).not.toHaveBeenCalled();
  });

  test('navigate does not replay when paused', () => {
    manager.pause();
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'http://localhost:3000/about', pathname: '/about' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).not.toHaveBeenCalled();
  });

  test('navigate handles loadURL rejection gracefully', async () => {
    rightView.webContents.getURL.mockReturnValue('http://localhost:3001/');
    rightView.webContents.loadURL.mockRejectedValueOnce(new Error('load failed'));
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'http://localhost:3000/about', pathname: '/about' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
  });

  test('navigate handles invalid URL gracefully', () => {
    rightView.webContents.getURL.mockReturnValue('not-a-valid-url');
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'navigate',
      data: { url: 'also-not-valid', pathname: '/about' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.loadURL).not.toHaveBeenCalled();
  });

  test('nav sync suppression expires after timeout', () => {
    jest.useFakeTimers();
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 10, y: 20 });
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'click',
      data: { selector: '#btn', button: 'left' },
    });
    manager._handleMessage(null, 0, msg);

    expect(manager.isNavSyncSuppressed()).toBe(true);
    jest.advanceTimersByTime(500);
    expect(manager.isNavSyncSuppressed()).toBe(false);
    jest.useRealTimers();
  });

  // --- Pause / Resume ---
  test('isPaused returns false by default', () => {
    expect(manager.isPaused()).toBe(false);
  });

  test('pause sets paused state to true', () => {
    manager.pause();
    expect(manager.isPaused()).toBe(true);
  });

  test('resume sets paused state to false', () => {
    manager.pause();
    manager.resume();
    expect(manager.isPaused()).toBe(false);
  });

  test('does not replay when paused', () => {
    manager.pause();
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: 0 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('resumes replaying after resume', () => {
    manager.pause();
    manager.resume();
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 10, scrollY: 20 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollTo(10, 20)');
  });

  test('pause and enabled are independent', () => {
    manager.pause();
    manager.setEnabled(true);
    expect(manager.isPaused()).toBe(true);
    expect(manager.isEnabled()).toBe(true);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: 0 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('pause is idempotent', () => {
    manager.pause();
    manager.pause();
    expect(manager.isPaused()).toBe(true);
  });

  test('resume is idempotent', () => {
    manager.resume();
    expect(manager.isPaused()).toBe(false);
  });

  // --- Disabled ---
  test('does not replay when disabled', () => {
    manager.setEnabled(false);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: 0 } });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  // --- Ignore non-sync messages ---
  test('ignores non-sync console messages', () => {
    manager._handleMessage(null, 0, 'Hello world');
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  test('ignores malformed JSON', () => {
    manager._handleMessage(null, 0, SYNC_PREFIX + 'not-json');
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  // --- click with unknown button ---
  test('click with unknown button defaults to left', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 10, y: 20 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#link', button: 'unknown' } });
    manager._handleMessage(null, 0, msg);

    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', button: 'left' })
    );
  });

  // --- rightView destroyed ---
  test('does not replay when rightView is destroyed', () => {
    rightView.webContents.isDestroyed.mockReturnValue(true);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: 0 } });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  // --- inject on destroyed leftView ---
  test('inject does nothing when leftView is destroyed', () => {
    leftView.webContents.isDestroyed.mockReturnValue(true);
    manager.inject();
    // inject was already called once in setup? No, just check the call after destroy
    leftView.webContents.executeJavaScript.mockClear();
    manager.inject();
    expect(leftView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  // --- inject on null leftView ---
  test('inject does nothing when leftView is null', () => {
    const nullManager = createSyncManager(null, rightView);
    nullManager.inject();
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  // --- start on null leftView ---
  test('start does nothing when leftView is null', () => {
    const nullManager = createSyncManager(null, rightView);
    nullManager.start(); // should not throw
  });

  // --- stop on destroyed leftView ---
  test('stop does nothing when leftView is destroyed', () => {
    manager.start();
    leftView.webContents.isDestroyed.mockReturnValue(true);
    manager.stop(); // should not throw
  });

  // --- did-finish-load triggers inject ---
  test('did-finish-load event triggers script injection', () => {
    manager.start();
    leftView.webContents.executeJavaScript.mockClear();
    leftView._emit('did-finish-load');
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  // --- alt / meta modifiers ---
  test('keydown with alt and meta modifiers passes them through', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keydown',
      data: { key: 'a', code: 'KeyA', keyCode: 65, shift: false, ctrl: false, alt: true, meta: true },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown', modifiers: ['alt', 'meta'] })
    );
  });

  // --- .catch() callbacks for rejection handling ---
  test('replayScroll handles executeJavaScript rejection gracefully', async () => {
    rightView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('fail'));
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: 0 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalled();
    // Wait for rejected promise to settle
    await new Promise((r) => setTimeout(r, 0));
  });

  test('replayInputValue handles executeJavaScript rejection gracefully', async () => {
    rightView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('fail'));
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#q', value: 'test' },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
  });

  test('inject handles executeJavaScript rejection gracefully', async () => {
    leftView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('fail'));
    manager.inject();
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
  });

  // --- Health check ---
  test('health check runs periodically after start', () => {
    jest.useFakeTimers();
    manager.start();
    leftView.webContents.executeJavaScript.mockClear();

    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL);
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalledWith('!!window.__twinSyncInjected');
    jest.useRealTimers();
  });

  test('health check re-injects when script is not alive', async () => {
    jest.useFakeTimers();
    manager.start();
    leftView.webContents.executeJavaScript.mockClear();

    // Health check returns false (script not injected)
    leftView.webContents.executeJavaScript.mockResolvedValueOnce(false);
    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL);

    // Flush the promise
    await Promise.resolve();
    await Promise.resolve();

    // Second call should be the re-injection (INJECTION_SCRIPT)
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });

  test('health check skips re-inject when script is alive', async () => {
    jest.useFakeTimers();
    manager.start();
    leftView.webContents.executeJavaScript.mockClear();

    // Health check returns true (script is alive)
    leftView.webContents.executeJavaScript.mockResolvedValueOnce(true);
    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL);

    await Promise.resolve();
    await Promise.resolve();

    // Only the health check call, no re-injection
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('health check skips when leftView is destroyed', () => {
    jest.useFakeTimers();
    manager.start();
    leftView.webContents.executeJavaScript.mockClear();

    leftView.webContents.isDestroyed.mockReturnValue(true);
    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL);

    expect(leftView.webContents.executeJavaScript).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('stop clears health check interval', () => {
    jest.useFakeTimers();
    manager.start();
    manager.stop();
    leftView.webContents.executeJavaScript.mockClear();

    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL * 3);
    expect(leftView.webContents.executeJavaScript).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('health check handles executeJavaScript rejection gracefully', () => {
    jest.useFakeTimers();
    manager.start();
    leftView.webContents.executeJavaScript.mockClear();

    leftView.webContents.executeJavaScript.mockRejectedValueOnce(new Error('navigating'));
    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL);

    // Should not throw
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('health check does not start duplicate intervals', () => {
    jest.useFakeTimers();
    manager.start();
    manager.start(); // second call should not create another interval
    leftView.webContents.executeJavaScript.mockClear();

    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL);
    // Only one health check call (not two)
    expect(leftView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('health check does not start when leftView is null', () => {
    jest.useFakeTimers();
    const nullManager = createSyncManager(null, rightView);
    nullManager.start();

    jest.advanceTimersByTime(HEALTH_CHECK_INTERVAL * 3);
    // No health check calls since start() returned early
    expect(leftView.webContents.executeJavaScript).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  // --- File upload sync via CDP ---
  describe('replayFileChange', () => {
    test('sets files on right view via CDP', async () => {
      const data = { selector: '#file-input', paths: ['/tmp/a.txt'], names: ['a.txt'] };
      await manager._replayFileChange(data);

      const dbg = rightView.webContents.debugger;
      expect(dbg.attach).toHaveBeenCalledWith('1.3');
      expect(dbg.sendCommand).toHaveBeenCalledWith('DOM.getDocument');
      expect(dbg.sendCommand).toHaveBeenCalledWith('DOM.querySelector', {
        nodeId: 1,
        selector: '#file-input',
      });
      expect(dbg.sendCommand).toHaveBeenCalledWith('DOM.setFileInputFiles', {
        nodeId: 2,
        files: ['/tmp/a.txt'],
      });
      expect(dbg.detach).toHaveBeenCalled();
    });

    test('returns early when paths are empty and no pendingFilePaths', async () => {
      await manager._replayFileChange({ selector: '#file-input', paths: [], names: [] });
      expect(rightView.webContents.debugger.attach).not.toHaveBeenCalled();
    });

    test('skips when nodeId is 0', async () => {
      rightView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'DOM.getDocument') return Promise.resolve({ root: { nodeId: 1 } });
        if (cmd === 'DOM.querySelector') return Promise.resolve({ nodeId: 0 });
        return Promise.resolve({});
      });

      await manager._replayFileChange({ selector: '#missing', paths: ['/tmp/a.txt'], names: ['a.txt'] });

      expect(rightView.webContents.debugger.sendCommand).not.toHaveBeenCalledWith(
        'DOM.setFileInputFiles',
        expect.anything(),
      );
      expect(rightView.webContents.debugger.detach).toHaveBeenCalled();
    });

    test('handles error gracefully', async () => {
      rightView.webContents.debugger.sendCommand.mockRejectedValue(new Error('CDP error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await manager._replayFileChange({ selector: '#file', paths: ['/tmp/a.txt'], names: ['a.txt'] });

      expect(consoleSpy).toHaveBeenCalledWith('Sync file replay failed:', 'CDP error');
      expect(rightView.webContents.debugger.detach).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleCDPEvent', () => {
    let mockShowOpenDialog: jest.Mock;
    let mgr: any;

    beforeEach(() => {
      mockShowOpenDialog = jest.fn();
      mgr = createSyncManager(leftView, rightView, mockShowOpenDialog);

      leftView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'DOM.setFileInputFiles') return Promise.resolve({});
        if (cmd === 'DOM.getDocument') return Promise.resolve({ root: { nodeId: 1 } });
        if (cmd === 'DOM.querySelector') return Promise.resolve({ nodeId: 2 });
        if (cmd === 'DOM.resolveNode') return Promise.resolve({ object: { objectId: 'obj-1' } });
        if (cmd === 'Runtime.callFunctionOn') return Promise.resolve({ result: { value: '#file-input' } });
        return Promise.resolve({});
      });

      rightView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'DOM.getDocument') return Promise.resolve({ root: { nodeId: 1 } });
        if (cmd === 'DOM.querySelector') return Promise.resolve({ nodeId: 2 });
        return Promise.resolve({});
      });
    });

    test('ignores non-Page.fileChooserOpened events', async () => {
      await mgr._handleCDPEvent(null, 'Network.requestWillBeSent', {});
      expect(leftView.webContents.debugger.sendCommand).not.toHaveBeenCalled();
      expect(mockShowOpenDialog).not.toHaveBeenCalled();
    });

    test('ignores event when disabled', async () => {
      mgr.setEnabled(false);
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });
      expect(mockShowOpenDialog).not.toHaveBeenCalled();
    });

    test('ignores event when paused', async () => {
      mgr.pause();
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });
      expect(mockShowOpenDialog).not.toHaveBeenCalled();
    });

    test('re-entrancy guard ignores second event', async () => {
      let resolveFirst: (v: any) => void;
      const firstCallPromise = new Promise((r) => { resolveFirst = r; });
      mockShowOpenDialog.mockReturnValueOnce(firstCallPromise);

      const first = mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 11 });

      expect(mockShowOpenDialog).toHaveBeenCalledTimes(1);

      resolveFirst!({ canceled: true, filePaths: [] });
      await first;
    });

    test('shows own dialog on fileChooserOpened event', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/test.txt'] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });

      expect(mockShowOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile'],
      });
    });

    test('sets files on left view via DOM.setFileInputFiles with backendNodeId', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/doc.pdf'] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 42 });

      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith(
        'DOM.setFileInputFiles',
        { backendNodeId: 42, files: ['/tmp/doc.pdf'] },
      );
    });

    test('gets selector from backendNodeId and syncs to right view', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/photo.jpg'] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });

      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith(
        'DOM.resolveNode',
        { backendNodeId: 10 },
      );
      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith(
        'Runtime.callFunctionOn',
        expect.objectContaining({ objectId: 'obj-1', returnByValue: true }),
      );
      expect(rightView.webContents.debugger.sendCommand).toHaveBeenCalledWith(
        'DOM.setFileInputFiles',
        expect.objectContaining({ files: ['/tmp/photo.jpg'] }),
      );
    });

    test('sets skipNextFileChangeMessage flag', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.txt'] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });

      const msg = SYNC_PREFIX + JSON.stringify({
        type: 'filechange',
        data: { selector: '#file-input', paths: ['/tmp/a.txt'], names: ['a.txt'] },
      });

      rightView.webContents.debugger.sendCommand.mockClear();
      rightView.webContents.debugger.attach.mockClear();
      mgr._handleMessage(null, 0, msg);

      expect(rightView.webContents.debugger.attach).not.toHaveBeenCalled();
    });

    test('handles user cancelling own dialog', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });

      expect(leftView.webContents.debugger.sendCommand).not.toHaveBeenCalledWith(
        'DOM.setFileInputFiles',
        expect.anything(),
      );
    });

    test('shows multiSelections when mode is selectMultiple', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.txt', '/tmp/b.txt'] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', {
        backendNodeId: 10,
        mode: 'selectMultiple',
      });

      expect(mockShowOpenDialog).toHaveBeenCalledWith({
        properties: ['openFile', 'multiSelections'],
      });
    });

    test('handles outer error gracefully and resets fileChooserHandling', async () => {
      mockShowOpenDialog.mockRejectedValueOnce(new Error('Dialog crashed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });
      expect(consoleSpy).toHaveBeenCalledWith('File chooser handling failed:', 'Dialog crashed');

      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', { backendNodeId: 10 });
      expect(mockShowOpenDialog).toHaveBeenCalledTimes(2);

      consoleSpy.mockRestore();
    });

    test('skips left view DOM.setFileInputFiles when no backendNodeId', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/a.txt'] });
      await mgr._handleCDPEvent(null, 'Page.fileChooserOpened', {});

      const setFileCalls = leftView.webContents.debugger.sendCommand.mock.calls.filter(
        (c: any[]) => c[0] === 'DOM.setFileInputFiles',
      );
      expect(setFileCalls).toHaveLength(0);
    });
  });

  describe('INJECTION_SCRIPT file upload features', () => {
    test('disables showOpenFilePicker', () => {
      expect(INJECTION_SCRIPT).toContain('showOpenFilePicker = undefined');
    });

    test('click handler skips file inputs', () => {
      expect(INJECTION_SCRIPT).toContain("el.tagName === 'INPUT' && el.type === 'file'");
      expect(INJECTION_SCRIPT).toContain('input[type="file"]');
    });

    test('sends filechange on file input change', () => {
      expect(INJECTION_SCRIPT).toContain("send('filechange'");
      expect(INJECTION_SCRIPT).toContain("el.type !== 'file'");
    });
  });

  describe('setupFileChooserInterception', () => {
    test('attaches debugger on inject', () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      leftView.webContents.debugger.sendCommand.mockResolvedValue({});
      manager.inject();
      expect(leftView.webContents.debugger.attach).toHaveBeenCalledWith('1.3');
    });

    test('does not re-attach if debugger already attached', () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(true);
      leftView.webContents.debugger.sendCommand.mockResolvedValue({});
      manager.inject();
      expect(leftView.webContents.debugger.attach).not.toHaveBeenCalled();
    });

    test('handles attach failure gracefully', () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      leftView.webContents.debugger.attach.mockImplementation(() => {
        throw new Error('Another debugger already attached');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      manager.inject();
      expect(consoleSpy).toHaveBeenCalledWith(
        'File chooser interception setup failed:',
        'Another debugger already attached',
      );
      consoleSpy.mockRestore();
    });

    test('handles Page.setInterceptFileChooserDialog rejection', async () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      leftView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'Page.enable') return Promise.resolve({});
        if (cmd === 'Page.setInterceptFileChooserDialog') return Promise.reject(new Error('Not supported'));
        return Promise.resolve({});
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      manager.inject();
      await new Promise((r) => setTimeout(r, 50));
      expect(consoleSpy).toHaveBeenCalledWith(
        'File chooser interception setup failed:',
        'Not supported',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('teardownFileChooserInterception', () => {
    test('detaches debugger on stop when attached', async () => {
      leftView.webContents.debugger.sendCommand.mockResolvedValue({});
      leftView.webContents.debugger.isAttached.mockReturnValue(true);
      manager.start();
      manager.stop();
      await new Promise((r) => setTimeout(r, 50));
      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith(
        'Page.setInterceptFileChooserDialog',
        { enabled: false },
      );
      expect(leftView.webContents.debugger.detach).toHaveBeenCalled();
    });

    test('does nothing when debugger is not attached', () => {
      leftView.webContents.debugger.sendCommand.mockResolvedValue({});
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      manager.start();
      leftView.webContents.debugger.detach.mockClear();
      leftView.webContents.debugger.sendCommand.mockClear();
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      manager.stop();
      const teardownCalls = leftView.webContents.debugger.sendCommand.mock.calls.filter(
        (c: any[]) => c[0] === 'Page.setInterceptFileChooserDialog' && c[1]?.enabled === false,
      );
      expect(teardownCalls).toHaveLength(0);
    });
  });

  // --- filechange message sync ---
  test('filechange message replays file set via CDP', async () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'filechange',
      data: { selector: '#upload', paths: ['/tmp/file.txt'], names: ['file.txt'] },
    });
    manager._handleMessage(null, 0, msg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.debugger.attach).toHaveBeenCalledWith('1.3');
    expect(rightView.webContents.debugger.sendCommand).toHaveBeenCalledWith('DOM.getDocument');
  });
});

describe('escapeForScript', () => {
  test('escapes backslashes', () => {
    expect(escapeForScript('a\\b')).toBe("a\\\\b");
  });

  test('escapes single quotes', () => {
    expect(escapeForScript("it's")).toBe("it\\'s");
  });

  test('escapes backticks', () => {
    expect(escapeForScript('`hello`')).toBe('\\`hello\\`');
  });

  test('escapes dollar signs to prevent template interpolation', () => {
    expect(escapeForScript('${name}')).toBe('\\${name}');
  });

  test('escapes newlines and carriage returns', () => {
    expect(escapeForScript("a\nb\rc")).toBe('a\\nb\\rc');
  });

  test('escapes all special characters together', () => {
    const input = "line1\nconst tpl = `${name}'s value`";
    const result = escapeForScript(input);
    expect(result).toContain('\\n');
    expect(result).toContain('\\`');
    expect(result).toContain('\\$');
    expect(result).toContain("\\'");
    expect(result).not.toContain('\n');
  });

  test('handles empty string', () => {
    expect(escapeForScript('')).toBe('');
  });

  test('returns unchanged for safe strings', () => {
    expect(escapeForScript('hello world 123')).toBe('hello world 123');
  });

  test('escapes only dollar sign (not followed by brace)', () => {
    expect(escapeForScript('$100')).toBe('\\$100');
  });

  test('escapes multiple consecutive backslashes', () => {
    expect(escapeForScript('a\\\\b')).toBe('a\\\\\\\\b');
  });

  test('handles very long strings', () => {
    const long = 'a'.repeat(10000);
    expect(escapeForScript(long)).toBe(long);
  });
});

// --- Additional SyncManager edge case tests ---
describe('SyncManager edge cases', () => {
  let leftView: any;
  let rightView: any;
  let manager: any;

  function createMockView2() {
    const listeners: Record<string, any[]> = {};
    return {
      webContents: {
        on: jest.fn((event: any, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        }),
        removeListener: jest.fn((event: any, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((l: any) => l !== cb);
          }
        }),
        executeJavaScript: jest.fn().mockResolvedValue(undefined),
        sendInputEvent: jest.fn(),
        isDestroyed: jest.fn(() => false),
        getZoomFactor: jest.fn(() => 1.0),
        getURL: jest.fn(() => 'http://localhost:3001/'),
        loadURL: jest.fn().mockResolvedValue(undefined),
        debugger: createMockDebugger(),
      },
      _listeners: listeners,
      _emit(event: any, ...args: any[]) {
        (listeners[event] || []).forEach((cb: any) => cb(...args));
      },
    };
  }

  beforeEach(() => {
    leftView = createMockView2();
    rightView = createMockView2();
    manager = createSyncManager(leftView, rightView);
  });

  test('scroll with NaN scrollX is ignored', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: NaN, scrollY: 100 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('scroll with null scrollY is ignored', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: null } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('scroll with negative values still replays', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: -10, scrollY: -20 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollTo(-10, -20)');
  });

  test('scroll with very large values replays correctly', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 999999, scrollY: 888888 } });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledWith('window.scrollTo(999999, 888888)');
  });

  test('unknown message type is silently ignored', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'unknown', data: {} });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  test('message with empty type is silently ignored', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: '', data: {} });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('click with middle button sends middle button events', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 50, y: 60 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'middle' } });
    manager._handleMessage(null, 0, msg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', button: 'middle' })
    );
  });

  test('click with right button sends right button events', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 50, y: 60 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'right' } });
    manager._handleMessage(null, 0, msg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', button: 'right' })
    );
  });

  test('multiple suppress calls reset the timer', () => {
    jest.useFakeTimers();
    manager.suppressNavSync();
    expect(manager.isNavSyncSuppressed()).toBe(true);
    jest.advanceTimersByTime(400);
    manager.suppressNavSync();
    expect(manager.isNavSyncSuppressed()).toBe(true);
    jest.advanceTimersByTime(400);
    expect(manager.isNavSyncSuppressed()).toBe(true);
    jest.advanceTimersByTime(200);
    expect(manager.isNavSyncSuppressed()).toBe(false);
    jest.useRealTimers();
  });

  test('rapid enable/disable toggling maintains correct state', () => {
    for (let i = 0; i < 10; i++) {
      manager.setEnabled(i % 2 === 0);
    }
    expect(manager.isEnabled()).toBe(false);
    manager.setEnabled(true);
    expect(manager.isEnabled()).toBe(true);
  });

  test('setEnabled coerces truthy values to boolean', () => {
    manager.setEnabled(1);
    expect(manager.isEnabled()).toBe(true);
    manager.setEnabled(0);
    expect(manager.isEnabled()).toBe(false);
    manager.setEnabled('yes');
    expect(manager.isEnabled()).toBe(true);
    manager.setEnabled('');
    expect(manager.isEnabled()).toBe(false);
    manager.setEnabled(null);
    expect(manager.isEnabled()).toBe(false);
  });

  test('keydown with all modifiers sends all modifier flags', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keydown',
      data: { key: 'a', code: 'KeyA', keyCode: 65, shift: true, ctrl: true, alt: true, meta: true },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown', modifiers: ['shift', 'control', 'alt', 'meta'] })
    );
  });

  test('keyup for printable char does NOT send char event', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keyup',
      data: { key: 'z', code: 'KeyZ', keyCode: 90, shift: false, ctrl: false, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(1);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyUp' })
    );
  });

  test('inputvalue with empty value', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '#field', value: '' },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('#field');
  });

  test('inputvalue with empty textContent for contenteditable', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '.editor', textContent: '' },
    });
    manager._handleMessage(null, 0, msg);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('textContent');
  });

  test('sequential scroll and click messages both replay', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValue({ x: 50, y: 50 });
    const scrollMsg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 100, scrollY: 200 } });
    const clickMsg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'left' } });
    manager._handleMessage(null, 0, scrollMsg);
    manager._handleMessage(null, 0, clickMsg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(2);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(2);
  });

  test('hover works when getZoomFactor is not available', async () => {
    rightView.webContents.getZoomFactor = undefined;
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 100, y: 200 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#btn' } });
    manager._handleMessage(null, 0, msg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseMove', x: 100, y: 200 })
    );
  });

  test('INJECTION_SCRIPT contains sync prefix', () => {
    expect(typeof INJECTION_SCRIPT).toBe('string');
    expect(INJECTION_SCRIPT.length).toBeGreaterThan(0);
    expect(INJECTION_SCRIPT).toContain(SYNC_PREFIX);
  });

  test('INJECTION_SCRIPT contains history.pushState monkey-patch', () => {
    expect(INJECTION_SCRIPT).toContain('history.pushState');
    expect(INJECTION_SCRIPT).toContain('history.replaceState');
    expect(INJECTION_SCRIPT).toContain('origPushState');
    expect(INJECTION_SCRIPT).toContain('origReplaceState');
  });

  test('INJECTION_SCRIPT contains popstate listener', () => {
    expect(INJECTION_SCRIPT).toContain('popstate');
    expect(INJECTION_SCRIPT).toContain('notifyNavigation');
  });

  test('SYNC_PREFIX value is correct', () => {
    expect(SYNC_PREFIX).toBe('__twin_sync__');
  });

  test('start can be called multiple times without error', () => {
    manager.start();
    manager.start();
    expect(leftView.webContents.on).toHaveBeenCalled();
  });

  test('stop can be called without start', () => {
    expect(() => manager.stop()).not.toThrow();
  });

  test('messages are ignored when rightView is null', () => {
    const nullManager = createSyncManager(leftView, null);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'scroll', data: { scrollX: 0, scrollY: 0 } });
    nullManager._handleMessage(null, 0, msg);
  });

  test('click replay handles executeJavaScript returning undefined coords', async () => {
    rightView.webContents.executeJavaScript.mockResolvedValueOnce(undefined);
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'left' } });
    manager._handleMessage(null, 0, msg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).not.toHaveBeenCalled();
  });

  test('elementscroll with Infinity scrollLeft is ignored', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.box', scrollLeft: Infinity, scrollTop: 0 },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('elementscroll with NaN scrollTop is ignored', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'elementscroll',
      data: { selector: '.box', scrollLeft: 0, scrollTop: NaN },
    });
    manager._handleMessage(null, 0, msg);
    expect(rightView.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('click without getZoomFactor uses default zoom 1', async () => {
    rightView.webContents.getZoomFactor = undefined;
    rightView.webContents.executeJavaScript.mockResolvedValueOnce({ x: 100, y: 200 });
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { selector: '#btn', button: 'left' } });
    manager._handleMessage(null, 0, msg);
    await new Promise((r) => setTimeout(r, 0));
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', x: 100, y: 200 })
    );
  });
});

// --- Hover sync stabilization tests ---
describe('Hover sync stabilization', () => {
  let leftView: any;
  let rightView: any;

  function createMockView3() {
    const listeners: Record<string, any[]> = {};
    return {
      webContents: {
        on: jest.fn((event: any, cb: any) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        }),
        removeListener: jest.fn((event: any, cb: any) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((l: any) => l !== cb);
          }
        }),
        executeJavaScript: jest.fn().mockResolvedValue(undefined),
        sendInputEvent: jest.fn(),
        isDestroyed: jest.fn(() => false),
        getZoomFactor: jest.fn(() => 1.0),
        getURL: jest.fn(() => 'http://localhost:3001/'),
        loadURL: jest.fn().mockResolvedValue(undefined),
        debugger: createMockDebugger(),
      },
      _listeners: listeners,
      _emit(event: any, ...args: any[]) {
        (listeners[event] || []).forEach((cb: any) => cb(...args));
      },
    };
  }

  beforeEach(() => {
    leftView = createMockView3();
    rightView = createMockView3();
  });

  // Fix 1: Race condition — stale hover results are discarded
  describe('Fix 1: hoverVersion race condition guard', () => {
    test('stale hover result is discarded when a newer hover has been sent', async () => {
      const manager = createSyncManager(leftView, rightView);
      let resolveFirst: (v: any) => void;
      let resolveSecond: (v: any) => void;

      rightView.webContents.executeJavaScript
        .mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }))
        .mockReturnValueOnce(new Promise((r) => { resolveSecond = r; }));

      // Send two hover replays directly (bypassing throttle)
      manager._replayHover({ selector: '#old' });
      manager._replayHover({ selector: '#new' });

      // Resolve the second (newer) hover first
      resolveSecond!({ x: 200, y: 300 });
      await new Promise((r) => setTimeout(r, 0));
      expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(1);
      expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'mouseMove', x: 200, y: 300 })
      );

      // Now resolve the first (stale) hover — should be ignored
      resolveFirst!({ x: 100, y: 150 });
      await new Promise((r) => setTimeout(r, 0));
      expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(1);
    });

    test('only latest hover result triggers sendInputEvent', async () => {
      const manager = createSyncManager(leftView, rightView);
      let resolveFns: Array<(v: any) => void> = [];

      rightView.webContents.executeJavaScript
        .mockReturnValueOnce(new Promise((r) => { resolveFns.push(r); }))
        .mockReturnValueOnce(new Promise((r) => { resolveFns.push(r); }))
        .mockReturnValueOnce(new Promise((r) => { resolveFns.push(r); }));

      manager._replayHover({ selector: '#a' });
      manager._replayHover({ selector: '#b' });
      manager._replayHover({ selector: '#c' });

      // Resolve all in order
      resolveFns[0]({ x: 10, y: 10 });
      resolveFns[1]({ x: 20, y: 20 });
      resolveFns[2]({ x: 30, y: 30 });
      await new Promise((r) => setTimeout(r, 0));

      // Only the last one should have triggered sendInputEvent
      expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(1);
      expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
        expect.objectContaining({ x: 30, y: 30 })
      );
    });
  });

  // Fix 2: Overlay filtering in INJECTION_SCRIPT
  describe('Fix 2: overlay filtering in INJECTION_SCRIPT', () => {
    test('INJECTION_SCRIPT defines TWIN_OVERLAY_IDS array', () => {
      expect(INJECTION_SCRIPT).toContain('TWIN_OVERLAY_IDS');
    });

    test('INJECTION_SCRIPT contains all three overlay IDs', () => {
      expect(INJECTION_SCRIPT).toContain('__twin_inspect_overlay');
      expect(INJECTION_SCRIPT).toContain('__twin_inspect_tooltip');
      expect(INJECTION_SCRIPT).toContain('__twin_right_highlight');
    });

    test('INJECTION_SCRIPT contains elementFromPointExcludingOverlays function', () => {
      expect(INJECTION_SCRIPT).toContain('elementFromPointExcludingOverlays');
    });

    test('hover handler uses elementFromPointExcludingOverlays instead of raw elementFromPoint', () => {
      // The hover handler should use the wrapper, not direct elementFromPoint
      const hoverSection = INJECTION_SCRIPT.split('Hover sync')[1].split('Click sync')[0];
      expect(hoverSection).toContain('elementFromPointExcludingOverlays');
    });

    test('click handler uses elementFromPointExcludingOverlays instead of raw elementFromPoint', () => {
      const clickSection = INJECTION_SCRIPT.split('Click sync')[1].split('Input value sync')[0];
      expect(clickSection).toContain('elementFromPointExcludingOverlays');
    });
  });

  // Fix 3: Robust selector generation
  describe('Fix 3: robust selector generation in INJECTION_SCRIPT', () => {
    test('getSelector checks data-testid attribute', () => {
      expect(INJECTION_SCRIPT).toContain('data-testid');
    });

    test('getSelector checks aria-label attribute with uniqueness check', () => {
      expect(INJECTION_SCRIPT).toContain('aria-label');
      // Should verify uniqueness via querySelectorAll
      expect(INJECTION_SCRIPT).toContain("querySelectorAll('[aria-label=");
    });

    test('getSelector checks role attribute with uniqueness check', () => {
      expect(INJECTION_SCRIPT).toContain("getAttribute('role')");
      expect(INJECTION_SCRIPT).toContain("querySelectorAll('[role=");
    });

    test('selector priority: id before data-testid before aria-label before role before name', () => {
      const getSelectorSection = INJECTION_SCRIPT.split('function getSelector')[1].split('function isFormElement')[0];
      const idIndex = getSelectorSection.indexOf('el.id');
      const testIdIndex = getSelectorSection.indexOf('data-testid');
      const ariaIndex = getSelectorSection.indexOf('aria-label');
      const roleIndex = getSelectorSection.indexOf("getAttribute('role')");
      const nameIndex = getSelectorSection.indexOf('el.name');
      expect(idIndex).toBeLessThan(testIdIndex);
      expect(testIdIndex).toBeLessThan(ariaIndex);
      expect(ariaIndex).toBeLessThan(roleIndex);
      expect(roleIndex).toBeLessThan(nameIndex);
    });
  });

  // Fix 4: Hover replay throttling
  describe('Fix 4: hover replay throttling', () => {
    test('HOVER_REPLAY_INTERVAL is exported and equals 50', () => {
      expect(HOVER_REPLAY_INTERVAL).toBe(50);
    });

    test('first hover is executed immediately', () => {
      jest.useFakeTimers();
      const manager = createSyncManager(leftView, rightView);

      const msg = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#el1' } });
      manager._handleMessage(null, 0, msg);

      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    test('rapid hover messages are throttled — second is deferred, third replaces second', () => {
      jest.useFakeTimers();
      const manager = createSyncManager(leftView, rightView);

      // First hover — immediate
      const msg1 = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#el1' } });
      manager._handleMessage(null, 0, msg1);
      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);

      // Second hover — within throttle interval, should be deferred
      jest.advanceTimersByTime(10);
      const msg2 = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#el2' } });
      manager._handleMessage(null, 0, msg2);
      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);

      // Third hover — replaces second in pending buffer
      jest.advanceTimersByTime(10);
      const msg3 = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#el3' } });
      manager._handleMessage(null, 0, msg3);
      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);

      // Advance past throttle interval — pending (#el3) should execute
      jest.advanceTimersByTime(HOVER_REPLAY_INTERVAL);
      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(2);

      // Verify the last call contains #el3, not #el2
      const lastScript = rightView.webContents.executeJavaScript.mock.calls[1][0];
      expect(lastScript).toContain('#el3');
      expect(lastScript).not.toContain('#el2');

      jest.useRealTimers();
    });

    test('hover after throttle interval expires is executed immediately', () => {
      jest.useFakeTimers();
      const manager = createSyncManager(leftView, rightView);

      const msg1 = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#el1' } });
      manager._handleMessage(null, 0, msg1);
      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);

      // Wait past the throttle interval
      jest.advanceTimersByTime(HOVER_REPLAY_INTERVAL + 10);

      const msg2 = SYNC_PREFIX + JSON.stringify({ type: 'hover', data: { selector: '#el2' } });
      manager._handleMessage(null, 0, msg2);
      expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });
  });

  // Fix 5: __twin_ element skip guard
  describe('Fix 5: __twin_ element skip guard in INJECTION_SCRIPT', () => {
    test('hover handler contains __twin_ prefix check', () => {
      const hoverSection = INJECTION_SCRIPT.split('Hover sync')[1].split('Click sync')[0];
      expect(hoverSection).toContain("__twin_");
      expect(hoverSection).toContain("el.id.indexOf('__twin_') === 0");
    });

    test('click handler contains __twin_ prefix check', () => {
      const clickSection = INJECTION_SCRIPT.split('Click sync')[1].split('Input value sync')[0];
      expect(clickSection).toContain("__twin_");
      expect(clickSection).toContain("el.id.indexOf('__twin_') === 0");
    });
  });
});
