/**
 * @module main/preload
 * @description Renderer プロセスに公開する IPC API を contextBridge 経由で定義する。
 * nodeIntegration: false 環境で安全に Main プロセスと通信するための唯一のインタフェース。
 *
 * 公開 API は window.electronAPI として Renderer からアクセスされる。
 * invoke 系メソッド（リクエスト/レスポンス）と on 系メソッド（Main → Renderer 通知）で構成。
 */

import { contextBridge, type IpcRendererEvent, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  captureAndCompare: (payload: { pageName: string }) => ipcRenderer.invoke('capture-and-compare', payload),
  openReport: (payload: { reportPath: string }) => ipcRenderer.invoke('open-report', payload),
  reloadViews: (payload: { target: string }) => ipcRenderer.invoke('reload-views', payload),
  setDevicePreset: (payload: { width: number; height: number }) => ipcRenderer.invoke('set-device-preset', payload),
  navigate: (payload: { url: string; target: string }) => ipcRenderer.invoke('navigate', payload),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (payload: { settings: Partial<AppSettings> }) => ipcRenderer.invoke('save-settings', payload),
  setSyncEnabled: (payload: { enabled: boolean }) => ipcRenderer.invoke('set-sync-enabled', payload),
  getSyncEnabled: () => ipcRenderer.invoke('get-sync-enabled'),
  setViewsVisible: (payload: { visible: boolean }) => ipcRenderer.invoke('set-views-visible', payload),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  readDirectory: (payload: { dirPath: string }) => ipcRenderer.invoke('read-directory', payload),
  createDirectory: (payload: { dirPath: string }) => ipcRenderer.invoke('create-directory', payload),
  readFileData: (payload: { filePath: string }) => ipcRenderer.invoke('read-file-data', payload),
  setSidebarWidth: (payload: { width: number }) => ipcRenderer.invoke('set-sidebar-width', payload),
  reinjectSync: () => ipcRenderer.invoke('reinject-sync'),
  onCaptureResult: (cb: (data: CaptureResultData) => void) =>
    ipcRenderer.on('capture-result', (_event: IpcRendererEvent, data: CaptureResultData) => cb(data)),
  onShortcutCapture: (cb: () => void) => ipcRenderer.on('shortcut-capture', () => cb()),
  onShortcutOpenReport: (cb: () => void) => ipcRenderer.on('shortcut-open-report', () => cb()),
  onShortcutPreset: (cb: (data: { index: number }) => void) =>
    ipcRenderer.on('shortcut-preset', (_event: IpcRendererEvent, data: { index: number }) => cb(data)),
  onShortcutSettings: (cb: () => void) => ipcRenderer.on('shortcut-settings', () => cb()),
  setZoom: (payload: { zoom: number }) => ipcRenderer.invoke('set-zoom', payload),
  getZoom: () => ipcRenderer.invoke('get-zoom'),
  onZoomChanged: (cb: (data: { zoom: number }) => void) =>
    ipcRenderer.on('zoom-changed', (_event: IpcRendererEvent, data: { zoom: number }) => cb(data)),
  onShortcutZoomIn: (cb: () => void) => ipcRenderer.on('shortcut-zoom-in', () => cb()),
  onShortcutZoomOut: (cb: () => void) => ipcRenderer.on('shortcut-zoom-out', () => cb()),
  onShortcutZoomReset: (cb: () => void) => ipcRenderer.on('shortcut-zoom-reset', () => cb()),
  // CSS comparison
  cssFullScan: () => ipcRenderer.invoke('css-full-scan'),
  cssInspectToggle: (payload: { enabled: boolean }) => ipcRenderer.invoke('css-inspect-toggle', payload),
  cssExportJson: (payload?: unknown) => ipcRenderer.invoke('css-export-json', payload),
  onCssInspectResult: (cb: (data: CssInspectResultData) => void) =>
    ipcRenderer.on('css-inspect-result', (_event: IpcRendererEvent, data: CssInspectResultData) => cb(data)),
  onShortcutCssScan: (cb: () => void) => ipcRenderer.on('shortcut-css-scan', () => cb()),
  onShortcutCssInspect: (cb: () => void) => ipcRenderer.on('shortcut-css-inspect', () => cb()),
});
