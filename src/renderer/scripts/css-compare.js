/**
 * CSS Comparison UI logic for the renderer process.
 * Handles CSS scan button, inspect mode toggle, and inspect drawer.
 */
function initCssCompare() {
  const cssScanBtn = document.getElementById('css-scan-btn');
  const cssInspectBtn = document.getElementById('css-inspect-btn');
  const inspectDrawer = document.getElementById('css-inspect-drawer');
  const inspectDrawerClose = document.getElementById('css-inspect-drawer-close');
  const inspectDrawerHandle = document.getElementById('css-inspect-drawer-handle');
  const inspectDrawerBody = document.getElementById('css-inspect-drawer-body');
  const inspectFilterDiff = document.getElementById('css-inspect-filter-diff');
  const inspectFilterAll = document.getElementById('css-inspect-filter-all');
  const inspectCategoryBtns = document.querySelectorAll('.css-inspect-cat-btn');
  const inspectHeader = document.getElementById('css-inspect-header-info');

  let inspectActive = false;
  let currentInspectData = null;
  let inspectShowDiffOnly = true;
  let inspectCategoryFilter = 'all';

  // --- CSS Full Scan ---
  cssScanBtn.addEventListener('click', startCssScan);

  async function startCssScan() {
    cssScanBtn.disabled = true;
    cssScanBtn.innerHTML = '<span class="css-spinner"></span> Scanning...';
    try {
      await window.electronAPI.cssFullScan();
    } catch (err) {
      showCssToast('CSS Scan failed: ' + err.message, 'error');
    } finally {
      cssScanBtn.disabled = false;
      cssScanBtn.textContent = '\u{1F3A8} CSS Scan';
    }
  }

  // --- CSS Inspect Mode ---
  cssInspectBtn.addEventListener('click', toggleInspectMode);

  async function toggleInspectMode() {
    inspectActive = !inspectActive;
    try {
      await window.electronAPI.cssInspectToggle({ enabled: inspectActive });
    } catch {
      inspectActive = false;
    }
    updateInspectButtonState();
    if (!inspectActive) {
      hideInspectDrawer();
    }
  }

  function updateInspectButtonState() {
    cssInspectBtn.classList.toggle('css-inspect-active', inspectActive);
    cssInspectBtn.textContent = inspectActive ? '\u{1F50D} Inspect ON' : '\u{1F50D} Inspect';
  }

  function disableInspectMode() {
    if (!inspectActive) return;
    inspectActive = false;
    window.electronAPI.cssInspectToggle({ enabled: false }).catch(() => {});
    updateInspectButtonState();
    hideInspectDrawer();
  }

  // Escape key disables inspect mode
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && inspectActive) {
      disableInspectMode();
    }
  });

  // --- Inspect Drawer ---
  function showInspectDrawer() {
    inspectDrawer.classList.remove('hidden');
  }

  function hideInspectDrawer() {
    inspectDrawer.classList.add('hidden');
    currentInspectData = null;
  }

  inspectDrawerClose.addEventListener('click', () => {
    hideInspectDrawer();
  });

  // Drawer resize via drag handle
  let dragging = false;
  let startY = 0;
  let startHeight = 0;

  inspectDrawerHandle.addEventListener('mousedown', (e) => {
    dragging = true;
    startY = e.clientY;
    startHeight = inspectDrawer.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const delta = startY - e.clientY;
    const newHeight = Math.min(400, Math.max(100, startHeight + delta));
    inspectDrawer.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  });

  // --- Filter Controls ---
  inspectFilterDiff.addEventListener('click', () => {
    inspectShowDiffOnly = true;
    inspectFilterDiff.classList.add('active');
    inspectFilterAll.classList.remove('active');
    renderInspectDiffs();
  });

  inspectFilterAll.addEventListener('click', () => {
    inspectShowDiffOnly = false;
    inspectFilterAll.classList.add('active');
    inspectFilterDiff.classList.remove('active');
    renderInspectDiffs();
  });

  inspectCategoryBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      inspectCategoryFilter = btn.dataset.cat;
      inspectCategoryBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      renderInspectDiffs();
    });
  });

  // --- Inspect Result Handler ---
  window.electronAPI.onCssInspectResult((data) => {
    if (data.modeDisabled) {
      disableInspectMode();
      return;
    }
    currentInspectData = data;
    showInspectDrawer();
    renderInspectHeader(data);
    renderInspectDiffs();
  });

  function renderInspectHeader(data) {
    if (data.error) {
      inspectHeader.innerHTML =
        '<span class="css-inspect-tag">&lt;' + escapeHtml(data.left ? data.left.tag : '?') + '&gt;</span> ' +
        '<span class="css-inspect-key">' + escapeHtml(data.left ? data.left.key : '') + '</span> ' +
        '<span class="css-inspect-error">' + escapeHtml(data.error) + '</span>';
      return;
    }
    const diffCount = data.diffs ? data.diffs.filter((d) => d.type === 'changed' || d.type === 'added' || d.type === 'deleted').length : 0;
    inspectHeader.innerHTML =
      '<span class="css-inspect-tag">&lt;' + escapeHtml(data.left.tag) + '&gt;</span> ' +
      '<span class="css-inspect-key">' + escapeHtml(data.left.key) + '</span> ' +
      '<span class="css-inspect-method">' + escapeHtml(data.left.method) + '</span> ' +
      '<span class="css-inspect-diff-count">' + diffCount + ' differences</span>';
  }

  function renderInspectDiffs() {
    if (!currentInspectData || currentInspectData.error) {
      inspectDrawerBody.innerHTML = currentInspectData && currentInspectData.error
        ? '<div class="css-inspect-empty">' + escapeHtml(currentInspectData.error) + '</div>'
        : '<div class="css-inspect-empty"><div class="css-inspect-guide-title">CSS Inspect Mode</div><div class="css-inspect-guide-text">左パネルの要素をクリックすると、右パネルの対応する要素との CSS プロパティの差分を表示します。</div><div class="css-inspect-guide-steps"><span>1. 左パネルで要素をホバー（青枠表示）</span><span>2. クリックして選択</span><span>3. 右パネルの対応要素（オレンジ枠）と比較</span><span>4. Esc キーで終了</span></div></div>';
      return;
    }

    const data = currentInspectData;
    let rows = [];

    if (inspectShowDiffOnly) {
      rows = data.diffs || [];
    } else {
      // Show all properties
      const allProps = new Set();
      if (data.left && data.left.styles) Object.keys(data.left.styles).forEach((p) => allProps.add(p));
      if (data.right && data.right.styles) Object.keys(data.right.styles).forEach((p) => allProps.add(p));
      const diffs = data.diffs || [];
      const diffProps = new Set(diffs.map((d) => d.property));

      for (const prop of allProps) {
        const leftVal = data.left && data.left.styles ? data.left.styles[prop] || '' : '';
        const rightVal = data.right && data.right.styles ? data.right.styles[prop] || '' : '';
        rows.push({
          property: prop,
          expected: leftVal,
          actual: rightVal,
          category: getCategoryForProp(prop),
          isDiff: diffProps.has(prop),
        });
      }
    }

    // Apply category filter
    if (inspectCategoryFilter !== 'all') {
      rows = rows.filter((r) => r.category === inspectCategoryFilter);
    }

    if (rows.length === 0) {
      inspectDrawerBody.innerHTML = '<div class="css-inspect-empty">No matching properties</div>';
      return;
    }

    let html = '<table class="css-inspect-table"><thead><tr>' +
      '<th>Property</th><th>Category</th><th>Left (Expected)</th><th>Right (Actual)</th><th></th>' +
      '</tr></thead><tbody>';

    for (const row of rows) {
      const isDiff = row.isDiff !== undefined ? row.isDiff : true;
      const rowClass = isDiff ? 'css-diff-row' : '';
      html += '<tr class="' + rowClass + '">';
      html += '<td class="css-prop">' + escapeHtml(row.property) + '</td>';
      html += '<td><span class="css-cat-badge css-cat-' + row.category + '">' + row.category + '</span></td>';
      html += '<td class="css-expected">' + escapeHtml(row.expected) + '</td>';
      html += '<td class="css-actual">' + escapeHtml(row.actual) + '</td>';
      html += '<td class="css-match-icon">' + (isDiff ? '\u2260' : '\u2713') + '</td>';
      html += '</tr>';
    }

    html += '</tbody></table>';
    inspectDrawerBody.innerHTML = html;
  }

  // --- Shortcut Handlers ---
  window.electronAPI.onShortcutCssScan(() => startCssScan());
  window.electronAPI.onShortcutCssInspect(() => toggleInspectMode());

  // --- Helpers ---
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showCssToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast toast-' + type;
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Simple category classification (client-side)
  const LAYOUT_SET = new Set([
    'display', 'position', 'top', 'right', 'bottom', 'left',
    'float', 'clear', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'border-width', 'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap',
    'justify-content', 'align-items', 'align-self', 'align-content',
    'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
    'gap', 'row-gap', 'column-gap', 'box-sizing', 'vertical-align',
  ]);
  const TEXT_SET = new Set([
    'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
    'line-height', 'letter-spacing', 'word-spacing', 'text-align', 'text-decoration',
    'text-transform', 'text-indent', 'text-shadow', 'white-space', 'word-break',
    'word-wrap', 'overflow-wrap', 'color', 'direction', 'unicode-bidi', 'writing-mode',
  ]);
  const VISUAL_SET = new Set([
    'background', 'background-color', 'background-image', 'background-position',
    'background-size', 'background-repeat',
    'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-style', 'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-radius', 'border-top-left-radius', 'border-top-right-radius',
    'border-bottom-left-radius', 'border-bottom-right-radius',
    'box-shadow', 'opacity', 'visibility',
    'outline', 'outline-color', 'outline-style', 'outline-width',
    'transform', 'transition', 'animation', 'cursor', 'filter', 'backdrop-filter',
  ]);

  function getCategoryForProp(prop) {
    if (LAYOUT_SET.has(prop)) return 'layout';
    if (TEXT_SET.has(prop)) return 'text';
    if (VISUAL_SET.has(prop)) return 'visual';
    return 'other';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initCssCompare };
}
