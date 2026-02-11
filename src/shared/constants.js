/**
 * @module shared/constants
 * @description Main / Renderer プロセス間で共有される定数。
 * UI レイアウト寸法、デフォルト設定値、ズーム範囲、IPC チャンネル名を定義する。
 */

/** @type {number} ツールバーの高さ (px) */
const TOOLBAR_HEIGHT = 52;
/** @type {number} ステータスバーの高さ (px) */
const STATUS_BAR_HEIGHT = 28;
/** @type {number} サイドバーの幅 (px) */
const SIDEBAR_WIDTH = 250;

/** @type {string} 左ビュー（Expected）のデフォルト URL */
const DEFAULT_LEFT_URL = 'http://localhost:3000';
/** @type {string} 右ビュー（Actual）のデフォルト URL */
const DEFAULT_RIGHT_URL = 'http://localhost:3001';
/** @type {string} スナップショット保存先のデフォルトパス */
const DEFAULT_SNAPSHOT_DIR = './snapshots';

/** @type {number} ズーム変更のステップ値 */
const ZOOM_STEP = 0.1;
/** @type {number} ズームの最小値 */
const MIN_ZOOM = 0.25;
/** @type {number} ズームの最大値 */
const MAX_ZOOM = 3.0;
/** @type {number} ズームのデフォルト値 */
const DEFAULT_ZOOM = 1.0;

/** @enum {string} IPC 通信で使用するチャンネル名 */
const IPC_CHANNELS = {
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
};

module.exports = {
  TOOLBAR_HEIGHT,
  STATUS_BAR_HEIGHT,
  SIDEBAR_WIDTH,
  DEFAULT_LEFT_URL,
  DEFAULT_RIGHT_URL,
  DEFAULT_SNAPSHOT_DIR,
  ZOOM_STEP,
  MIN_ZOOM,
  MAX_ZOOM,
  DEFAULT_ZOOM,
  IPC_CHANNELS,
};
