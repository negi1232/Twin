/**
 * CSS Comparison UI logic for the renderer process.
 * Handles CSS scan button, inspect mode toggle, and inspect drawer.
 */
function initCssCompare(): void {
  const cssScanBtn = document.getElementById('css-scan-btn') as HTMLButtonElement;
  const cssInspectBtn = document.getElementById('css-inspect-btn') as HTMLButtonElement;
  const inspectDrawer = document.getElementById('css-inspect-drawer') as HTMLElement;
  const inspectDrawerClose = document.getElementById('css-inspect-drawer-close') as HTMLButtonElement;
  const inspectDrawerHandle = document.getElementById('css-inspect-drawer-handle') as HTMLElement;
  const inspectDrawerBody = document.getElementById('css-inspect-drawer-body') as HTMLElement;
  const inspectFilterDiff = document.getElementById('css-inspect-filter-diff') as HTMLButtonElement;
  const inspectFilterAll = document.getElementById('css-inspect-filter-all') as HTMLButtonElement;
  const inspectCategoryBtns = document.querySelectorAll('.css-inspect-cat-btn') as NodeListOf<HTMLButtonElement>;
  const inspectHeader = document.getElementById('css-inspect-header-info') as HTMLElement;

  let inspectActive: boolean = false;
  let currentInspectData: CssInspectResultData | null = null;
  let inspectShowDiffOnly: boolean = true;
  let inspectCategoryFilter: string = 'all';

  // --- CSS Full Scan ---
  cssScanBtn.addEventListener('click', startCssScan);

  async function startCssScan(): Promise<void> {
    cssScanBtn.disabled = true;
    cssScanBtn.innerHTML = '<span class="css-spinner"></span> Scanning...';
    try {
      await window.electronAPI.cssFullScan();
    } catch (err) {
      showCssToast(`CSS Scan failed: ${(err as Error).message}`, 'error');
    } finally {
      cssScanBtn.disabled = false;
      cssScanBtn.textContent = '\u{1F3A8} CSS Scan';
    }
  }

  // --- CSS Inspect Mode ---
  cssInspectBtn.addEventListener('click', toggleInspectMode);

  async function toggleInspectMode(): Promise<void> {
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

  function updateInspectButtonState(): void {
    cssInspectBtn.classList.toggle('css-inspect-active', inspectActive);
    cssInspectBtn.textContent = inspectActive ? '\u{1F50D} Inspect ON' : '\u{1F50D} Inspect';
  }

  function disableInspectMode(): void {
    if (!inspectActive) return;
    inspectActive = false;
    window.electronAPI.cssInspectToggle({ enabled: false }).catch(() => {});
    updateInspectButtonState();
    hideInspectDrawer();
  }

  // Escape key disables inspect mode
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape' && inspectActive) {
      disableInspectMode();
    }
  });

  // --- Inspect Drawer ---
  function showInspectDrawer(): void {
    inspectDrawer.classList.remove('hidden');
  }

  function hideInspectDrawer(): void {
    inspectDrawer.classList.add('hidden');
    currentInspectData = null;
  }

  inspectDrawerClose.addEventListener('click', () => {
    hideInspectDrawer();
  });

  // Drawer resize via drag handle
  let dragging: boolean = false;
  let startY: number = 0;
  let startHeight: number = 0;

  inspectDrawerHandle.addEventListener('mousedown', (e: MouseEvent) => {
    dragging = true;
    startY = e.clientY;
    startHeight = inspectDrawer.offsetHeight;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!dragging) return;
    const delta = startY - e.clientY;
    const newHeight = Math.min(400, Math.max(100, startHeight + delta));
    inspectDrawer.style.height = `${newHeight}px`;
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
      inspectCategoryFilter = btn.dataset.cat || 'all';
      inspectCategoryBtns.forEach((b) => {
        b.classList.remove('active');
      });
      btn.classList.add('active');
      renderInspectDiffs();
    });
  });

  // --- Inspect Result Handler ---
  window.electronAPI.onCssInspectResult((data: CssInspectResultData) => {
    if (data.modeDisabled) {
      disableInspectMode();
      return;
    }
    currentInspectData = data;
    showInspectDrawer();
    renderInspectHeader(data);
    renderInspectDiffs();
  });

  function renderInspectHeader(data: CssInspectResultData): void {
    if (data.error) {
      inspectHeader.innerHTML =
        '<span class="css-inspect-tag">&lt;' +
        escapeHtml(data.left ? data.left.tag : '?') +
        '&gt;</span> ' +
        '<span class="css-inspect-key">' +
        escapeHtml(data.left ? data.left.key : '') +
        '</span> ' +
        '<span class="css-inspect-error">' +
        escapeHtml(data.error) +
        '</span>';
      return;
    }
    const diffCount = data.diffs
      ? data.diffs.filter((d) => d.type === 'changed' || d.type === 'added' || d.type === 'deleted').length
      : 0;
    inspectHeader.innerHTML =
      '<span class="css-inspect-tag">&lt;' +
      escapeHtml(data.left?.tag) +
      '&gt;</span> ' +
      '<span class="css-inspect-key">' +
      escapeHtml(data.left?.key) +
      '</span> ' +
      '<span class="css-inspect-method">' +
      escapeHtml(data.left?.method) +
      '</span> ' +
      '<span class="css-inspect-diff-count">' +
      diffCount +
      ' differences</span>';
  }

  function renderInspectDiffs(): void {
    if (!currentInspectData || currentInspectData.error) {
      inspectDrawerBody.innerHTML = currentInspectData?.error
        ? `<div class="css-inspect-empty">${escapeHtml(currentInspectData.error)}</div>`
        : '<div class="css-inspect-empty"><div class="css-inspect-guide-title">CSS Inspect Mode</div><div class="css-inspect-guide-text">\u5DE6\u30D1\u30CD\u30EB\u306E\u8981\u7D20\u3092\u30AF\u30EA\u30C3\u30AF\u3059\u308B\u3068\u3001\u53F3\u30D1\u30CD\u30EB\u306E\u5BFE\u5FDC\u3059\u308B\u8981\u7D20\u3068\u306E CSS \u30D7\u30ED\u30D1\u30C6\u30A3\u306E\u5DEE\u5206\u3092\u8868\u793A\u3057\u307E\u3059\u3002</div><div class="css-inspect-guide-steps"><span>1. \u5DE6\u30D1\u30CD\u30EB\u3067\u8981\u7D20\u3092\u30DB\u30D0\u30FC\uFF08\u9752\u679A\u8868\u793A\uFF09</span><span>2. \u30AF\u30EA\u30C3\u30AF\u3057\u3066\u9078\u629E</span><span>3. \u53F3\u30D1\u30CD\u30EB\u306E\u5BFE\u5FDC\u8981\u7D20\uFF08\u30AA\u30EC\u30F3\u30B8\u679A\uFF09\u3068\u6BD4\u8F03</span><span>4. Esc \u30AD\u30FC\u3067\u7D42\u4E86</span></div></div>';
      return;
    }

    const data = currentInspectData;
    let rows: CssInspectDiff[] = [];

    if (inspectShowDiffOnly) {
      rows = data.diffs || [];
    } else {
      // Show all properties
      const allProps = new Set<string>();
      if (data.left?.styles) {
        for (const p of Object.keys(data.left.styles)) allProps.add(p);
      }
      if (data.right?.styles) {
        for (const p of Object.keys(data.right.styles)) allProps.add(p);
      }
      const diffs = data.diffs || [];
      const diffProps = new Set(diffs.map((d) => d.property));

      for (const prop of allProps) {
        const leftVal = data.left?.styles ? data.left.styles[prop] || '' : '';
        const rightVal = data.right?.styles ? data.right.styles[prop] || '' : '';
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

    let html =
      '<table class="css-inspect-table"><thead><tr>' +
      '<th>Property</th><th>Category</th><th>Left (Expected)</th><th>Right (Actual)</th><th></th>' +
      '</tr></thead><tbody>';

    for (const row of rows) {
      const isDiff = row.isDiff !== undefined ? row.isDiff : true;
      const rowClass = isDiff ? 'css-diff-row' : '';
      html += `<tr class="${rowClass}">`;
      html += `<td class="css-prop">${escapeHtml(row.property)}</td>`;
      html += `<td><span class="css-cat-badge css-cat-${row.category}">${row.category}</span></td>`;
      html += `<td class="css-expected">${escapeHtml(row.expected)}</td>`;
      html += `<td class="css-actual">${escapeHtml(row.actual)}</td>`;
      html += `<td class="css-match-icon">${isDiff ? '\u2260' : '\u2713'}</td>`;
      html += '</tr>';
    }

    html += '</tbody></table>';
    inspectDrawerBody.innerHTML = html;
  }

  // --- Shortcut Handlers ---
  window.electronAPI.onShortcutCssScan(() => startCssScan());
  window.electronAPI.onShortcutCssInspect(() => toggleInspectMode());

  // --- Helpers ---
  function escapeHtml(str: string | null | undefined): string {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showCssToast(message: string, type: string): void {
    const toast = document.getElementById('toast') as HTMLElement;
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Simple category classification (client-side)
  const LAYOUT_SET: Set<string> = new Set([
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
  const TEXT_SET: Set<string> = new Set([
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
  const VISUAL_SET: Set<string> = new Set([
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

  function getCategoryForProp(prop: string): string {
    if (LAYOUT_SET.has(prop)) return 'layout';
    if (TEXT_SET.has(prop)) return 'text';
    if (VISUAL_SET.has(prop)) return 'visual';
    return 'other';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initCssCompare };
}
