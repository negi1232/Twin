function initUIControls() {
  const leftUrlInput = document.getElementById('left-url');
  const rightUrlInput = document.getElementById('right-url');
  const reloadLeftBtn = document.getElementById('reload-left');
  const reloadRightBtn = document.getElementById('reload-right');
  const captureBtn = document.getElementById('capture-btn');
  const reportBtn = document.getElementById('report-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const toggleSyncBtn = document.getElementById('toggle-sync');
  const settingsModal = document.getElementById('settings-modal');
  const settingsSaveBtn = document.getElementById('settings-save');
  const settingsCancelBtn = document.getElementById('settings-cancel');
  const newReportBtn = document.getElementById('new-report-btn');
  const newReportModal = document.getElementById('new-report-modal');
  const newReportCaptureBtn = document.getElementById('new-report-capture');
  const newReportCancelBtn = document.getElementById('new-report-cancel');
  const reportTestNameInput = document.getElementById('report-test-name');
  const toggleSidebarBtn = document.getElementById('toggle-sidebar');
  const sidebar = document.getElementById('sidebar');
  const sidebarSelectFolderBtn = document.getElementById('sidebar-select-folder');
  const sidebarTree = document.getElementById('sidebar-tree');

  const sidebarSortSelect = document.getElementById('sidebar-sort');
  const sidebarFilterRadios = document.querySelectorAll('input[name="sidebar-filter"]');

  let lastReportPath = null;
  let sidebarOpen = false;
  let currentFolderPath = null;
  let currentEntries = [];
  const SIDEBAR_WIDTH = 250;

  // URL navigation
  leftUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      window.electronAPI.navigate({ url: leftUrlInput.value, target: 'left' });
    }
  });

  rightUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      window.electronAPI.navigate({ url: rightUrlInput.value, target: 'right' });
    }
  });

  // Reload buttons
  reloadLeftBtn.addEventListener('click', () => {
    window.electronAPI.reloadViews({ target: 'left' });
  });

  reloadRightBtn.addEventListener('click', () => {
    window.electronAPI.reloadViews({ target: 'right' });
  });

  // Capture & Compare
  captureBtn.addEventListener('click', () => {
    performCapture('page');
  });

  function performCapture(pageName) {
    updateStatus('Capturing...');
    window.electronAPI.captureAndCompare({ pageName }).catch((err) => {
      updateStatus(`Error: ${err.message}`);
    });
  }

  // New Report modal
  newReportBtn.addEventListener('click', () => {
    reportTestNameInput.value = '';
    document.getElementById('report-description').value = '';
    newReportModal.classList.remove('hidden');
    window.electronAPI.setViewsVisible({ visible: false });
    reportTestNameInput.focus();
  });

  newReportCaptureBtn.addEventListener('click', () => {
    const testName = reportTestNameInput.value.trim();
    if (!testName) {
      reportTestNameInput.focus();
      return;
    }
    newReportModal.classList.add('hidden');
    window.electronAPI.setViewsVisible({ visible: true });
    performCapture(testName);
  });

  newReportCancelBtn.addEventListener('click', () => {
    newReportModal.classList.add('hidden');
    window.electronAPI.setViewsVisible({ visible: true });
  });

  reportTestNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      newReportCaptureBtn.click();
    }
  });

  // Capture result handler
  window.electronAPI.onCaptureResult((data) => {
    if (data.error) {
      updateStatus(`Error: ${data.error}`);
      showToast(`Capture failed: ${data.error}`, 'error');
    } else {
      lastReportPath = data.reportPath;
      const s = data.summary;
      const statusEl = document.getElementById('status-result');
      statusEl.innerHTML =
        `<span class="status-passed">Passed: ${s.passed}</span> | ` +
        `<span class="status-failed">Failed: ${s.failed}</span> | ` +
        `<span class="status-new">New: ${s.new}</span> | ` +
        `<span class="status-deleted">Deleted: ${s.deleted}</span>`;
      if (s.failed > 0) {
        showToast(`Captured! ${s.failed} difference(s) found`, 'error');
      } else {
        showToast('Captured! No differences found', 'success');
      }
    }
  });

  // Open report
  reportBtn.addEventListener('click', () => {
    openLatestReport();
  });

  function openLatestReport() {
    if (lastReportPath) {
      window.electronAPI.openReport({ reportPath: lastReportPath });
    }
  }

  // Sync toggle (scroll + click + key sync)
  let syncEnabled = true;
  toggleSyncBtn.classList.add('sync-on');
  toggleSyncBtn.addEventListener('click', () => {
    syncEnabled = !syncEnabled;
    window.electronAPI.setSyncEnabled({ enabled: syncEnabled });
    toggleSyncBtn.innerHTML = `<span class="sync-dot${syncEnabled ? '' : ' off'}"></span>${syncEnabled ? 'Sync ON' : 'Sync OFF'}`;
    toggleSyncBtn.classList.toggle('sync-on', syncEnabled);
    toggleSyncBtn.classList.toggle('sync-off', !syncEnabled);
    document.getElementById('status-sync').textContent = `Sync: ${syncEnabled ? 'ON' : 'OFF'}`;
  });

  // Device presets
  document.querySelectorAll('.btn-preset').forEach((btn) => {
    btn.addEventListener('click', () => {
      const index = parseInt(btn.dataset.preset);
      applyPreset(index);
    });
  });

  function applyPreset(index) {
    const preset = getPresetByIndex(index);
    if (!preset) return;

    window.electronAPI.setDevicePreset({ width: preset.width, height: preset.height });
    document.getElementById('status-size').textContent = `${preset.width} x ${preset.height}`;

    // Update active state
    document.querySelectorAll('.btn-preset').forEach((b) => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.btn-preset[data-preset="${index}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // Settings
  settingsBtn.addEventListener('click', () => openSettings());

  function openSettings() {
    settingsModal.classList.remove('hidden');
    window.electronAPI.setViewsVisible({ visible: false });
    window.electronAPI.getSettings().then((settings) => {
      document.getElementById('setting-matching-threshold').value = settings.matchingThreshold;
      document.getElementById('setting-threshold-rate').value = settings.thresholdRate;
      document.getElementById('setting-snapshot-dir').value = settings.snapshotDir;
    });
  }

  settingsSaveBtn.addEventListener('click', () => {
    const settings = {
      matchingThreshold: parseFloat(document.getElementById('setting-matching-threshold').value),
      thresholdRate: parseFloat(document.getElementById('setting-threshold-rate').value),
      snapshotDir: document.getElementById('setting-snapshot-dir').value,
    };
    window.electronAPI.saveSettings({ settings });
    settingsModal.classList.add('hidden');
    window.electronAPI.setViewsVisible({ visible: true });
  });

  settingsCancelBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
    window.electronAPI.setViewsVisible({ visible: true });
  });

  // Keyboard shortcut handlers from main process
  window.electronAPI.onShortcutCapture(() => performCapture('page'));
  window.electronAPI.onShortcutOpenReport(() => openLatestReport());
  window.electronAPI.onShortcutPreset((data) => applyPreset(data.index));
  window.electronAPI.onShortcutSettings(() => openSettings());

  function updateStatus(text) {
    document.getElementById('status-result').textContent = text;
  }

  function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    // Force reflow to restart transition
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  // Sidebar toggle
  toggleSidebarBtn.addEventListener('click', () => {
    sidebarOpen = !sidebarOpen;
    sidebar.classList.toggle('collapsed', !sidebarOpen);
    const width = sidebarOpen ? SIDEBAR_WIDTH : 0;
    window.electronAPI.setSidebarWidth({ width });
  });

  // Sidebar folder selection
  sidebarSelectFolderBtn.addEventListener('click', async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;
    currentFolderPath = folderPath;
    await loadAndRenderTree();
  });

  // Sort change
  sidebarSortSelect.addEventListener('change', async () => {
    if (currentFolderPath) await loadAndRenderTree();
  });

  // Filter change
  sidebarFilterRadios.forEach((radio) => {
    radio.addEventListener('change', async () => {
      if (currentFolderPath) await loadAndRenderTree();
    });
  });

  function getSelectedFilter() {
    const checked = document.querySelector('input[name="sidebar-filter"]:checked');
    return checked ? checked.value : 'all';
  }

  function sortEntries(entries) {
    const mode = sidebarSortSelect.value;
    const sorted = entries.slice();
    if (mode === 'name-asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (mode === 'name-desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    } else if (mode === 'type') {
      sorted.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
    }
    return sorted;
  }

  function filterEntries(entries) {
    const filter = getSelectedFilter();
    if (filter === 'directories') return entries.filter((e) => e.isDirectory);
    if (filter === 'files') return entries.filter((e) => !e.isDirectory);
    return entries;
  }

  async function loadAndRenderTree() {
    try {
      currentEntries = await window.electronAPI.readDirectory({ dirPath: currentFolderPath });
    } catch (_e) {
      currentEntries = [];
    }
    renderTreeFromEntries(currentEntries, sidebarTree, 0);
  }

  function renderTreeFromEntries(entries, container, depth) {
    container.innerHTML = '';
    const filtered = filterEntries(entries);
    const sorted = sortEntries(filtered);
    sorted.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'tree-item';
      item.style.paddingLeft = `${8 + depth * 16}px`;
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', entry.isDirectory ? 'treeitem' : 'none');

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = entry.isDirectory ? '\u25B6' : '\u2022';

      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = entry.name;

      item.appendChild(icon);
      item.appendChild(name);
      container.appendChild(item);

      if (entry.isDirectory) {
        const children = document.createElement('div');
        children.className = 'tree-children';
        container.appendChild(children);

        async function toggleDir() {
          const isExpanded = children.classList.contains('expanded');
          if (isExpanded) {
            children.classList.remove('expanded');
            icon.textContent = '\u25B6';
          } else {
            if (children.children.length === 0) {
              let childEntries;
              try {
                childEntries = await window.electronAPI.readDirectory({ dirPath: entry.path });
              } catch (_e) {
                childEntries = [];
              }
              renderTreeFromEntries(childEntries, children, depth + 1);
            }
            children.classList.add('expanded');
            icon.textContent = '\u25BC';
          }
        }

        item.addEventListener('click', toggleDir);
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDir();
          }
        });
      }
    });
  }

  // Load initial URLs from settings
  window.electronAPI.getSettings().then((settings) => {
    leftUrlInput.value = settings.leftUrl || 'http://localhost:3000';
    rightUrlInput.value = settings.rightUrl || 'http://localhost:3001';
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initUIControls };
}
