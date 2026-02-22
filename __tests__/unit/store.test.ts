export {};

jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    const data: Record<string, any> = {};
    return {
      get: jest.fn((key: string, defaultValue: any) => data[key] !== undefined ? data[key] : defaultValue),
      set: jest.fn((key: string, value: any) => { data[key] = value; }),
      delete: jest.fn((key: string) => { delete data[key]; }),
    };
  });
});

const { getStore, getSettings, saveSettings } = require('../../src/main/store');

describe('Store Module', () => {
  test('getStore returns a store instance', () => {
    const store = getStore();
    expect(store).toBeDefined();
    expect(store.get).toBeDefined();
    expect(store.set).toBeDefined();
  });

  test('getStore returns the same instance on multiple calls', () => {
    const store1 = getStore();
    const store2 = getStore();
    expect(store1).toBe(store2);
  });

  test('getSettings returns default values', () => {
    const settings = getSettings();
    expect(settings).toHaveProperty('leftUrl');
    expect(settings).toHaveProperty('rightUrl');
    expect(settings).toHaveProperty('snapshotDir');
    expect(settings).toHaveProperty('matchingThreshold');
    expect(settings).toHaveProperty('thresholdRate');
  });

  test('saveSettings updates store values', () => {
    const store = getStore();
    saveSettings({ leftUrl: 'http://localhost:4000' });
    expect(store.set).toHaveBeenCalledWith('leftUrl', 'http://localhost:4000');
  });

  test('saveSettings ignores unknown keys', () => {
    const store = getStore();
    const callCount = store.set.mock.calls.length;
    saveSettings({ unknownKey: 'value' });
    expect(store.set.mock.calls.length).toBe(callCount);
  });

  test('saveSettings handles multiple valid keys at once', () => {
    const store = getStore();
    saveSettings({
      leftUrl: 'http://a.com',
      rightUrl: 'http://b.com',
      snapshotDir: '/tmp',
      matchingThreshold: 0.5,
      thresholdRate: 0.3,
    });
    expect(store.set).toHaveBeenCalledWith('leftUrl', 'http://a.com');
    expect(store.set).toHaveBeenCalledWith('rightUrl', 'http://b.com');
    expect(store.set).toHaveBeenCalledWith('snapshotDir', '/tmp');
    expect(store.set).toHaveBeenCalledWith('matchingThreshold', 0.5);
    expect(store.set).toHaveBeenCalledWith('thresholdRate', 0.3);
  });

  test('saveSettings with empty object does nothing', () => {
    const store = getStore();
    const callCount = store.set.mock.calls.length;
    saveSettings({});
    expect(store.set.mock.calls.length).toBe(callCount);
  });

  test('saveSettings with mix of valid and invalid keys only saves valid ones', () => {
    const store = getStore();
    const callCount = store.set.mock.calls.length;
    saveSettings({ leftUrl: 'http://x.com', invalidKey: 'nope', anotherBad: 123 });
    expect(store.set.mock.calls.length).toBe(callCount + 1);
    expect(store.set).toHaveBeenCalledWith('leftUrl', 'http://x.com');
  });

  test('getSettings returns all five expected keys', () => {
    const settings = getSettings();
    const keys = Object.keys(settings);
    expect(keys.sort()).toEqual([
      'leftUrl', 'matchingThreshold', 'rightUrl', 'snapshotDir', 'thresholdRate',
    ]);
  });

  test('getSettings returns values for snapshotDir key', () => {
    const settings = getSettings();
    expect(settings.snapshotDir).toBeDefined();
  });

  test('getSettings returns values for matchingThreshold key', () => {
    const settings = getSettings();
    expect(typeof settings.matchingThreshold === 'number' || settings.matchingThreshold === undefined).toBe(true);
  });

  test('getSettings returns values for thresholdRate key', () => {
    const settings = getSettings();
    expect(typeof settings.thresholdRate === 'number' || settings.thresholdRate === undefined).toBe(true);
  });

  test('getStore returns instance with get, set, and delete methods', () => {
    const store = getStore();
    expect(typeof store.get).toBe('function');
    expect(typeof store.set).toBe('function');
    expect(typeof store.delete).toBe('function');
  });

  // --- 追加エッジケーステスト ---

  test('saveSettings：空オブジェクトを渡した場合、set が一度も呼ばれない', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({});
    expect(store.set).not.toHaveBeenCalled();
  });

  test('saveSettings：スキーマに存在しないキーのみを渡した場合、set が一度も呼ばれない', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({ bogusKey: 'abc', anotherFake: 42, yetAnother: true } as any);
    expect(store.set).not.toHaveBeenCalled();
  });

  test('saveSettings：すべての有効キーを一度に保存できる', () => {
    const store = getStore();
    store.set.mockClear();
    const allSettings = {
      leftUrl: 'http://left.example.com',
      rightUrl: 'http://right.example.com',
      snapshotDir: '/home/user/snapshots',
      matchingThreshold: 0.8,
      thresholdRate: 0.1,
    };
    saveSettings(allSettings);
    expect(store.set).toHaveBeenCalledTimes(5);
    expect(store.set).toHaveBeenCalledWith('leftUrl', 'http://left.example.com');
    expect(store.set).toHaveBeenCalledWith('rightUrl', 'http://right.example.com');
    expect(store.set).toHaveBeenCalledWith('snapshotDir', '/home/user/snapshots');
    expect(store.set).toHaveBeenCalledWith('matchingThreshold', 0.8);
    expect(store.set).toHaveBeenCalledWith('thresholdRate', 0.1);
  });

  test('getStore：複数回呼び出してもシングルトンとして同一参照を返す', () => {
    const store1 = getStore();
    const store2 = getStore();
    const store3 = getStore();
    expect(store1).toBe(store2);
    expect(store2).toBe(store3);
    expect(store1).toBe(store3);
  });

  test('getSettings：デフォルト状態で正しい型の値を返す', () => {
    const settings = getSettings();
    // すべてのキーが存在し、型が正しいことを検証
    expect(typeof settings.leftUrl === 'string' || settings.leftUrl === undefined).toBe(true);
    expect(typeof settings.rightUrl === 'string' || settings.rightUrl === undefined).toBe(true);
    expect(typeof settings.snapshotDir === 'string' || settings.snapshotDir === undefined).toBe(true);
    expect(typeof settings.matchingThreshold === 'number' || settings.matchingThreshold === undefined).toBe(true);
    expect(typeof settings.thresholdRate === 'number' || settings.thresholdRate === undefined).toBe(true);
  });

  test('getSettings：saveSettings で保存した値が反映される', () => {
    saveSettings({ leftUrl: 'http://updated.example.com', matchingThreshold: 0.75 });
    const settings = getSettings();
    expect(settings.leftUrl).toBe('http://updated.example.com');
    expect(settings.matchingThreshold).toBe(0.75);
  });

  test('saveSettings：数値キーに境界値 0 を設定できる', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({ matchingThreshold: 0, thresholdRate: 0 });
    expect(store.set).toHaveBeenCalledWith('matchingThreshold', 0);
    expect(store.set).toHaveBeenCalledWith('thresholdRate', 0);
  });

  test('saveSettings：数値キーに境界値 1 を設定できる', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({ matchingThreshold: 1, thresholdRate: 1 });
    expect(store.set).toHaveBeenCalledWith('matchingThreshold', 1);
    expect(store.set).toHaveBeenCalledWith('thresholdRate', 1);
  });

  test('saveSettings：文字列キーに空文字列を設定できる', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({ leftUrl: '', rightUrl: '', snapshotDir: '' });
    expect(store.set).toHaveBeenCalledTimes(3);
    expect(store.set).toHaveBeenCalledWith('leftUrl', '');
    expect(store.set).toHaveBeenCalledWith('rightUrl', '');
    expect(store.set).toHaveBeenCalledWith('snapshotDir', '');
  });

  test('saveSettings：有効キー1つと無効キー多数の混合で、有効キーのみ保存される', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({
      rightUrl: 'http://valid.com',
      fake1: 'x',
      fake2: 'y',
      fake3: 'z',
      fake4: 'w',
    } as any);
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith('rightUrl', 'http://valid.com');
  });

  test('getSettings：返却オブジェクトのキー数が正確に5つである', () => {
    const settings = getSettings();
    expect(Object.keys(settings)).toHaveLength(5);
  });

  test('saveSettings：単一キー snapshotDir だけを更新できる', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({ snapshotDir: '/new/path/to/snapshots' });
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith('snapshotDir', '/new/path/to/snapshots');
  });

  test('saveSettings：単一キー thresholdRate だけを更新できる', () => {
    const store = getStore();
    store.set.mockClear();
    saveSettings({ thresholdRate: 0.42 });
    expect(store.set).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith('thresholdRate', 0.42);
  });

  test('getSettings：store.get をキーごとに正確に呼び出している', () => {
    const store = getStore();
    store.get.mockClear();
    getSettings();
    expect(store.get).toHaveBeenCalledWith('leftUrl');
    expect(store.get).toHaveBeenCalledWith('rightUrl');
    expect(store.get).toHaveBeenCalledWith('snapshotDir');
    expect(store.get).toHaveBeenCalledWith('matchingThreshold');
    expect(store.get).toHaveBeenCalledWith('thresholdRate');
    expect(store.get).toHaveBeenCalledTimes(5);
  });
});
