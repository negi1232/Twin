/**
 * @module main/sync-manager
 * @description 左ビュー（Expected）のユーザー操作を右ビュー（Actual）にリアルタイム同期する。
 * 左ビューにインジェクションスクリプトを挿入し、console-message 経由でイベントを受信、
 * 右ビューに executeJavaScript / sendInputEvent で再現する。
 *
 * 同期対象: スクロール、要素レベルスクロール、ホバー、クリック、
 * フォーム入力（IME 対応）、キーボード入力、ページ内ナビゲーション。
 */

import type { WebContentsView } from 'electron';

/** 同期メッセージの識別プレフィックス */
const SYNC_PREFIX: string = '__twin_sync__';

/** ヘルスチェック間隔（ミリ秒） */
const HEALTH_CHECK_INTERVAL = 3000;

interface ScrollData {
  scrollX: number;
  scrollY: number;
}

interface ElementScrollData {
  selector: string;
  scrollLeft: number;
  scrollTop: number;
}

interface HoverData {
  selector: string;
}

interface ClickData {
  selector: string;
  button: string;
}

interface InputValueData {
  selector: string;
  value?: string;
  textContent?: string;
}

interface FileChangeData {
  selector: string;
  paths: string[];
  names: string[];
}

interface KeyData {
  key: string;
  code: string;
  keyCode: number;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  meta: boolean;
}

interface NavigateData {
  url: string;
  pathname: string;
}

type SyncMessage =
  | { type: 'scroll'; data: ScrollData }
  | { type: 'elementscroll'; data: ElementScrollData }
  | { type: 'hover'; data: HoverData }
  | { type: 'click'; data: ClickData }
  | { type: 'inputvalue'; data: InputValueData }
  | { type: 'filechange'; data: FileChangeData }
  | { type: 'keydown'; data: KeyData }
  | { type: 'keyup'; data: KeyData }
  | { type: 'navigate'; data: NavigateData };

export interface SyncManager {
  start(): void;
  stop(): void;
  inject(): void;
  isEnabled(): boolean;
  setEnabled(value: boolean): void;
  isPaused(): boolean;
  pause(): void;
  resume(): void;
  suppressNavSync(): void;
  isNavSyncSuppressed(): boolean;
  _handleMessage(event: unknown, level: number, message: string): void;
  _replayScroll(data: ScrollData): void;
  _replayElementScroll(data: ElementScrollData): void;
  _replayHover(data: HoverData): void;
  _replayClick(data: ClickData): void;
  _replayInputValue(data: InputValueData): void;
  _replayFileChange(data: FileChangeData): Promise<void>;
  _replayKey(type: string, data: KeyData): void;
  _replayNavigate(data: NavigateData): void;
  _handleCDPEvent(event: unknown, method: string, params: Record<string, unknown>): Promise<void>;
}

/**
 * 文字列を JS テンプレートリテラル内に安全に埋め込むためにエスケープする。
 * バックスラッシュ、シングルクォート、バッククォート、$、改行を処理する。
 */
