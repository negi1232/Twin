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

  // --- Click sync ---
  test('click message replays mouseDown + mouseUp on right view', () => {
    const msg = SYNC_PREFIX + JSON.stringify({ type: 'click', data: { x: 50, y: 75, button: 'left' } });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledTimes(2);
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseDown', x: 50, y: 75, button: 'left' })
    );
    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'mouseUp', x: 50, y: 75, button: 'left' })
    );
  });

  // --- Key sync ---
  test('keydown message replays keyDown on right view', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keydown',
      data: { key: 'a', code: 'KeyA', keyCode: 65, shift: false, ctrl: false, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyDown', modifiers: [] })
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
  });

  test('keyup message replays keyUp on right view', () => {
    const msg = SYNC_PREFIX + JSON.stringify({
      type: 'keyup',
      data: { key: 'a', code: 'KeyA', keyCode: 65, shift: false, ctrl: false, alt: false, meta: false },
    });
    manager._handleMessage(null, 0, msg);

    expect(rightView.webContents.sendInputEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'keyUp' })
    );
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
});
