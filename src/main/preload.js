const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  captureAndCompare: (payload) => ipcRenderer.invoke('capture-and-compare', payload),
  openReport: (payload) => ipcRenderer.invoke('open-report', payload),
  reloadViews: (payload) => ipcRenderer.invoke('reload-views', payload),
  setDevicePreset: (payload) => ipcRenderer.invoke('set-device-preset', payload),
  navigate: (payload) => ipcRenderer.invoke('navigate', payload),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (payload) => ipcRenderer.invoke('save-settings', payload),
  setSyncEnabled: (payload) => ipcRenderer.invoke('set-sync-enabled', payload),
  getSyncEnabled: () => ipcRenderer.invoke('get-sync-enabled'),
  setViewsVisible: (payload) => ipcRenderer.invoke('set-views-visible', payload),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (payload) => ipcRenderer.invoke('read-directory', payload),
  setSidebarWidth: (payload) => ipcRenderer.invoke('set-sidebar-width', payload),
  onCaptureResult: (cb) => ipcRenderer.on('capture-result', (_event, data) => cb(data)),
  onShortcutCapture: (cb) => ipcRenderer.on('shortcut-capture', () => cb()),
  onShortcutOpenReport: (cb) => ipcRenderer.on('shortcut-open-report', () => cb()),
  onShortcutPreset: (cb) => ipcRenderer.on('shortcut-preset', (_event, data) => cb(data)),
  onShortcutSettings: (cb) => ipcRenderer.on('shortcut-settings', () => cb()),
});
