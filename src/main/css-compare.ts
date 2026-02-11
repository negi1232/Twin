// CSS property category sets
const LAYOUT_PROPS: Set<string> = new Set([
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'clear',
  'z-index',
  'overflow',
  'overflow-x',
  'overflow-y',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-self',
  'align-content',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'gap',
  'row-gap',
  'column-gap',
  'box-sizing',
  'vertical-align',
]);

const TEXT_PROPS: Set<string> = new Set([
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'text-indent',
  'text-shadow',
  'white-space',
  'word-break',
  'word-wrap',
  'overflow-wrap',
  'color',
  'direction',
  'unicode-bidi',
  'writing-mode',
]);

const VISUAL_PROPS: Set<string> = new Set([
  'background',
  'background-color',
  'background-image',
  'background-position',
  'background-size',
  'background-repeat',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-style',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'box-shadow',
  'opacity',
  'visibility',
  'outline',
  'outline-color',
  'outline-style',
  'outline-width',
  'transform',
  'transition',
  'animation',
  'cursor',
  'filter',
  'backdrop-filter',
]);

export interface CssElement {
  tag: string;
  key: string;
  method: string;
  styles: Record<string, string>;
}

export interface CssDiff {
  property: string;
  expected: string;
  actual: string;
  category: string;
  type: string;
}

interface CssChangedElement {
  tag: string;
  key: string;
  method: string;
  type: string;
  diffCount: number;
  diffs: CssDiff[];
}

interface CssElementInfo {
  tag: string;
  key: string;
  method: string;
  type: string;
}

interface MatchResult {
  matched: Array<{ left: CssElement; right: CssElement }>;
  added: CssElement[];
  deleted: CssElement[];
}

export interface CssScanResult {
  scannedElements: number;
  leftCount: number;
  rightCount: number;
  changed: CssChangedElement[];
  added: CssElementInfo[];
  deleted: CssElementInfo[];
  summary: ScanSummary;
}

import type { WebContentsView } from 'electron';

/**
 * Classify a CSS property into a category.
 */
function classifyProperty(prop: string): string {
  if (LAYOUT_PROPS.has(prop)) return 'layout';
  if (TEXT_PROPS.has(prop)) return 'text';
  if (VISUAL_PROPS.has(prop)) return 'visual';
  return 'other';
}

/**
 * JavaScript to inject into BrowserViews to collect computed styles of all visible elements.
 * Returns an array of { tag, key, method, styles }.
 */
const CSS_COLLECTION_SCRIPT: string = `(function() {
  var META_TAGS = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'BR', 'HR', 'NOSCRIPT', 'BASE'];

  function getDomPath(el) {
    if (el === document.body) return 'body';
    var parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    var tag = el.tagName.toLowerCase();
    var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
    if (siblings.length === 1) return getDomPath(parent) + ' > ' + tag;
    var idx = siblings.indexOf(el) + 1;
    return getDomPath(parent) + ' > ' + tag + ':nth-of-type(' + idx + ')';
  }

  function getMatchKey(el) {
    if (el.id) return { method: 'id', key: '#' + el.id };
    if (el.dataset && el.dataset.testid) return { method: 'data-testid', key: '[data-testid="' + el.dataset.testid + '"]' };
    var classList = el.classList;
    for (var i = 0; i < classList.length; i++) {
      var cls = classList[i];
      try {
        if (document.querySelectorAll('.' + CSS.escape(cls)).length === 1) {
          return { method: 'unique-class', key: '.' + cls };
        }
      } catch(e) { /* skip invalid selectors */ }
    }
    return { method: 'dom-path', key: getDomPath(el) };
  }

  var elements = [];
  var allEls = document.body.querySelectorAll('*');

  for (var i = 0; i < allEls.length; i++) {
    var el = allEls[i];
    if (META_TAGS.indexOf(el.tagName) !== -1) continue;
    var style = window.getComputedStyle(el);
    if (style.display === 'none') continue;

    var matchInfo = getMatchKey(el);
    var styles = {};
    for (var j = 0; j < style.length; j++) {
      var prop = style[j];
      styles[prop] = style.getPropertyValue(prop);
    }
    elements.push({
      tag: el.tagName.toLowerCase(),
      key: matchInfo.key,
      method: matchInfo.method,
      styles: styles
    });
  }

  return elements;
})()`;

