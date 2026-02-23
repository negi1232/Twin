/**
 * @description グローバル型定義。
 * Renderer プロセスのスクリプト（<script> タグ経由でロード）向けの
 * 型宣言と、プロジェクト全体で使用するインタフェースを定義する。
 */

// --- Shared Interfaces ---

interface AppSettings {
  leftUrl: string;
  rightUrl: string;
  snapshotDir: string;
  sidebarFolderPath: string;
  matchingThreshold: number;
  thresholdRate: number;
}

interface DirectoryEntry {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileData {
  dataUrl: string;
  mimeType: string;
  fileName: string;
}

interface CaptureResultData {
  summary?: {
    passed: number;
    failed: number;
    new: number;
    deleted: number;
  };
  reportPath?: string;
  fileName?: string;
  error?: string;
}

interface CssInspectResultData {
  left: CssInspectElementData | null;
  right: CssInspectElementData | null;
  diffs: CssInspectDiff[];
  error: string | null;
  modeDisabled?: boolean;
}

interface CssInspectElementData {
  tag: string;
  key: string;
  method: string;
  styles: Record<string, string>;
}

interface CssInspectDiff {
  property: string;
  expected: string;
  actual: string;
  category: string;
  type?: string;
  isDiff?: boolean;
}

interface DevicePreset {
  name: string;
  width: number;
  height: number;
}

// --- Electron API (exposed via preload contextBridge) ---

interface ElectronAPI {
  captureAndCompare(payload: { pageName: string }): Promise<RegCliResult>;
  openReport(payload: { reportPath: string }): Promise<void>;
  reloadViews(payload: { target: string }): Promise<void>;
  setDevicePreset(payload: { width: number; height: number }): Promise<void>;
  navigate(payload: { url: string; target: string }): Promise<void>;
  getSettings(): Promise<AppSettings>;
  saveSettings(payload: { settings: Partial<AppSettings> }): Promise<{ success: boolean }>;
  setSyncEnabled(payload: { enabled: boolean }): Promise<{ enabled: boolean }>;
  getSyncEnabled(): Promise<{ enabled: boolean }>;
  setViewsVisible(payload: { visible: boolean }): Promise<void>;
  selectFolder(): Promise<string | null>;
  readDirectory(payload: { dirPath: string }): Promise<DirectoryEntry[]>;
  createDirectory(payload: { dirPath: string }): Promise<{ path: string }>;
  readFileData(payload: { filePath: string }): Promise<FileData>;
  setSidebarWidth(payload: { width: number }): Promise<{ width: number }>;
  reinjectSync(): Promise<{ success: boolean }>;
  onCaptureResult(cb: (data: CaptureResultData) => void): void;
  onShortcutCapture(cb: () => void): void;
  onShortcutOpenReport(cb: () => void): void;
  onShortcutPreset(cb: (data: { index: number }) => void): void;
  onShortcutSettings(cb: () => void): void;
  setZoom(payload: { zoom: number }): Promise<{ zoom: number }>;
  getZoom(): Promise<{ zoom: number }>;
  onZoomChanged(cb: (data: { zoom: number }) => void): void;
  onShortcutZoomIn(cb: () => void): void;
  onShortcutZoomOut(cb: () => void): void;
  onShortcutZoomReset(cb: () => void): void;
  cssFullScan(): Promise<ScanSummary>;
  cssInspectToggle(payload: { enabled: boolean }): Promise<{ enabled: boolean }>;
  cssExportJson(payload?: unknown): Promise<{ filePath: string } | null>;
  onCssInspectResult(cb: (data: CssInspectResultData) => void): void;
  onShortcutCssScan(cb: () => void): void;
  onShortcutCssInspect(cb: () => void): void;
}

interface RegCliResult {
  summary: {
    passed: number;
    failed: number;
    new: number;
    deleted: number;
  };
  reportPath: string;
  jsonPath: string;
  raw: Record<string, unknown>;
}

interface ScanSummary {
  changedElements: number;
  addedElements: number;
  deletedElements: number;
  totalDiffProperties: number;
}

// --- Renderer Global Functions (loaded via <script> tags) ---

declare function initUIControls(): void;
declare function initCssCompare(): void;
declare function showToast(message: string, type: string): void;
declare function escapeHtml(str: string | null | undefined): string;
declare function classifyProperty(prop: string): string;
declare function getPresetByIndex(index: number): DevicePreset | null;
declare function isSyncEnabled(): boolean;
declare function toggleSync(): boolean;
declare function buildScrollToScript(scrollX: number, scrollY: number): string;
declare function extractPathFromUrl(url: string): string;

// Shared constants (loaded via CommonJS shim in index.html)
declare const ZOOM_STEP: number;
declare const MIN_ZOOM: number;
declare const MAX_ZOOM: number;
declare const DEFAULT_ZOOM: number;
declare const SIDEBAR_WIDTH: number;
declare const LAYOUT_PROPS: ReadonlySet<string>;
declare const TEXT_PROPS: ReadonlySet<string>;
declare const VISUAL_PROPS: ReadonlySet<string>;

// PRESETS and PRESET_LIST are declared in device-presets.ts as const variables

// --- Extend Window for electronAPI ---

interface Window {
  electronAPI: ElectronAPI;
}
