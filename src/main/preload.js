/**
 * @module main/preload
 * @description Renderer プロセスに公開する IPC API を contextBridge 経由で定義する。
 * nodeIntegration: false 環境で安全に Main プロセスと通信するための唯一のインタフェース。
 *
 * 公開 API は window.electronAPI として Renderer からアクセスされる。
 * invoke 系メソッド（リクエスト/レスポンス）と on 系メソッド（Main → Renderer 通知）で構成。
 */

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
  createDirectory: (payload) => ipcRenderer.invoke('create-directory', payload),
  readFileData: (payload) => ipcRenderer.invoke('read-file-data', payload),
  setSidebarWidth: (payload) => ipcRenderer.invoke('set-sidebar-width', payload),
  reinjectSync: () => ipcRenderer.invoke('reinject-sync'),
  onCaptureResult: (cb) => ipcRenderer.on('capture-result', (_event, data) => cb(data)),
  onShortcutCapture: (cb) => ipcRenderer.on('shortcut-capture', () => cb()),
  onShortcutOpenReport: (cb) => ipcRenderer.on('shortcut-open-report', () => cb()),
  onShortcutPreset: (cb) => ipcRenderer.on('shortcut-preset', (_event, data) => cb(data)),
  onShortcutSettings: (cb) => ipcRenderer.on('shortcut-settings', () => cb()),
  setZoom: (payload) => ipcRenderer.invoke('set-zoom', payload),
  getZoom: () => ipcRenderer.invoke('get-zoom'),
  onZoomChanged: (cb) => ipcRenderer.on('zoom-changed', (_event, data) => cb(data)),
  onShortcutZoomIn: (cb) => ipcRenderer.on('shortcut-zoom-in', () => cb()),
  onShortcutZoomOut: (cb) => ipcRenderer.on('shortcut-zoom-out', () => cb()),
  onShortcutZoomReset: (cb) => ipcRenderer.on('shortcut-zoom-reset', () => cb()),
});