/**
 * JavaScript to inject into left BrowserView for inspect mode.
 * Adds hover highlights and click interception.
 */
const CSS_INSPECT_SCRIPT: string = `(function() {
  if (window.__twinCssInspectActive) return;
  window.__twinCssInspectActive = true;

  var PREFIX = '__twin_css__';

  function send(type, data) {
    console.log(PREFIX + JSON.stringify({ type: type, data: data }));
  }

  function getDomPath(el) {
    if (el === document.body) return 'body';
    var parent = el.parentElement;
    if (!parent) return el.tagName.toLowerCase();
    var tag = el.tagName.toLowerCase();
    var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
    if (siblings.length === 1) return getDomPath(parent) + ' > ' + tag;
    var idx = siblings.indexOf(el) + 1;
    return getDomPath(parent) + ' > ' + tag + ':nth-of-type(' + idx + ')';
  }

  function getMatchKey(el) {
    if (el.id) return { method: 'id', key: '#' + el.id };
    if (el.dataset && el.dataset.testid) return { method: 'data-testid', key: '[data-testid="' + el.dataset.testid + '"]' };
    var classList = el.classList;
    for (var i = 0; i < classList.length; i++) {
      var cls = classList[i];
      try {
        if (document.querySelectorAll('.' + CSS.escape(cls)).length === 1) {
          return { method: 'unique-class', key: '.' + cls };
        }
      } catch(e) {}
    }
    return { method: 'dom-path', key: getDomPath(el) };
  }

  // Create hover overlay
  var overlay = document.createElement('div');
  overlay.id = '__twin_inspect_overlay';
  overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #58a6ff;background:rgba(88,166,255,0.1);z-index:999999;display:none;transition:all 0.1s ease;';
  document.body.appendChild(overlay);

  // Create tooltip
  var tooltip = document.createElement('div');
  tooltip.id = '__twin_inspect_tooltip';
  tooltip.style.cssText = 'position:fixed;pointer-events:none;background:#161b22;color:#e6edf3;padding:4px 8px;border-radius:4px;font-size:11px;font-family:monospace;z-index:1000000;display:none;border:1px solid #30363d;white-space:nowrap;';
  document.body.appendChild(tooltip);

  var META_TAGS = ['SCRIPT', 'STYLE', 'META', 'LINK', 'TITLE', 'HEAD', 'BR', 'HR', 'NOSCRIPT', 'BASE'];

  function onHover(e) {
    var el = e.target;
    if (!el || el === overlay || el === tooltip) return;
    if (META_TAGS.indexOf(el.tagName) !== -1) return;
    var rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';

    var info = getMatchKey(el);
    tooltip.textContent = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ').filter(Boolean).join('.') : '');
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
    tooltip.style.top = Math.max(0, rect.top - 28) + 'px';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    var el = e.target;
    if (!el || el === overlay || el === tooltip) return;
    if (META_TAGS.indexOf(el.tagName) !== -1) return;

    var matchInfo = getMatchKey(el);
    var computed = window.getComputedStyle(el);
    var styles = {};
    for (var i = 0; i < computed.length; i++) {
      var prop = computed[i];
      styles[prop] = computed.getPropertyValue(prop);
    }

    send('inspect-click', {
      tag: el.tagName.toLowerCase(),
      key: matchInfo.key,
      method: matchInfo.method,
      styles: styles
    });

    // Highlight clicked element
    overlay.style.borderColor = '#58a6ff';
    overlay.style.background = 'rgba(88,166,255,0.15)';

    return false;
  }

  document.addEventListener('mousemove', onHover, true);
  document.addEventListener('click', onClick, true);

  // Store cleanup references
  window.__twinCssInspectCleanup = function() {
    document.removeEventListener('mousemove', onHover, true);
    document.removeEventListener('click', onClick, true);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (tooltip.parentNode) tooltip.parentNode.removeChild(tooltip);
    window.__twinCssInspectActive = false;
    delete window.__twinCssInspectCleanup;
  };
})()`;

