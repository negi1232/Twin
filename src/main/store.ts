/**
 * @module main/store
 * @description electron-store を使ったアプリ設定の永続化管理。
 * URL、スナップショット保存先、比較閾値などをスキーマ付きで保存する。
 */

// electron-store の require パターンを維持（ESM / CJS 両対応）
const Store = require('electron-store').default || require('electron-store');

export interface StoreInstance {
  get(key: string, defaultValue?: unknown): unknown;
  set(key: string, value: unknown): void;
}

/** electron-store のインスタンス */
let store: StoreInstance | null = null;

/** electron-store のスキーマ定義 */
const schema = {
  leftUrl: {
    type: 'string' as const,
    default: 'http://localhost:3000',
  },
  rightUrl: {
    type: 'string' as const,
    default: 'http://localhost:3001',
  },
  snapshotDir: {
    type: 'string' as const,
    default: './snapshots',
  },
  matchingThreshold: {
    type: 'number' as const,
    minimum: 0,
    maximum: 1,
    default: 0,
  },
  thresholdRate: {
    type: 'number' as const,
    minimum: 0,
    maximum: 1,
    default: 0,
  },
};

/**
 * Store のシングルトンインスタンスを取得する。
 */
function getStore(): StoreInstance {
  if (!store) {
    store = new Store({ schema }) as StoreInstance;
  }
  return store;
}

/**
 * 現在の設定をすべて取得する。
 */
function getSettings(): AppSettings {
  const s = getStore();
  return {
    leftUrl: s.get('leftUrl') as string,
    rightUrl: s.get('rightUrl') as string,
    snapshotDir: s.get('snapshotDir') as string,
    matchingThreshold: s.get('matchingThreshold') as number,
    thresholdRate: s.get('thresholdRate') as number,
  };
}

/**
 * 設定を保存する。スキーマに定義されたキーのみが保存される。
 */
function saveSettings(settings: Partial<AppSettings>): void {
  const s = getStore();
  for (const [key, value] of Object.entries(settings)) {
    if (schema[key as keyof typeof schema] !== undefined) {
      s.set(key, value);
    }
  }
}

export { getStore, getSettings, saveSettings };
