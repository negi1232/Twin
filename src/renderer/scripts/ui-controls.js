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

  const previewModal = document.getElementById('preview-modal');
  const previewImage = document.getElementById('preview-image');
  const previewFilename = document.getElementById('preview-filename');
  const previewCloseBtn = document.getElementById('preview-close');
  const previewOverlay = document.getElementById('preview-overlay');

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

  const sidebarNewFolderBtn = document.getElementById('sidebar-new-folder');
  const sidebarNewFolderForm = document.getElementById('sidebar-new-folder-form');
  const sidebarNewFolderNameInput = document.getElementById('sidebar-new-folder-name');
  const sidebarNewFolderOkBtn = document.getElementById('sidebar-new-folder-ok');
  const sidebarNewFolderCancelBtn = document.getElementById('sidebar-new-folder-cancel');
  const sidebarSortSelect = document.getElementById('sidebar-sort');
  const sidebarFilterRadios = document.querySelectorAll('input[name="sidebar-filter"]');

  let lastReportPath = null;
  let sidebarOpen = false;
  let currentFolderPath = null;
  let currentEntries = [];
  let currentSnapshotDir = null;
  const expandedDirs = new Set();
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

  // Reload & Re-sync button
  const reloadSyncBtn = document.getElementById('reload-sync-btn');
  reloadSyncBtn.addEventListener('click', async () => {
    await window.electronAPI.reloadViews({ target: 'both' });
    await window.electronAPI.reinjectSync();
    showToast('Views reloaded & sync re-injected', 'success');
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
    const folderInfo = document.getElementById('new-report-folder-info');
    const folderPathEl = document.getElementById('new-report-folder-path');
    if (currentFolderPath) {
      folderPathEl.textContent = currentFolderPath + '/';
      folderInfo.classList.remove('hidden');
    } else {
      folderInfo.classList.add('hidden');
    }
    newReportModal.classList.remove('hidden');
    window.electronAPI.setViewsVisible({ visible: false });
    reportTestNameInput.focus();
  });

  newReportCaptureBtn.addEventListener('click', async () => {
    const testName = reportTestNameInput.value.trim();
    if (!testName) {
      reportTestNameInput.focus();
      return;
    }
    newReportModal.classList.add('hidden');
    window.electronAPI.setViewsVisible({ visible: true });
    if (currentFolderPath) {
      const newPath = currentFolderPath + '/' + testName;
      try {
        await window.electronAPI.createDirectory({ dirPath: newPath });
      } catch {
        // folder may already exist, continue
      }
      await setSnapshotDir(newPath);
      await loadAndRenderTree();
    }
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
      statusEl.textContent = '';
      const items = [
        { cls: 'status-passed', text: `Passed: ${s.passed}` },
        { cls: 'status-failed', text: `Failed: ${s.failed}` },
        { cls: 'status-new', text: `New: ${s.new}` },
        { cls: 'status-deleted', text: `Deleted: ${s.deleted}` },
      ];
      items.forEach((item, i) => {
        if (i > 0) statusEl.appendChild(document.createTextNode(' | '));
        const span = document.createElement('span');
        span.className = item.cls;
        span.textContent = item.text;
        statusEl.appendChild(span);
      });
      if (s.failed > 0) {
        showToast(`Captured! ${s.failed} difference(s) found`, 'error');
      } else {
        showToast('Captured! No differences found', 'success');
      }
      if (currentFolderPath) {
        loadAndRenderTree();
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
    document.body.classList.toggle('sidebar-open', sidebarOpen);
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

  // New folder creation
  sidebarNewFolderBtn.addEventListener('click', () => {
    if (!currentFolderPath) return;
    sidebarNewFolderForm.classList.remove('hidden');
    sidebarNewFolderNameInput.value = '';
    sidebarNewFolderNameInput.focus();
  });

  async function createNewFolder() {
    const name = sidebarNewFolderNameInput.value.trim();
    if (!name || !currentFolderPath) return;
    const newPath = currentFolderPath + '/' + name;
    try {
      await window.electronAPI.createDirectory({ dirPath: newPath });
      sidebarNewFolderForm.classList.add('hidden');
      await loadAndRenderTree();
      await setSnapshotDir(newPath);
      showToast(`Folder created: ${name}`, 'success');
    } catch {
      showToast('Failed to create folder', 'error');
    }
  }

  sidebarNewFolderOkBtn.addEventListener('click', createNewFolder);

  sidebarNewFolderNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      createNewFolder();
    } else if (e.key === 'Escape') {
      sidebarNewFolderForm.classList.add('hidden');
    }
  });

  sidebarNewFolderCancelBtn.addEventListener('click', () => {
    sidebarNewFolderForm.classList.add('hidden');
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
    } catch {
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
      if (entry.isDirectory && entry.path === currentSnapshotDir) {
        item.classList.add('tree-item-active-output');
      }
      item.style.paddingLeft = `${8 + depth * 16}px`;
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', entry.isDirectory ? 'treeitem' : 'none');

      const icon = document.createElement('span');
      icon.className = 'tree-icon';
      icon.textContent = entry.isDirectory ? '\u{1F4C1}' : '\u{1F4C4}';

      const name = document.createElement('span');
      name.className = 'tree-name';
      name.textContent = entry.name;

      item.appendChild(icon);
      item.appendChild(name);

      if (entry.isDirectory) {
        const pinBtn = document.createElement('button');
        pinBtn.className = 'tree-pin-btn';
        pinBtn.title = 'Set as output directory';
        pinBtn.innerHTML = '&#x1F4CC;';
        pinBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          setSnapshotDir(entry.path);
        });
        item.appendChild(pinBtn);
      }

      if (!entry.isDirectory) {
        const previewable = isImageFile(entry.name) || isHtmlFile(entry.name);
        if (previewable) {
          item.classList.add('tree-item-previewable');
        } else {
          item.classList.add('tree-item-inert');
        }
      }

      container.appendChild(item);

      if (!entry.isDirectory && (isImageFile(entry.name) || isHtmlFile(entry.name))) {
        item.addEventListener('click', () => openPreview(entry.path, entry.name));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPreview(entry.path, entry.name);
          }
        });
      }

      if (entry.isDirectory) {
        const children = document.createElement('div');
        children.className = 'tree-children';
        container.appendChild(children);

        async function expandDir() {
          let childEntries;
          try {
            childEntries = await window.electronAPI.readDirectory({ dirPath: entry.path });
          } catch {
            childEntries = [];
          }
          renderTreeFromEntries(childEntries, children, depth + 1);
          children.classList.add('expanded');
          icon.textContent = '\u{1F4C2}';
          expandedDirs.add(entry.path);
        }

        async function toggleDir() {
          const isExpanded = children.classList.contains('expanded');
          if (isExpanded) {
            children.classList.remove('expanded');
            icon.textContent = '\u{1F4C1}';
            expandedDirs.delete(entry.path);
          } else {
            await expandDir();
          }
        }

        item.addEventListener('click', toggleDir);
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleDir();
          }
        });

        // Auto-expand if previously expanded
        if (expandedDirs.has(entry.path)) {
          expandDir();
        }
      }
    });
  }

  async function setSnapshotDir(dirPath) {
    currentSnapshotDir = dirPath;
    await window.electronAPI.saveSettings({ settings: { snapshotDir: dirPath } });
    updateSnapshotDirDisplay();
    if (currentFolderPath && currentEntries.length > 0) {
      renderTreeFromEntries(currentEntries, sidebarTree, 0);
    }
  }

  // File preview
  function getExtension(filename) {
    const dot = filename.lastIndexOf('.');
    return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  }

  function isImageFile(filename) {
    return IMAGE_EXTENSIONS.includes(getExtension(filename));
  }

  function isHtmlFile(filename) {
    return getExtension(filename) === '.html';
  }

  async function openPreview(filePath, fileName) {
    if (isHtmlFile(fileName)) {
      window.electronAPI.openReport({ reportPath: filePath });
      return;
    }
    if (isImageFile(fileName)) {
      // Hide views and show modal immediately (before async load)
      previewFilename.textContent = fileName;
      previewImage.src = '';
      previewImage.alt = '';
      previewModal.classList.remove('hidden');
      window.electronAPI.setViewsVisible({ visible: false });
      try {
        const data = await window.electronAPI.readFileData({ filePath });
        previewFilename.textContent = data.fileName;
        previewImage.src = data.dataUrl;
        previewImage.alt = data.fileName;
      } catch {
        closePreview();
        showToast('Failed to load file', 'error');
      }
    }
  }

  function closePreview() {
    previewModal.classList.add('hidden');
    previewImage.src = '';
    window.electronAPI.setViewsVisible({ visible: true });
  }

  previewCloseBtn.addEventListener('click', closePreview);
  previewOverlay.addEventListener('click', closePreview);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !previewModal.classList.contains('hidden')) {
      closePreview();
    }
  });

  function updateSnapshotDirDisplay() {
    const display = document.getElementById('sidebar-output-dir');
    if (display) {
      if (currentSnapshotDir) {
        const parts = currentSnapshotDir.split('/');
        display.textContent = parts[parts.length - 1] || currentSnapshotDir;
        display.title = currentSnapshotDir;
      } else {
        display.textContent = 'Not set';
        display.title = '';
      }
    }
  }

  // Load initial URLs and snapshotDir from settings
  window.electronAPI.getSettings().then((settings) => {
    leftUrlInput.value = settings.leftUrl || 'http://localhost:3000';
    rightUrlInput.value = settings.rightUrl || 'http://localhost:3001';
    currentSnapshotDir = settings.snapshotDir || null;
    updateSnapshotDirDisplay();
    if (currentSnapshotDir && currentSnapshotDir.startsWith('/')) {
      const parts = currentSnapshotDir.split('/');
      currentFolderPath = parts.length > 2 ? parts.slice(0, -1).join('/') : currentSnapshotDir;
      loadAndRenderTree();
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initUIControls };
}