const CSS_INSPECT_CLEANUP_SCRIPT: string = `(function() {
  if (typeof window.__twinCssInspectCleanup === 'function') {
    window.__twinCssInspectCleanup();
  }
})()`;

/**
 * Build a script to get computed styles for a single element by its match key.
 */
function buildGetElementStylesScript(key: string, method: string): string {
  const escapedKey = key
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `(function() {
    var el;
    try {
      if ('${method}' === 'dom-path') {
        // For dom-path, use the key as a CSS selector directly
        el = document.querySelector('${escapedKey}');
      } else {
        el = document.querySelector('${escapedKey}');
      }
    } catch(e) { return null; }
    if (!el) return null;
    var computed = window.getComputedStyle(el);
    var styles = {};
    for (var i = 0; i < computed.length; i++) {
      var prop = computed[i];
      styles[prop] = computed.getPropertyValue(prop);
    }
    return { tag: el.tagName.toLowerCase(), styles: styles };
  })()`;
}

/**
 * Build a script to highlight an element in the right view with an orange border.
 */
function buildHighlightScript(key: string): string {
  const escapedKey = key
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `(function() {
    // Remove previous highlight
    var prev = document.getElementById('__twin_right_highlight');
    if (prev) prev.parentNode.removeChild(prev);

    var el;
    try { el = document.querySelector('${escapedKey}'); } catch(e) { return false; }
    if (!el) return false;

    var rect = el.getBoundingClientRect();
    var overlay = document.createElement('div');
    overlay.id = '__twin_right_highlight';
    overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #f0883e;background:rgba(240,136,62,0.1);z-index:999999;';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    document.body.appendChild(overlay);
    return true;
  })()`;
}

const CLEAR_HIGHLIGHT_SCRIPT: string = `(function() {
  var prev = document.getElementById('__twin_right_highlight');
  if (prev) prev.parentNode.removeChild(prev);
})()`;

const CSS_INSPECT_PREFIX: string = '__twin_css__';

/**
 * Match elements between left and right by their keys.
 */
function matchElements(leftElements: CssElement[], rightElements: CssElement[]): MatchResult {
  const rightByKey = new Map<string, CssElement>();
  for (const el of rightElements) {
    rightByKey.set(el.key, el);
  }

  const matched: Array<{ left: CssElement; right: CssElement }> = [];
  const deleted: CssElement[] = [];
  const rightMatched = new Set<string>();

  for (const leftEl of leftElements) {
    const rightEl = rightByKey.get(leftEl.key);
    if (rightEl) {
      rightMatched.add(leftEl.key);
      matched.push({ left: leftEl, right: rightEl });
    } else {
      deleted.push(leftEl);
    }
  }

  const added: CssElement[] = [];
  for (const rightEl of rightElements) {
    if (!rightMatched.has(rightEl.key)) {
      added.push(rightEl);
    }
  }

  return { matched, added, deleted };
}

/**
 * Compare computed styles and return only the differences.
 */
function compareStyles(leftStyles: Record<string, string>, rightStyles: Record<string, string>): CssDiff[] {
  const diffs: CssDiff[] = [];
  const allProps = new Set([...Object.keys(leftStyles), ...Object.keys(rightStyles)]);

  for (const prop of allProps) {
    const leftVal = leftStyles[prop];
    const rightVal = rightStyles[prop];
    if (leftVal !== rightVal) {
      let type: string;
      if (leftVal === undefined) {
        type = 'added';
      } else if (rightVal === undefined) {
        type = 'deleted';
      } else {
        type = 'changed';
      }
      diffs.push({
        property: prop,
        expected: leftVal !== undefined ? leftVal : '',
        actual: rightVal !== undefined ? rightVal : '',
        category: classifyProperty(prop),
        type,
      });
    }
  }

  return diffs;
}

/**
 * Run full scan: collect styles from both views, match elements, compare styles.
 */
