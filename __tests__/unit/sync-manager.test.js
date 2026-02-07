const { createSyncManager, SYNC_PREFIX } = require('../../src/main/sync-manager');

function createMockView() {
  const listeners = {};
  return {
    webContents: {
      on: jest.fn((event, cb) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeListener: jest.fn((event, cb) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }
      }),
      executeJavaScript: jest.fn().mockResolvedValue(undefined),
      sendInputEvent: jest.fn(),
      isDestroyed: jest.fn(() => false),
    },
    _listeners: listeners,
    _emit(event, ...args) {
      (listeners[event] || []).forEach((cb) => cb(...args));
    },
  };
}

describe('SyncManager', () => {
  let leftView, rightView, manager;

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

  test('inputvalue for contenteditable sets innerHTML', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'inputvalue',
      data: { selector: '.editor', innerHTML: '<p>テスト</p>' },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.executeJavaScript).toHaveBeenCalledTimes(1);
    const script = rightView.webContents.executeJavaScript.mock.calls[0][0];
    expect(script).toContain('innerHTML');
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
});
