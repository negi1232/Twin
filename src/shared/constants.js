const TOOLBAR_HEIGHT = 52;
const STATUS_BAR_HEIGHT = 28;
const SIDEBAR_WIDTH = 250;

const DEFAULT_LEFT_URL = 'http://localhost:3000';
const DEFAULT_RIGHT_URL = 'http://localhost:3001';
const DEFAULT_SNAPSHOT_DIR = './snapshots';

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
};

module.exports = {
  TOOLBAR_HEIGHT,
  STATUS_BAR_HEIGHT,
  SIDEBAR_WIDTH,
  DEFAULT_LEFT_URL,
  DEFAULT_RIGHT_URL,
  DEFAULT_SNAPSHOT_DIR,
  IPC_CHANNELS,
};