async function runFullScan(leftView: WebContentsView, rightView: WebContentsView): Promise<CssScanResult> {
  if (!leftView || leftView.webContents.isDestroyed()) {
    throw new Error('Left view is not available');
  }
  if (!rightView || rightView.webContents.isDestroyed()) {
    throw new Error('Right view is not available');
  }

  const [leftElements, rightElements]: [CssElement[], CssElement[]] = await Promise.all([
    leftView.webContents.executeJavaScript(CSS_COLLECTION_SCRIPT),
    rightView.webContents.executeJavaScript(CSS_COLLECTION_SCRIPT),
  ]);

  const { matched, added, deleted } = matchElements(leftElements, rightElements);

  const results: CssChangedElement[] = [];
  for (const pair of matched) {
    const diffs = compareStyles(pair.left.styles, pair.right.styles);
    if (diffs.length > 0) {
      results.push({
        tag: pair.left.tag,
        key: pair.left.key,
        method: pair.left.method,
        type: 'changed',
        diffCount: diffs.length,
        diffs,
      });
    }
  }

  // Sort by diff count descending
  results.sort((a, b) => b.diffCount - a.diffCount);

  return {
    scannedElements: leftElements.length + rightElements.length,
    leftCount: leftElements.length,
    rightCount: rightElements.length,
    changed: results,
    added: added.map((el) => ({ tag: el.tag, key: el.key, method: el.method, type: 'added' })),
    deleted: deleted.map((el) => ({ tag: el.tag, key: el.key, method: el.method, type: 'deleted' })),
    summary: {
      changedElements: results.length,
      addedElements: added.length,
      deletedElements: deleted.length,
      totalDiffProperties: results.reduce((sum, r) => sum + r.diffCount, 0),
    },
  };
}

/**
 * Generate self-contained HTML for the scan results window.
 */
