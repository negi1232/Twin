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

  let lastReportPath = null;

  // URL navigation
  leftUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      window.electronAPI.navigate({ url: leftUrlInput.value, target: 'left' });
    }
  });

  rightUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
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
    performCapture();
  });

  function performCapture() {
    const pageName = 'page';
    updateStatus('Capturing...');
    window.electronAPI.captureAndCompare({ pageName }).catch((err) => {
      updateStatus(`Error: ${err.message}`);
    });
  }

  // Capture result handler
  window.electronAPI.onCaptureResult((data) => {
    if (data.error) {
      updateStatus(`Error: ${data.error}`);
    } else {
      lastReportPath = data.reportPath;
      const s = data.summary;
      updateStatus(
        `Passed: ${s.passed} | Failed: ${s.failed} | New: ${s.new} | Deleted: ${s.deleted}`
      );
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

  // Sync toggle
  toggleSyncBtn.addEventListener('click', () => {
    const enabled = toggleSync();
    toggleSyncBtn.textContent = enabled ? 'Sync ON' : 'Sync OFF';
    document.getElementById('status-sync').textContent = `Sync: ${enabled ? 'ON' : 'OFF'}`;
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
  });

  settingsCancelBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  // Keyboard shortcut handlers from main process
  window.electronAPI.onShortcutCapture(() => performCapture());
  window.electronAPI.onShortcutOpenReport(() => openLatestReport());
  window.electronAPI.onShortcutPreset((data) => applyPreset(data.index));
  window.electronAPI.onShortcutSettings(() => openSettings());

  function updateStatus(text) {
    document.getElementById('status-result').textContent = text;
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