function escapeForScript(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * 左ビューにインジェクトされる JavaScript。
 * スクロール・ホバー・クリック・入力・キー操作を検知し、
 * console.log 経由で SYNC_PREFIX 付きの JSON メッセージとして送信する。
 */
const INJECTION_SCRIPT: string = `
(function() {
  if (window.__twinSyncInjected) return;
  window.__twinSyncInjected = true;

  // Disable File System Access API so libraries like react-dropzone
  // fall back to <input type="file">, which CDP can intercept for file sync.
  window.showOpenFilePicker = undefined;

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
      // Skip file inputs — synthetic clicks cannot open file dialogs
      if (el.tagName === 'INPUT' && el.type === 'file') return;
      // Skip wrapper elements containing file inputs (e.g. react-dropzone)
      if (el.querySelector && el.querySelector('input[type="file"]')) return;
      // Walk up ancestors to catch clicks inside file upload wrappers
      var ancestor = el.parentElement;
      for (var ai = 0; ai < 5 && ancestor; ai++) {
        if (ancestor.querySelector && ancestor.querySelector('input[type="file"]')) return;
        ancestor = ancestor.parentElement;
      }
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

  // --- File input sync ---
  document.addEventListener('change', function(e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return;
    var files = el.files;
    if (!files || files.length === 0) return;
    var paths = [];
    var names = [];
    for (var i = 0; i < files.length; i++) {
      if (files[i].path) paths.push(files[i].path);
      names.push(files[i].name);
    }
    send('filechange', {
      selector: getSelector(el),
      paths: paths,
      names: names,
    });
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

  // --- SPA navigation detection (pushState / replaceState / popstate) ---
  var lastSentHref = location.href;
  function notifyNavigation() {
    var href = location.href;
    if (href !== lastSentHref) {
      lastSentHref = href;
      send('navigate', { url: href, pathname: location.pathname });
    }
  }

  var origPushState = history.pushState;
  history.pushState = function() {
    var result = origPushState.apply(this, arguments);
    notifyNavigation();
    return result;
  };

  var origReplaceState = history.replaceState;
  history.replaceState = function() {
    var result = origReplaceState.apply(this, arguments);
    notifyNavigation();
    return result;
  };

  window.addEventListener('popstate', function() {
    notifyNavigation();
  });
})();
`;

/**
 * SyncManager を生成する。左ビューの操作イベントを右ビューに同期する。
 * @param showOpenDialog テスト用 DI。省略時は electron.dialog.showOpenDialog を使用。
 */
function createSyncManager(
  leftView: WebContentsView,
  rightView: WebContentsView,
  showOpenDialog?: (options: { properties: string[] }) => Promise<{ canceled: boolean; filePaths: string[] }>,
): SyncManager {
  let enabled = true;
  let paused = false;
  let navSyncSuppressed = false;
  let navSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingFilePaths: string[] = [];
  let fileChooserHandling = false;
  let skipNextFileChangeMessage = false;

  function isEnabled(): boolean {
    return enabled;
  }

  function setEnabled(value: boolean): void {
    enabled = !!value;
  }

  function isPaused(): boolean {
    return paused;
  }

  function pause(): void {
    paused = true;
  }

  function resume(): void {
    paused = false;
  }

  function suppressNavSync(): void {
    navSyncSuppressed = true;
    if (navSyncTimer) clearTimeout(navSyncTimer);
    navSyncTimer = setTimeout(() => {
      navSyncSuppressed = false;
      navSyncTimer = null;
    }, 500);
  }

  function isNavSyncSuppressed(): boolean {
    return navSyncSuppressed;
  }

  function handleMessage(_event: unknown, _level: number, message: string): void {
    if (!enabled || paused) return;
    if (!message.startsWith(SYNC_PREFIX)) return;

    let parsed: SyncMessage;
    try {
      parsed = JSON.parse(message.slice(SYNC_PREFIX.length));
    } catch {
      return;
    }

    if (!rightView || rightView.webContents.isDestroyed()) return;

    switch (parsed.type) {
      case 'scroll':
        replayScroll(parsed.data);
        break;
      case 'elementscroll':
        replayElementScroll(parsed.data);
        break;
      case 'hover':
        replayHover(parsed.data);
        break;
      case 'click':
        replayClick(parsed.data);
        break;
      case 'inputvalue':
        replayInputValue(parsed.data);
        break;
      case 'filechange':
        if (skipNextFileChangeMessage) {
          skipNextFileChangeMessage = false;
          break;
        }
        replayFileChange(parsed.data);
        break;
      case 'keydown':
        replayKey('keyDown', parsed.data);
        break;
      case 'keyup':
        replayKey('keyUp', parsed.data);
        break;
      case 'navigate':
        replayNavigate(parsed.data);
        break;
    }
  }

  function replayScroll({ scrollX, scrollY }: ScrollData): void {
    if (!Number.isFinite(scrollX) || !Number.isFinite(scrollY)) return;
    rightView.webContents
      .executeJavaScript(`window.scrollTo(${scrollX}, ${scrollY})`)
      .catch((err: Error) => console.error('Sync replay failed:', err.message));
  }

  function replayElementScroll({ selector, scrollLeft, scrollTop }: ElementScrollData): void {
    if (!Number.isFinite(scrollLeft) || !Number.isFinite(scrollTop)) return;
    const escapedSelector = escapeForScript(selector);
    const script = `(function(){
      var el = document.querySelector('${escapedSelector}');
      if(el){ el.scrollLeft=${scrollLeft}; el.scrollTop=${scrollTop}; }
    })()`;
    rightView.webContents
      .executeJavaScript(script)
      .catch((err: Error) => console.error('Sync replay failed:', err.message));
  }

  function replayHover({ selector }: HoverData): void {
    const escapedSelector = escapeForScript(selector);
    const script = `(function(){
      var el = document.querySelector('${escapedSelector}');
      if (el) {
        var rect = el.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      }
      return null;
    })()`;
    rightView.webContents
      .executeJavaScript(script)
      .then((coords: { x: number; y: number } | null) => {
        if (coords) {
          const zoom = rightView.webContents.getZoomFactor ? rightView.webContents.getZoomFactor() : 1;
          rightView.webContents.sendInputEvent({
            type: 'mouseMove',
            x: Math.round(coords.x * zoom),
            y: Math.round(coords.y * zoom),
          });
        }
      })
      .catch((err: Error) => console.error('Sync replay failed:', err.message));
  }

  function replayClick({ selector, button }: ClickData): void {
    suppressNavSync();
    const buttonMap: Record<string, 'left' | 'middle' | 'right'> = { left: 'left', middle: 'middle', right: 'right' };
    const btn = buttonMap[button] || 'left';
    const escapedSelector = escapeForScript(selector);
    const script = `(function(){
      var el = document.querySelector('${escapedSelector}');
      if (el) {
        var rect = el.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      }
      return null;
    })()`;
    rightView.webContents
      .executeJavaScript(script)
      .then((coords: { x: number; y: number } | null) => {
        if (coords) {
          const zoom = rightView.webContents.getZoomFactor ? rightView.webContents.getZoomFactor() : 1;
          const x = Math.round(coords.x * zoom);
          const y = Math.round(coords.y * zoom);
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
      })
      .catch((err: Error) => console.error('Sync replay failed:', err.message));
  }

  function replayInputValue({ selector, value, textContent }: InputValueData): void {
    const escaped = escapeForScript(textContent !== undefined ? textContent : (value ?? ''));
    const escapedSelector = escapeForScript(selector);

    let script: string;
    if (textContent !== undefined) {
      script = `(function(){
        var el = document.querySelector('${escapedSelector}');
        if(el){ el.textContent='${escaped}'; el.dispatchEvent(new Event('input',{bubbles:true})); }
      })()`;
    } else {
      script = `(function(){
        var el = document.querySelector('${escapedSelector}');
        if(el){
          var proto = el.tagName === 'TEXTAREA'
            ? window.HTMLTextAreaElement.prototype
            : window.HTMLInputElement.prototype;
          var nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value');
          if(nativeSetter && nativeSetter.set){ nativeSetter.set.call(el,'${escaped}'); }
          else { el.value='${escaped}'; }
          el.dispatchEvent(new Event('input',{bubbles:true}));
        }
      })()`;
    }

    rightView.webContents
      .executeJavaScript(script)
      .catch((err: Error) => console.error('Sync replay failed:', err.message));
  }

  function replayKey(type: string, { key, keyCode, shift, ctrl, alt, meta }: KeyData): void {
    const modifiers: string[] = [];
    if (shift) modifiers.push('shift');
    if (ctrl) modifiers.push('control');
    if (alt) modifiers.push('alt');
    if (meta) modifiers.push('meta');

    const keyChar = String.fromCharCode(keyCode);

    rightView.webContents.sendInputEvent({
      type: type as 'keyDown' | 'keyUp',
      keyCode: keyChar,
      modifiers: modifiers as Array<'shift' | 'control' | 'alt' | 'meta'>,
    });

    // Send 'char' event on keyDown for printable characters
    if (type === 'keyDown' && key && key.length === 1) {
      rightView.webContents.sendInputEvent({
        type: 'char',
        keyCode: key,
        modifiers: modifiers as Array<'shift' | 'control' | 'alt' | 'meta'>,
      });
    }
  }

  function replayNavigate(data: NavigateData): void {
    if (navSyncSuppressed) return;
    try {
      const rightUrl = new URL(rightView.webContents.getURL());
      const leftUrl = new URL(data.url);
      rightUrl.pathname = leftUrl.pathname;
      rightUrl.search = leftUrl.search;
      rightUrl.hash = leftUrl.hash;
      rightView.webContents
        .loadURL(rightUrl.toString())
        .catch((err: Error) => console.error('Sync navigate failed:', err.message));
    } catch {
      console.error('Sync navigate failed: invalid URL');
    }
  }

  async function replayFileChange({ selector, paths }: FileChangeData): Promise<void> {
    const messagePaths = paths ? paths.filter((p) => typeof p === 'string' && p.length > 0) : [];
    const effectivePaths = messagePaths.length > 0 ? messagePaths : [...pendingFilePaths];
    pendingFilePaths = [];
    if (effectivePaths.length === 0) return;

    const dbg = rightView.webContents.debugger;
    try {
      dbg.attach('1.3');
      const { root } = await dbg.sendCommand('DOM.getDocument');
      const { nodeId } = await dbg.sendCommand('DOM.querySelector', {
        nodeId: root.nodeId,
        selector,
      });
      if (nodeId === 0) return;
      await dbg.sendCommand('DOM.setFileInputFiles', {
        nodeId,
        files: effectivePaths,
      });
      // DOM.setFileInputFiles fires native change + input events automatically
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Sync file replay failed:', message);
    } finally {
      try {
        dbg.detach();
      } catch {
        // already detached
      }
    }
  }

  /** 左ビューのファイルダイアログを CDP でインターセプトする */
  function setupFileChooserInterception(): void {
    if (!leftView || leftView.webContents.isDestroyed()) return;
    const dbg = leftView.webContents.debugger;
    try {
      if (!dbg.isAttached()) {
        dbg.attach('1.3');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('File chooser interception setup failed:', message);
      return;
    }
    dbg
      .sendCommand('Page.enable')
      .catch(() => {
        /* Page.enable may fail in some contexts; continue regardless */
      })
      .then(() => dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: true }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('File chooser interception setup failed:', message);
      });
  }

  function teardownFileChooserInterception(): void {
    if (!leftView || leftView.webContents.isDestroyed()) return;
    const dbg = leftView.webContents.debugger;
    try {
      if (dbg.isAttached()) {
        dbg.sendCommand('Page.setInterceptFileChooserDialog', { enabled: false }).catch(() => {
          /* shutting down, ignore */
        });
        dbg.detach();
      }
    } catch {
      // already detached
    }
  }

  /**
   * CDP イベントハンドラ。Page.fileChooserOpened を処理する。
   *
   * Page.setInterceptFileChooserDialog でインターセプトが有効な場合、
   * ネイティブダイアログは自動的に抑制される。
   * 代わりに dialog.showOpenDialog で独自ダイアログを表示し、
   * DOM.setFileInputFiles({ backendNodeId }) でファイルを直接セットする。
   * DOM.setFileInputFiles は Chromium のネイティブ change + input イベントを発火する
   * (FileInputType::SetFilesAndDispatchEvents)。
   */
  async function handleCDPEvent(_event: unknown, method: string, params: Record<string, unknown>): Promise<void> {
    if (method !== 'Page.fileChooserOpened') return;
    const dbg = leftView.webContents.debugger;
    const multiple = params.mode === 'selectMultiple';
    const backendNodeId = params.backendNodeId as number | undefined;

    // When interception is enabled, the native dialog is already suppressed.
    // No need to "cancel" — just ignore the event when disabled/paused.
    if (!enabled || paused) return;

    if (fileChooserHandling) return;
    fileChooserHandling = true;

    try {
      const openFn =
        showOpenDialog ||
        (async (opts: { properties: string[] }) => {
          const { dialog, BrowserWindow } = require('electron');
          const win = BrowserWindow.getFocusedWindow();
          return win ? dialog.showOpenDialog(win, opts) : dialog.showOpenDialog(opts);
        });

      const result = await openFn({
        properties: multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return;
      }

      pendingFilePaths = result.filePaths;
      skipNextFileChangeMessage = true;

      // Set files on LEFT view using DOM.setFileInputFiles
      // This fires native change + input events via Chromium's FileInputType::SetFilesAndDispatchEvents
      if (backendNodeId) {
        await dbg.sendCommand('DOM.setFileInputFiles', {
          backendNodeId,
          files: result.filePaths,
        });
      }

      // Find selector for right view sync
      let selector: string | null = null;
      if (backendNodeId) {
        try {
          const { object } = await dbg.sendCommand('DOM.resolveNode', { backendNodeId });
          const { result: selectorResult } = await dbg.sendCommand('Runtime.callFunctionOn', {
            objectId: object.objectId,
            functionDeclaration: `function() {
              if (this.id) return '#' + CSS.escape(this.id);
              if (this.name) return this.tagName.toLowerCase() + '[name="' + CSS.escape(this.name) + '"]';
              var inputs = document.querySelectorAll('input[type="file"]');
              if (inputs.length === 1) return 'input[type="file"]';
              return null;
            }`,
            returnByValue: true,
          });
          selector = selectorResult.value;
        } catch {
          /* selector lookup failed */
        }
      }

      // Sync to right view
      if (selector && rightView && !rightView.webContents.isDestroyed()) {
        try {
          const names = result.filePaths.map((p: string) => {
            const parts = p.split(/[/\\]/);
            return parts[parts.length - 1] || '';
          });
          await replayFileChange({ selector, paths: result.filePaths, names });
        } catch (syncErr: unknown) {
          const syncMessage = syncErr instanceof Error ? syncErr.message : String(syncErr);
          console.error('Direct file sync to right view failed:', syncMessage);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('File chooser handling failed:', message);
    } finally {
      fileChooserHandling = false;
    }
  }

  function inject(): void {
    if (!leftView || leftView.webContents.isDestroyed()) return;
    leftView.webContents
      .executeJavaScript(INJECTION_SCRIPT)
      .catch((err: Error) => console.error('Sync replay failed:', err.message));
    setupFileChooserInterception();
  }

  let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

  function startHealthCheck(): void {
    if (healthCheckTimer) return;
    healthCheckTimer = setInterval(() => {
      if (!leftView || leftView.webContents.isDestroyed()) return;
      leftView.webContents
        .executeJavaScript('!!window.__twinSyncInjected')
        .then((alive: boolean) => {
          if (!alive) {
            inject();
          }
        })
        .catch(() => {
          // View may be navigating, ignore
        });
    }, HEALTH_CHECK_INTERVAL);
  }

  function stopHealthCheck(): void {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer);
      healthCheckTimer = null;
    }
  }

  function start(): void {
    if (!leftView) return;

    // Inject on every page load
    leftView.webContents.on('did-finish-load', inject);

    // Listen for sync messages from injected script
    leftView.webContents.on('console-message', handleMessage);

    // Listen for CDP events (file chooser interception)
    leftView.webContents.debugger.on('message', handleCDPEvent);

    // Inject immediately in case page is already loaded
    inject();

    startHealthCheck();
  }

  function stop(): void {
    stopHealthCheck();
    if (!leftView || leftView.webContents.isDestroyed()) return;
    leftView.webContents.removeListener('did-finish-load', inject);
    leftView.webContents.removeListener('console-message', handleMessage);
    try {
      leftView.webContents.debugger.removeListener('message', handleCDPEvent);
    } catch {
      /* debugger may not be attached */
    }
    teardownFileChooserInterception();
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
    suppressNavSync,
    isNavSyncSuppressed,
    // Exposed for testing
    _handleMessage: handleMessage,
    _replayScroll: replayScroll,
    _replayElementScroll: replayElementScroll,
    _replayHover: replayHover,
    _replayClick: replayClick,
    _replayInputValue: replayInputValue,
    _replayFileChange: replayFileChange,
    _replayKey: replayKey,
    _replayNavigate: replayNavigate,
    _handleCDPEvent: handleCDPEvent,
  };
}

export { createSyncManager, SYNC_PREFIX, INJECTION_SCRIPT, HEALTH_CHECK_INTERVAL, escapeForScript };