function generateScanReportHTML(scanResult: CssScanResult): string {
  const dataJson = JSON.stringify(scanResult).replace(/<\//g, '<\\/');
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none';">
<title>Twin - CSS Scan Report</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
  --bg-primary: #0d1117;
  --bg-secondary: #161b22;
  --bg-tertiary: #21262d;
  --accent-blue: #58a6ff;
  --accent-purple: #7c3aed;
  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --border-default: #30363d;
  --status-passed: #3fb950;
  --status-failed: #f85149;
  --status-new: #d29922;
  --status-deleted: #8b949e;
  --radius-md: 6px;
  --radius-lg: 12px;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 20px;
  line-height: 1.5;
}
h1 { font-size: 20px; margin-bottom: 16px; }
.summary {
  display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;
}
.summary-card {
  padding: 12px 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  text-align: center;
}
.summary-card .value { font-size: 24px; font-weight: 700; }
.summary-card .label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px; }
.summary-card.changed .value { color: var(--status-failed); }
.summary-card.added .value { color: var(--status-new); }
.summary-card.deleted .value { color: var(--status-deleted); }
.filters {
  display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; align-items: center;
}
.filter-group { display: flex; gap: 4px; align-items: center; }
.filter-label { font-size: 11px; color: var(--text-secondary); text-transform: uppercase; margin-right: 4px; }
.filter-btn {
  height: 26px; padding: 0 10px; border: 1px solid var(--border-default);
  border-radius: 13px; background: var(--bg-tertiary); color: var(--text-primary);
  font-size: 11px; cursor: pointer; transition: all 0.15s ease;
}
.filter-btn:hover { background: #2d333b; }
.filter-btn.active { background: var(--accent-blue); border-color: var(--accent-blue); color: #fff; }
.search-input {
  height: 28px; padding: 0 10px; border: 1px solid var(--border-default);
  border-radius: var(--radius-md); background: var(--bg-primary); color: var(--text-primary);
  font-size: 12px; outline: none; min-width: 200px;
}
.search-input:focus { border-color: var(--accent-blue); }
.actions { margin-left: auto; display: flex; gap: 6px; }
.action-btn {
  height: 28px; padding: 0 12px; border: 1px solid var(--border-default);
  border-radius: var(--radius-md); background: var(--bg-tertiary); color: var(--text-primary);
  font-size: 11px; cursor: pointer; transition: all 0.15s ease;
}
.action-btn:hover { background: #2d333b; }
.card {
  background: var(--bg-secondary); border: 1px solid var(--border-default);
  border-radius: var(--radius-md); margin-bottom: 8px; overflow: hidden;
}
.card-header {
  display: flex; align-items: center; gap: 8px; padding: 10px 14px;
  cursor: pointer; user-select: none; transition: background 0.15s ease;
}
.card-header:hover { background: var(--bg-tertiary); }
.card-arrow { font-size: 10px; color: var(--text-secondary); transition: transform 0.2s ease; width: 16px; }
.card-arrow.open { transform: rotate(90deg); }
.card-tag { font-family: monospace; font-size: 12px; color: var(--accent-blue); }
.card-key { font-family: monospace; font-size: 11px; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-method {
  font-size: 10px; padding: 2px 6px; border-radius: 10px;
  background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border-default);
}
.card-count { font-size: 11px; font-weight: 600; }
.card-count.changed { color: var(--status-failed); }
.card-count.added { color: var(--status-new); }
.card-count.deleted { color: var(--status-deleted); }
.card-body { display: none; border-top: 1px solid var(--border-default); }
.card-body.open { display: block; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th {
  text-align: left; padding: 8px 14px; font-size: 10px;
  color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.3px;
  background: var(--bg-tertiary); border-bottom: 1px solid var(--border-default);
}
td { padding: 6px 14px; border-bottom: 1px solid var(--border-default); font-family: monospace; font-size: 11px; }
td.prop { color: var(--accent-blue); }
td.expected { color: var(--status-passed); }
td.actual { color: var(--status-failed); }
.cat-badge {
  font-size: 9px; padding: 1px 5px; border-radius: 8px;
  text-transform: uppercase; letter-spacing: 0.2px; display: inline-block;
}
.cat-layout { background: rgba(88,166,255,0.15); color: var(--accent-blue); }
.cat-text { background: rgba(63,185,80,0.15); color: var(--status-passed); }
.cat-visual { background: rgba(210,153,34,0.15); color: var(--status-new); }
.cat-other { background: rgba(139,148,158,0.15); color: var(--text-secondary); }
.diff-row { background: rgba(248,81,73,0.10); }
.diff-value { font-weight: 700; }
.empty-state { text-align: center; padding: 40px; color: var(--text-secondary); font-size: 14px; }
.description { margin-bottom: 16px; padding: 12px 16px; background: var(--bg-secondary); border: 1px solid var(--border-default); border-radius: var(--radius-md); font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
.description p { margin-bottom: 6px; }
.description .legend { font-size: 12px; }
.description .legend span { margin-right: 12px; }
.description .legend .changed-label { color: var(--status-failed); }
.description .legend .added-label { color: var(--status-new); }
.description .legend .deleted-label { color: var(--status-deleted); }
</style>
</head>
<body>
<h1>CSS Scan Report</h1>
<div class="description"><p>\u5DE6\u53F3\u306E\u30D6\u30E9\u30A6\u30B6\u30D3\u30E5\u30FC\u306B\u8868\u793A\u3057\u305F\u30DA\u30FC\u30B8\u306E CSS \u30D7\u30ED\u30D1\u30C6\u30A3\u3092\u6BD4\u8F03\u3057\u305F\u7D50\u679C\u3067\u3059\u3002</p><p class="legend"><span class="changed-label">Changed</span> = \u30B9\u30BF\u30A4\u30EB\u304C\u7570\u306A\u308B\u8981\u7D20\u3000<span class="added-label">Added</span> = \u53F3\u30D3\u30E5\u30FC\u306E\u307F\u306E\u8981\u7D20\u3000<span class="deleted-label">Deleted</span> = \u5DE6\u30D3\u30E5\u30FC\u306E\u307F\u306E\u8981\u7D20</p></div>
<div id="summary" class="summary"></div>
<div id="filters" class="filters"></div>
<div id="results"></div>
<script>
var data = ${dataJson};
var activeTypeFilter = 'all';
var activeCategoryFilter = 'all';
var searchQuery = '';

function init() {
  renderSummary();
  renderFilters();
  renderResults();
}

function renderSummary() {
  var s = data.summary;
  document.getElementById('summary').innerHTML =
    '<div class="summary-card"><div class="value">' + (data.leftCount) + '</div><div class="label">Left Elements</div></div>' +
    '<div class="summary-card"><div class="value">' + (data.rightCount) + '</div><div class="label">Right Elements</div></div>' +
    '<div class="summary-card changed"><div class="value">' + s.changedElements + '</div><div class="label">Changed</div></div>' +
    '<div class="summary-card added"><div class="value">' + s.addedElements + '</div><div class="label">Added</div></div>' +
    '<div class="summary-card deleted"><div class="value">' + s.deletedElements + '</div><div class="label">Deleted</div></div>' +
    '<div class="summary-card"><div class="value">' + s.totalDiffProperties + '</div><div class="label">Diff Properties</div></div>';
}

function renderFilters() {
  document.getElementById('filters').innerHTML =
    '<div class="filter-group">' +
      '<span class="filter-label">Type</span>' +
      '<button class="filter-btn' + (activeTypeFilter === 'all' ? ' active' : '') + '" data-type="all" title="\u3059\u3079\u3066\u306E\u8981\u7D20\u3092\u8868\u793A">All</button>' +
      '<button class="filter-btn' + (activeTypeFilter === 'changed' ? ' active' : '') + '" data-type="changed" title="\u30B9\u30BF\u30A4\u30EB\u304C\u7570\u306A\u308B\u8981\u7D20\u306E\u307F">Changed</button>' +
      '<button class="filter-btn' + (activeTypeFilter === 'added' ? ' active' : '') + '" data-type="added" title="\u53F3\u30D3\u30E5\u30FC\u306E\u307F\u306E\u8981\u7D20">Added</button>' +
      '<button class="filter-btn' + (activeTypeFilter === 'deleted' ? ' active' : '') + '" data-type="deleted" title="\u5DE6\u30D3\u30E5\u30FC\u306E\u307F\u306E\u8981\u7D20">Deleted</button>' +
    '</div>' +
    '<div class="filter-group">' +
      '<span class="filter-label">Category</span>' +
      '<button class="filter-btn' + (activeCategoryFilter === 'all' ? ' active' : '') + '" data-cat="all" title="\u3059\u3079\u3066\u306E\u30D7\u30ED\u30D1\u30C6\u30A3">All</button>' +
      '<button class="filter-btn' + (activeCategoryFilter === 'layout' ? ' active' : '') + '" data-cat="layout" title="\u30EC\u30A4\u30A2\u30A6\u30C8\u7CFB (display, position, flex\u7B49)">Layout</button>' +
      '<button class="filter-btn' + (activeCategoryFilter === 'text' ? ' active' : '') + '" data-cat="text" title="\u30C6\u30AD\u30B9\u30C8\u7CFB (font, color\u7B49)">Text</button>' +
      '<button class="filter-btn' + (activeCategoryFilter === 'visual' ? ' active' : '') + '" data-cat="visual" title="\u88C5\u98FE\u7CFB (background, shadow\u7B49)">Visual</button>' +
      '<button class="filter-btn' + (activeCategoryFilter === 'other' ? ' active' : '') + '" data-cat="other" title="\u305D\u306E\u4ED6">Other</button>' +
    '</div>' +
    '<input class="search-input" id="search" placeholder="Search element or property..." value="' + escapeHtml(searchQuery) + '" />' +
    '<div class="actions">' +
      '<button class="action-btn" id="export-json">Export JSON</button>' +
      '<button class="action-btn" id="copy-clipboard">Copy</button>' +
    '</div>';

  document.querySelectorAll('[data-type]').forEach(function(btn) {
    btn.addEventListener('click', function() { activeTypeFilter = this.dataset.type; renderFilters(); renderResults(); });
  });
  document.querySelectorAll('[data-cat]').forEach(function(btn) {
    btn.addEventListener('click', function() { activeCategoryFilter = this.dataset.cat; renderFilters(); renderResults(); });
  });
  document.getElementById('search').addEventListener('input', function() { searchQuery = this.value.toLowerCase(); renderResults(); });
  document.getElementById('export-json').addEventListener('click', exportJson);
  document.getElementById('copy-clipboard').addEventListener('click', copyToClipboard);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function filterDiffs(diffs) {
  if (activeCategoryFilter === 'all') return diffs;
  return diffs.filter(function(d) { return d.category === activeCategoryFilter; });
}

function matchesSearch(item) {
  if (!searchQuery) return true;
  var q = searchQuery;
  if (item.tag && item.tag.indexOf(q) !== -1) return true;
  if (item.key && item.key.toLowerCase().indexOf(q) !== -1) return true;
  if (item.diffs) {
    return item.diffs.some(function(d) { return d.property.indexOf(q) !== -1; });
  }
  return false;
}

function renderResults() {
  var container = document.getElementById('results');
  var items = [];

  if (activeTypeFilter === 'all' || activeTypeFilter === 'changed') {
    data.changed.forEach(function(c) { if (matchesSearch(c)) items.push(c); });
  }
  if (activeTypeFilter === 'all' || activeTypeFilter === 'added') {
    data.added.forEach(function(a) { if (matchesSearch(a)) items.push(a); });
  }
  if (activeTypeFilter === 'all' || activeTypeFilter === 'deleted') {
    data.deleted.forEach(function(d) { if (matchesSearch(d)) items.push(d); });
  }

  if (items.length === 0) {
    var totalDiffs = data.changed.length + data.added.length + data.deleted.length;
    if (totalDiffs === 0) {
      container.innerHTML = '<div class="empty-state">\u5DEE\u5206\u306F\u3042\u308A\u307E\u305B\u3093 \u2014 \u4E21\u30DA\u30FC\u30B8\u306E CSS \u306F\u4E00\u81F4\u3057\u3066\u3044\u307E\u3059 \uD83C\uDF89</div>';
    } else {
      container.innerHTML = '<div class="empty-state">No differences found for the current filters</div>';
    }
    return;
  }

  var html = '';
  items.forEach(function(item, idx) {
    var diffs = item.diffs ? filterDiffs(item.diffs) : [];
    var countLabel = item.type === 'changed' ? (diffs.length + ' props') : item.type;
    var countClass = item.type;

    html += '<div class="card">';
    html += '<div class="card-header" data-idx="' + idx + '">';
    html += '<span class="card-arrow" id="arrow-' + idx + '">&#9654;</span>';
    html += '<span class="card-tag">&lt;' + escapeHtml(item.tag) + '&gt;</span>';
    html += '<span class="card-key" title="' + escapeHtml(item.key) + '">' + escapeHtml(item.key) + '</span>';
    html += '<span class="card-method">' + escapeHtml(item.method) + '</span>';
    html += '<span class="card-count ' + countClass + '">' + countLabel + '</span>';
    html += '</div>';

    if (item.type === 'changed' && diffs.length > 0) {
      html += '<div class="card-body" id="body-' + idx + '">';
      html += '<table><thead><tr><th>Property</th><th>Category</th><th>Left (Expected)</th><th>Right (Actual)</th></tr></thead><tbody>';
      diffs.forEach(function(d) {
        html += '<tr class="diff-row">';
        html += '<td class="prop">' + escapeHtml(d.property) + '</td>';
        html += '<td><span class="cat-badge cat-' + d.category + '">' + d.category + '</span></td>';
        html += '<td class="expected diff-value">' + escapeHtml(d.expected) + '</td>';
        html += '<td class="actual diff-value">' + escapeHtml(d.actual) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
  });

  container.innerHTML = html;

  document.querySelectorAll('.card-header').forEach(function(hdr) {
    hdr.addEventListener('click', function() {
      var idx = this.dataset.idx;
      var body = document.getElementById('body-' + idx);
      var arrow = document.getElementById('arrow-' + idx);
      if (body) {
        body.classList.toggle('open');
        arrow.classList.toggle('open');
      }
    });
  });
}

function exportJson() {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'css-scan-report.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function copyToClipboard() {
  navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(function() {
    var btn = document.getElementById('copy-clipboard');
    btn.textContent = 'Copied!';
    setTimeout(function() { btn.textContent = 'Copy'; }, 1500);
  });
}

init();
</script>
</body>
</html>`;
}

export {
  classifyProperty,
  matchElements,
  compareStyles,
  runFullScan,
  generateScanReportHTML,
  buildGetElementStylesScript,
  buildHighlightScript,
  CSS_COLLECTION_SCRIPT,
  CSS_INSPECT_SCRIPT,
  CSS_INSPECT_CLEANUP_SCRIPT,
  CSS_INSPECT_PREFIX,
  CLEAR_HIGHLIGHT_SCRIPT,
  LAYOUT_PROPS,
  TEXT_PROPS,
  VISUAL_PROPS,
};
