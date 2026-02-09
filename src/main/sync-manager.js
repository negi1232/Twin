const SYNC_PREFIX = '__twin_sync__';

// JavaScript injected into left BrowserView to capture user events
const INJECTION_SCRIPT = `
(function() {
  if (window.__twinSyncInjected) return;
  window.__twinSyncInjected = true;

  function send(type, data) {
    console.log('${SYNC_PREFIX}' + JSON.stringify({ type, data }));
  }

  // --- Element selector generator ---
  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.name) return el.tagName.toLowerCase() + '[name="' + CSS.escape(el.name) + '"]';
    var tag = el.tagName.toLowerCase();
    var parent = el.parentElement;
    if (!parent) return tag;
    var siblings = Array.from(parent.children).filter(function(c) {
      return c.tagName === el.tagName;
    });
    if (siblings.length === 1) return getSelector(parent) + ' > ' + tag;
    var index = siblings.indexOf(el) + 1;
    return getSelector(parent) + ' > ' + tag + ':nth-of-type(' + index + ')';
  }

  function isFormElement(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // --- Scroll sync (throttled via rAF) ---
  // Window-level scroll
  var scrollTicking = false;
  window.addEventListener('scroll', function() {
    if (!scrollTicking) {
      requestAnimationFrame(function() {
        send('scroll', { scrollX: window.scrollX, scrollY: window.scrollY });
        scrollTicking = false;
      });
      scrollTicking = true;
    }
  }, { passive: true });

  // Element-level scroll (modals, horizontal overflow containers, etc.)
  var elScrollTicking = false;
  var elScrollTarget = null;
  document.addEventListener('scroll', function(e) {
    if (e.target === document || e.target === document.documentElement) return;
    elScrollTarget = e.target;
    if (!elScrollTicking) {
      requestAnimationFrame(function() {
        var el = elScrollTarget;
        if (el && el.nodeType === 1) {
          var selector = getSelector(el);
          send('elementscroll', {
            selector: selector,
            scrollLeft: el.scrollLeft,
            scrollTop: el.scrollTop
          });
        }
        elScrollTicking = false;
      });
      elScrollTicking = true;
    }
  }, { capture: true, passive: true });

  // --- Hover sync (element-based, throttled via rAF) ---
  var hoverTicking = false;
  var lastHoverSelector = null;
  window.addEventListener('mousemove', function(e) {
    if (!hoverTicking) {
      requestAnimationFrame(function() {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (el) {
          var selector = getSelector(el);
          if (selector !== lastHoverSelector) {
            send('hover', { selector: selector });
            lastHoverSelector = selector;
          }
        }
        hoverTicking = false;
      });
      hoverTicking = true;
    }
  }, { passive: true });

  // --- Click sync (element-based) ---
  window.addEventListener('click', function(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (el) {
      send('click', {
        selector: getSelector(el),
        button: e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right',
      });
    }
  }, true);

  // --- Input value sync (handles IME, paste, autocomplete) ---
  window.addEventListener('input', function(e) {
    var el = e.target;
    if (!isFormElement(el)) return;
    var selector = getSelector(el);
    if (el.isContentEditable) {
      send('inputvalue', { selector: selector, textContent: el.textContent });
    } else {
      send('inputvalue', { selector: selector, value: el.value });
    }
  }, true);

  // --- Key sync (for non-form elements: shortcuts, navigation, etc.) ---
  window.addEventListener('keydown', function(e) {
    if (e.repeat) return;
    if (isFormElement(e.target)) return;
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
    if (isFormElement(e.target)) return;
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
  let paused = false;

  function isEnabled() {
    return enabled;
  }

  function setEnabled(value) {
    enabled = !!value;
  }

  function isPaused() {
    return paused;
  }

  function pause() {
    paused = true;
  }

  function resume() {
    paused = false;
  }

  function handleMessage(_event, level, message) {
    if (!enabled || paused) return;
    if (!message.startsWith(SYNC_PREFIX)) return;

    let parsed;
    try {
      parsed = JSON.parse(message.slice(SYNC_PREFIX.length));
    } catch {
      return;
    }

    const { type, data } = parsed;
    if (!rightView || rightView.webContents.isDestroyed()) return;

    switch (type) {
      case 'scroll':
        replayScroll(data);
        break;
      case 'elementscroll':
        replayElementScroll(data);
        break;
      case 'hover':
        replayHover(data);
        break;
      case 'click':
        replayClick(data);
        break;
      case 'inputvalue':
        replayInputValue(data);
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
    if (!Number.isFinite(scrollX) || !Number.isFinite(scrollY)) return;
    rightView.webContents.executeJavaScript(
      `window.scrollTo(${scrollX}, ${scrollY})`
    ).catch(() => {});
  }

  function replayElementScroll({ selector, scrollLeft, scrollTop }) {
    if (!Number.isFinite(scrollLeft) || !Number.isFinite(scrollTop)) return;
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const script = `(function(){
      var el = document.querySelector('${escapedSelector}');
      if(el){ el.scrollLeft=${scrollLeft}; el.scrollTop=${scrollTop}; }
    })()`;
    rightView.webContents.executeJavaScript(script).catch(() => {});
  }

  function replayHover({ selector }) {
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const script = `(function(){
      var el = document.querySelector('${escapedSelector}');
      if (el) {
        var rect = el.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      }
      return null;
    })()`;
    rightView.webContents.executeJavaScript(script).then((coords) => {
      if (coords) {
        rightView.webContents.sendInputEvent({
          type: 'mouseMove',
          x: coords.x,
          y: coords.y,
        });
      }
    }).catch(() => {});
  }

  function replayClick({ selector, button }) {
    const buttonMap = { left: 'left', middle: 'middle', right: 'right' };
    const btn = buttonMap[button] || 'left';
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const script = `(function(){
      var el = document.querySelector('${escapedSelector}');
      if (el) {
        var rect = el.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      }
      return null;
    })()`;
    rightView.webContents.executeJavaScript(script).then((coords) => {
      if (coords) {
        rightView.webContents.sendInputEvent({
          type: 'mouseDown',
          x: coords.x,
          y: coords.y,
          button: btn,
          clickCount: 1,
        });
        rightView.webContents.sendInputEvent({
          type: 'mouseUp',
          x: coords.x,
          y: coords.y,
          button: btn,
          clickCount: 1,
        });
      }
    }).catch(() => {});
  }

  function replayInputValue({ selector, value, textContent }) {
    // Escape for safe injection into JS string
    const escaped = (textContent !== undefined ? textContent : value)
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    const escapedSelector = selector.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    let script;
    if (textContent !== undefined) {
      script = `(function(){
        var el = document.querySelector('${escapedSelector}');
        if(el){ el.textContent='${escaped}'; el.dispatchEvent(new Event('input',{bubbles:true})); }
      })()`;
    } else {
      script = `(function(){
        var el = document.querySelector('${escapedSelector}');
        if(el){
          var nativeSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
          ) || Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype, 'value'
          );
          if(nativeSetter && nativeSetter.set){ nativeSetter.set.call(el,'${escaped}'); }
          else { el.value='${escaped}'; }
          el.dispatchEvent(new Event('input',{bubbles:true}));
        }
      })()`;
    }

    rightView.webContents.executeJavaScript(script).catch(() => {});
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

    // Send 'char' event on keyDown for printable characters
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

    // Inject immediately in case page is already loaded
    inject();
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
    isPaused,
    pause,
    resume,
    // Exposed for testing
    _handleMessage: handleMessage,
    _replayScroll: replayScroll,
    _replayElementScroll: replayElementScroll,
    _replayHover: replayHover,
    _replayClick: replayClick,
    _replayInputValue: replayInputValue,
    _replayKey: replayKey,
  };
}

module.exports = { createSyncManager, SYNC_PREFIX, INJECTION_SCRIPT };
