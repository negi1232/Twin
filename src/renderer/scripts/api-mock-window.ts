/**
 * API Mock Capture Window — renderer script.
 * Runs in the standalone API Mock Capture window (not the main window).
 * Provides timeline/directory views and a detail panel with JSON syntax highlighting.
 */
(() => {
  const captureBtn = document.getElementById('capture-btn') as HTMLButtonElement;
  const captureStatus = document.getElementById('capture-status') as HTMLElement;
  const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
  const mswVersion = document.getElementById('msw-version') as HTMLSelectElement;
  const requestCountEl = document.getElementById('request-count') as HTMLElement;
  const endpointCountEl = document.getElementById('endpoint-count') as HTMLElement;
  const contentWrapper = document.getElementById('content-wrapper') as HTMLElement;
  const emptyState = document.getElementById('empty-state') as HTMLElement;
  const leftPanel = document.getElementById('left-panel') as HTMLElement;
  const rightPanel = document.getElementById('right-panel') as HTMLElement;
  const resizeHandle = document.getElementById('resize-handle') as HTMLElement;
  const tabTimeline = document.getElementById('tab-timeline') as HTMLButtonElement;
  const tabDirectory = document.getElementById('tab-directory') as HTMLButtonElement;
  const toast = document.getElementById('toast') as HTMLElement;

  let capturing = false;
  let currentTab: 'timeline' | 'directory' = 'timeline';
  let capturedData: CapturedApiGroup[] = [];
  let allEntries: CapturedApiEntry[] = [];
  let selectedEntry: CapturedApiEntry | null = null;

  // --- Capture toggle ---
  captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    try {
      if (capturing) {
        await window.electronAPI.apiMockStopCapture();
        capturing = false;
      } else {
        await window.electronAPI.apiMockStartCapture();
        capturing = true;
      }
    } catch {
      capturing = false;
    }
    captureBtn.disabled = false;
    updateCaptureUI();
  });

  function updateCaptureUI(): void {
    if (capturing) {
      captureBtn.textContent = 'Stop Capture';
      captureBtn.classList.add('stopping');
      captureStatus.textContent = 'Capturing...';
      captureStatus.classList.add('active');
    } else {
      captureBtn.textContent = 'Start Capture';
      captureBtn.classList.remove('stopping');
      captureStatus.textContent = 'Stopped';
      captureStatus.classList.remove('active');
    }
  }

  // --- MSW version persistence ---
  mswVersion.addEventListener('change', () => {
    localStorage.setItem('apiMockMswVersion', mswVersion.value);
  });

  // --- Export ---
  exportBtn.addEventListener('click', async () => {
    const version = mswVersion.value as 'v1' | 'v2';
    exportBtn.disabled = true;
    exportBtn.textContent = 'Exporting...';
    try {
      const result = await window.electronAPI.apiMockExport({ mswVersion: version });
      if (result) {
        showToast(`Exported ${result.totalEndpoints} endpoints to ${result.outputDir}`, 'success');
      }
    } catch (err) {
      showToast(`Export failed: ${(err as Error).message}`, 'error');
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export';
    }
  });

  // --- Clear ---
  clearBtn.addEventListener('click', async () => {
    try {
      await window.electronAPI.apiMockClear();
      capturedData = [];
      allEntries = [];
      selectedEntry = null;
      renderContent(0, []);
    } catch (err) {
      showToast(`Clear failed: ${(err as Error).message}`, 'error');
    }
  });

  // --- Tab switching ---
  tabTimeline.addEventListener('click', () => {
    if (currentTab === 'timeline') return;
    currentTab = 'timeline';
    tabTimeline.classList.add('active');
    tabDirectory.classList.remove('active');
    renderLeftPanel();
  });

  tabDirectory.addEventListener('click', () => {
    if (currentTab === 'directory') return;
    currentTab = 'directory';
    tabDirectory.classList.add('active');
    tabTimeline.classList.remove('active');
    renderLeftPanel();
  });

  // --- Real-time updates ---
  window.electronAPI.onApiMockCaptureUpdate((data: ApiMockCaptureUpdateData) => {
    renderContent(data.count, data.endpoints);
    // Fetch full data for detail views
    window.electronAPI
      .apiMockGetCapturedData()
      .then((groups) => {
        capturedData = groups;
        allEntries = flattenEntries(groups);
        renderLeftPanel();
      })
      .catch(() => {
        // Ignore fetch error
      });
  });

  // --- Flatten entries ---
  function flattenEntries(groups: CapturedApiGroup[]): CapturedApiEntry[] {
    const entries: CapturedApiEntry[] = [];
    for (const group of groups) {
      for (const entry of group.entries) {
        entries.push(entry);
      }
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    return entries;
  }

  // --- Render content ---
  function renderContent(count: number, endpoints: string[]): void {
    requestCountEl.textContent = String(count);
    endpointCountEl.textContent = String(endpoints.length);

    exportBtn.disabled = endpoints.length === 0;
    clearBtn.disabled = endpoints.length === 0;

    if (endpoints.length === 0) {
      contentWrapper.style.display = 'none';
      emptyState.style.display = 'flex';
      emptyState.innerHTML =
        '<div class="empty-icon">&#x1F4E1;</div>' +
        '<div class="empty-title">' +
        (capturing ? 'Waiting for requests...' : 'Ready to capture') +
        '</div>' +
        '<div class="empty-text">' +
        '左パネルの API リクエスト (XHR/Fetch) を自動キャプチャし、<br>' +
        'MSW ハンドラーとしてエクスポートします。' +
        '</div>';
    } else {
      emptyState.style.display = 'none';
      contentWrapper.style.display = 'flex';
    }
  }

  // --- Render left panel ---
  function renderLeftPanel(): void {
    if (currentTab === 'timeline') {
      renderTimeline();
    } else {
      renderDirectory();
    }
  }

  // --- Timeline view ---
  function renderTimeline(): void {
    if (allEntries.length === 0) {
      leftPanel.innerHTML = '';
      return;
    }

    let html = '';
    for (const entry of allEntries) {
      const time = formatTime(entry.timestamp);
      const pathname = extractPathname(entry.request.url);
      const method = entry.request.method;
      const status = entry.response.status;
      const isSelected = selectedEntry && selectedEntry.requestId === entry.requestId;
      html +=
        '<div class="timeline-item' +
        (isSelected ? ' selected' : '') +
        '" data-request-id="' +
        escapeAttr(entry.requestId) +
        '">' +
        '<span class="timeline-time">' +
        escapeHtml(time) +
        '</span>' +
        '<span class="method-badge method-' +
        escapeAttr(method) +
        '">' +
        escapeHtml(method) +
        '</span>' +
        '<div class="timeline-info"><span class="timeline-path">' +
        escapeHtml(pathname) +
        '</span></div>' +
        '<span class="status-badge ' +
        statusClass(status) +
        '">' +
        status +
        '</span>' +
        '</div>';
    }
    leftPanel.innerHTML = html;

    // Click handlers
    leftPanel.querySelectorAll('.timeline-item').forEach((item) => {
      item.addEventListener('click', () => {
        const reqId = (item as HTMLElement).dataset.requestId;
        selectEntry(reqId || '');
      });
    });
  }

  // --- Directory view ---
  function renderDirectory(): void {
    if (capturedData.length === 0) {
      leftPanel.innerHTML = '';
      return;
    }

    let html = '';
    for (const group of capturedData) {
      const key = group.method + ' ' + group.urlPattern;
      html +=
        '<div class="dir-group open">' +
        '<div class="dir-group-header" data-group-key="' +
        escapeAttr(key) +
        '">' +
        '<span class="dir-group-arrow">&#9654;</span>' +
        '<span class="method-badge method-' +
        escapeAttr(group.method) +
        '">' +
        escapeHtml(group.method) +
        '</span>' +
        '<span class="dir-group-path">' +
        escapeHtml(group.urlPattern) +
        '</span>' +
        '<span class="dir-group-count">' +
        group.entries.length +
        '</span>' +
        '</div>' +
        '<div class="dir-entries">';

      // Sort entries within group by timestamp descending
      const sorted = [...group.entries].sort((a, b) => b.timestamp - a.timestamp);
      for (const entry of sorted) {
        const time = formatTime(entry.timestamp);
        const isSelected = selectedEntry && selectedEntry.requestId === entry.requestId;
        html +=
          '<div class="dir-entry' +
          (isSelected ? ' selected' : '') +
          '" data-request-id="' +
          escapeAttr(entry.requestId) +
          '">' +
          '<span class="dir-entry-time">' +
          escapeHtml(time) +
          '</span>' +
          '<span class="status-badge ' +
          statusClass(entry.response.status) +
          '">' +
          entry.response.status +
          '</span>' +
          '</div>';
      }
      html += '</div></div>';
    }
    leftPanel.innerHTML = html;

    // Group toggle
    leftPanel.querySelectorAll('.dir-group-header').forEach((header) => {
      header.addEventListener('click', () => {
        const group = header.parentElement;
        if (group) {
          group.classList.toggle('open');
        }
      });
    });

    // Entry click
    leftPanel.querySelectorAll('.dir-entry').forEach((entry) => {
      entry.addEventListener('click', (ev: Event) => {
        ev.stopPropagation();
        const reqId = (entry as HTMLElement).dataset.requestId;
        selectEntry(reqId || '');
      });
    });
  }

  // --- Select entry ---
  function selectEntry(requestId: string): void {
    const entry = allEntries.find((e) => e.requestId === requestId);
    if (!entry) return;
    selectedEntry = entry;
    renderLeftPanel();
    renderDetail(entry);
  }

  // --- Render detail panel ---
  function renderDetail(entry: CapturedApiEntry): void {
    const method = entry.request.method;
    const url = entry.request.url;
    const status = entry.response.status;
    const time = formatTimeFull(entry.timestamp);

    let html =
      '<div class="detail-header">' +
      '<span class="method-badge method-' +
      escapeAttr(method) +
      '">' +
      escapeHtml(method) +
      '</span>' +
      '<span class="detail-url">' +
      escapeHtml(url) +
      '</span>' +
      '<span class="status-badge ' +
      statusClass(status) +
      '">' +
      status +
      '</span>' +
      '<div class="detail-timestamp">' +
      escapeHtml(time) +
      '</div>' +
      '</div>';

    // Request Headers
    html += renderSection('Request Headers', renderHeaders(entry.request.headers), false);

    // Request Body
    if (entry.request.body !== undefined && entry.request.body !== null) {
      html += renderSection('Request Body', renderJsonViewer(entry.request.body), true);
    }

    // Response Headers
    html += renderSection('Response Headers', renderHeaders(entry.response.headers), false);

    // Response Body
    if (entry.response.body !== undefined && entry.response.body !== null) {
      html += renderSection('Response Body', renderJsonViewer(entry.response.body), true);
    }

    rightPanel.innerHTML = html;

    // Section toggle
    rightPanel.querySelectorAll('.section-header').forEach((sh) => {
      sh.addEventListener('click', () => {
        const section = sh.parentElement;
        if (section) {
          section.classList.toggle('open');
        }
      });
    });
  }

  function renderSection(title: string, bodyHtml: string, openByDefault: boolean): string {
    return (
      '<div class="section' +
      (openByDefault ? ' open' : '') +
      '">' +
      '<div class="section-header">' +
      '<span class="section-arrow">&#9654;</span>' +
      escapeHtml(title) +
      '</div>' +
      '<div class="section-body">' +
      bodyHtml +
      '</div>' +
      '</div>'
    );
  }

  function renderHeaders(headers: Record<string, string>): string {
    const keys = Object.keys(headers);
    if (keys.length === 0) {
      return '<span style="color:#6c7086;font-size:12px;">No headers</span>';
    }
    let html = '<table class="headers-table">';
    for (const key of keys) {
      html += '<tr><td>' + escapeHtml(key) + '</td><td>' + escapeHtml(headers[key]) + '</td></tr>';
    }
    html += '</table>';
    return html;
  }

  function renderJsonViewer(data: unknown): string {
    if (typeof data === 'string') {
      // Try to parse as JSON for pretty display
      try {
        const parsed = JSON.parse(data);
        return '<div class="json-viewer">' + syntaxHighlight(JSON.stringify(parsed, null, 2)) + '</div>';
      } catch {
        return '<div class="json-viewer json-plain">' + escapeHtml(data) + '</div>';
      }
    }
    if (data === null || data === undefined) {
      return '<div class="json-viewer"><span class="json-null">null</span></div>';
    }
    return '<div class="json-viewer">' + syntaxHighlight(JSON.stringify(data, null, 2)) + '</div>';
  }

  // --- Syntax highlight ---
  function syntaxHighlight(json: string): string {
    const escaped = escapeHtml(json);
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (match.startsWith('"')) {
          if (match.endsWith(':')) {
            // Key — remove the colon from the span, add it back outside
            return '<span class="json-key">' + match.slice(0, -1) + '</span>:';
          }
          cls = 'json-string';
        } else if (/^true|false$/.test(match)) {
          cls = 'json-boolean';
        } else if (match === 'null') {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      },
    );
  }

  // --- Resize handle ---
  (() => {
    let dragging = false;
    let startX = 0;
    let startWidth = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startWidth = leftPanel.offsetWidth;
      resizeHandle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(200, Math.min(600, startWidth + dx));
      leftPanel.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      resizeHandle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });
  })();

  // --- Helpers ---
  function formatTime(ts: number): string {
    const d = new Date(ts);
    return (
      String(d.getHours()).padStart(2, '0') +
      ':' +
      String(d.getMinutes()).padStart(2, '0') +
      ':' +
      String(d.getSeconds()).padStart(2, '0')
    );
  }

  function formatTimeFull(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function extractPathname(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  function statusClass(status: number): string {
    if (status >= 500) return 'status-5xx';
    if (status >= 400) return 'status-4xx';
    if (status >= 300) return 'status-3xx';
    return 'status-2xx';
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str: string): string {
    return str.replace(/[^a-zA-Z0-9\-_./]/g, '');
  }

  // --- Toast ---
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  function showToast(message: string, type: 'success' | 'error'): void {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = `toast visible ${type}`;
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  }

  // --- Init: check current status ---
  (async () => {
    // Restore MSW version
    const savedMswVersion = localStorage.getItem('apiMockMswVersion');
    if (savedMswVersion === 'v1' || savedMswVersion === 'v2') {
      mswVersion.value = savedMswVersion;
    }

    try {
      const status = await window.electronAPI.apiMockGetStatus();
      capturing = status.capturing;
      updateCaptureUI();
      if (status.count > 0) {
        renderContent(status.count, status.endpoints);
        // Fetch full data for views
        const groups = await window.electronAPI.apiMockGetCapturedData();
        capturedData = groups;
        allEntries = flattenEntries(groups);
        renderLeftPanel();
      }
    } catch {
      // Not yet available
    }
  })();
})();
