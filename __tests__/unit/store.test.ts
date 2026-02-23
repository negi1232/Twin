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

  test('getSettings returns all expected keys', () => {
    const settings = getSettings();
    const keys = Object.keys(settings);
    expect(keys.sort()).toEqual([
      'leftUrl', 'matchingThreshold', 'rightUrl', 'sidebarFolderPath', 'snapshotDir', 'thresholdRate',
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
});
