/**
 * @module main/store
 * @description electron-store を使ったアプリ設定の永続化管理。
 * URL、スナップショット保存先、比較閾値などをスキーマ付きで保存する。
 */

const Store = require('electron-store').default || require('electron-store');

/** @type {import('electron-store') | null} */
let store = null;

/** @type {Object} electron-store のスキーマ定義 */
const schema = {
  leftUrl: {
    type: 'string',
    default: 'http://localhost:3000',
  },
  rightUrl: {
    type: 'string',
    default: 'http://localhost:3001',
  },
  snapshotDir: {
    type: 'string',
    default: './snapshots',
  },
  matchingThreshold: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    default: 0,
  },
  thresholdRate: {
    type: 'number',
    minimum: 0,
    maximum: 1,
    default: 0,
  },
};

/**
 * Store のシングルトンインスタンスを取得する。
 * @returns {import('electron-store')}
 */
function getStore() {
  if (!store) {
    store = new Store({ schema });
  }
  return store;
}

/**
 * 現在の設定をすべて取得する。
 * @returns {{leftUrl: string, rightUrl: string, snapshotDir: string, matchingThreshold: number, thresholdRate: number}}
 */
function getSettings() {
  const s = getStore();
  return {
    leftUrl: s.get('leftUrl'),
    rightUrl: s.get('rightUrl'),
    snapshotDir: s.get('snapshotDir'),
    matchingThreshold: s.get('matchingThreshold'),
    thresholdRate: s.get('thresholdRate'),
  };
}

/**
 * 設定を保存する。スキーマに定義されたキーのみが保存される。
 * @param {Object} settings - 保存する設定のキーと値
 */
function saveSettings(settings) {
  const s = getStore();
  for (const [key, value] of Object.entries(settings)) {
    if (schema[key] !== undefined) {
      s.set(key, value);
    }
  }
}

module.exports = { getStore, getSettings, saveSettings };
