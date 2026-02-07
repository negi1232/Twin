const SYNC_PREFIX = '__twin_sync__';

// JavaScript injected into left BrowserView to capture user events
const INJECTION_SCRIPT = `
(function() {
  if (window.__twinSyncInjected) return;
  window.__twinSyncInjected = true;

  function send(type, data) {
    console.log('${SYNC_PREFIX}' + JSON.stringify({ type, data }));
  }

  // Scroll sync (throttled via rAF)
  let scrollTicking = false;
  window.addEventListener('scroll', function() {
    if (!scrollTicking) {
      requestAnimationFrame(function() {
        send('scroll', { scrollX: window.scrollX, scrollY: window.scrollY });
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });

  // Click sync
  window.addEventListener('click', function(e) {
    send('click', {
      x: e.clientX,
      y: e.clientY,
      button: e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right',
    });
  }, true);

  // Key sync
  window.addEventListener('keydown', function(e) {
    if (e.repeat) return;
    send('keydown', {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
    });
  }, true);

  window.addEventListener('keyup', function(e) {
    send('keyup', {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
    });
  }, true);
})();
`;

function createSyncManager(leftView, rightView) {
  let enabled = true;

  function isEnabled() {
    return enabled;
  }

  function setEnabled(value) {
    enabled = !!value;
  }

  function handleMessage(_event, level, message) {
    if (!enabled) return;
    if (!message.startsWith(SYNC_PREFIX)) return;

    let parsed;
    try {
      parsed = JSON.parse(message.slice(SYNC_PREFIX.length));
    } catch (_e) {
      return;
    }

    const { type, data } = parsed;
    if (!rightView || rightView.webContents.isDestroyed()) return;

    switch (type) {
      case 'scroll':
        replayScroll(data);
        break;
      case 'click':
        replayClick(data);
        break;
      case 'keydown':
        replayKey('keyDown', data);
        break;
      case 'keyup':
        replayKey('keyUp', data);
        break;
    }
  }

  function replayScroll({ scrollX, scrollY }) {
    rightView.webContents.executeJavaScript(
      `window.scrollTo(${scrollX}, ${scrollY})`
    ).catch(() => {});
  }

  function replayClick({ x, y, button }) {
    const buttonMap = { left: 'left', middle: 'middle', right: 'right' };
    const btn = buttonMap[button] || 'left';

    rightView.webContents.sendInputEvent({
      type: 'mouseDown',
      x,
      y,
      button: btn,
      clickCount: 1,
    });
    rightView.webContents.sendInputEvent({
      type: 'mouseUp',
      x,
      y,
      button: btn,
      clickCount: 1,
    });
  }

  function replayKey(type, { key, keyCode, shift, ctrl, alt, meta }) {
    const modifiers = [];
    if (shift) modifiers.push('shift');
    if (ctrl) modifiers.push('control');
    if (alt) modifiers.push('alt');
    if (meta) modifiers.push('meta');

    const keyChar = String.fromCharCode(keyCode);

    rightView.webContents.sendInputEvent({
      type,
      keyCode: keyChar,
      modifiers,
    });

    // Send 'char' event on keyDown for printable characters to insert text into form fields
    if (type === 'keyDown' && key && key.length === 1) {
      rightView.webContents.sendInputEvent({
        type: 'char',
        keyCode: key,
        modifiers,
      });
    }
  }

  function inject() {
    if (!leftView || leftView.webContents.isDestroyed()) return;
    leftView.webContents.executeJavaScript(INJECTION_SCRIPT).catch(() => {});
  }

  function start() {
    if (!leftView) return;

    // Inject on every page load
    leftView.webContents.on('did-finish-load', inject);

    // Listen for sync messages from injected script
    leftView.webContents.on('console-message', handleMessage);
  }

  function stop() {
    if (!leftView || leftView.webContents.isDestroyed()) return;
    leftView.webContents.removeListener('did-finish-load', inject);
    leftView.webContents.removeListener('console-message', handleMessage);
  }

  return {
    start,
    stop,
    inject,
    isEnabled,
    setEnabled,
    // Exposed for testing
    _handleMessage: handleMessage,
    _replayScroll: replayScroll,
    _replayClick: replayClick,
    _replayKey: replayKey,
  };
}

module.exports = { createSyncManager, SYNC_PREFIX, INJECTION_SCRIPT };
