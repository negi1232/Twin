/**
 * @module shared/constants
 * @description Main / Renderer プロセス間で共有される定数。
 * UI レイアウト寸法、デフォルト設定値、ズーム範囲、IPC チャンネル名を定義する。
 */

/** ツールバーの高さ (px) */
export const TOOLBAR_HEIGHT: number = 52;
/** ステータスバーの高さ (px) */
export const STATUS_BAR_HEIGHT: number = 28;
/** サイドバーの幅 (px) */
export const SIDEBAR_WIDTH: number = 250;

/** 左ビュー（Expected）のデフォルト URL */
export const DEFAULT_LEFT_URL: string = 'http://localhost:3000';
/** 右ビュー（Actual）のデフォルト URL */
export const DEFAULT_RIGHT_URL: string = 'http://localhost:3001';
/** スナップショット保存先のデフォルトパス */
export const DEFAULT_SNAPSHOT_DIR: string = './snapshots';

/** ズーム変更のステップ値 */
export const ZOOM_STEP: number = 0.1;
/** ズームの最小値 */
export const MIN_ZOOM: number = 0.25;
/** ズームの最大値 */
export const MAX_ZOOM: number = 3.0;
/** ズームのデフォルト値 */
export const DEFAULT_ZOOM: number = 1.0;

/** ファイル読み込みの最大サイズ (50MB) */
export const MAX_FILE_SIZE: number = 50 * 1024 * 1024;

/** IPC 通信で使用するチャンネル名 */
export const IPC_CHANNELS = {
  CAPTURE_AND_COMPARE: 'capture-and-compare',
  CAPTURE_RESULT: 'capture-result',
  OPEN_REPORT: 'open-report',
  RELOAD_VIEWS: 'reload-views',
  SET_DEVICE_PRESET: 'set-device-preset',
  NAVIGATE: 'navigate',
  GET_SETTINGS: 'get-settings',
  SAVE_SETTINGS: 'save-settings',
  SYNC_SCROLL: 'sync-scroll',
  SELECT_FOLDER: 'select-folder',
  READ_DIRECTORY: 'read-directory',
  SET_SIDEBAR_WIDTH: 'set-sidebar-width',
  SET_ZOOM: 'set-zoom',
  GET_ZOOM: 'get-zoom',
  ZOOM_CHANGED: 'zoom-changed',
  CSS_FULL_SCAN: 'css-full-scan',
  CSS_INSPECT_TOGGLE: 'css-inspect-toggle',
  CSS_EXPORT_JSON: 'css-export-json',
  CSS_INSPECT_RESULT: 'css-inspect-result',
} as const;
