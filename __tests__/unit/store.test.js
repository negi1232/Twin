jest.mock('electron-store', () => {
  return jest.fn().mockImplementation(() => {
    const data = {};
    return {
      get: jest.fn((key, defaultValue) => data[key] !== undefined ? data[key] : defaultValue),
      set: jest.fn((key, value) => { data[key] = value; }),
      delete: jest.fn((key) => { delete data[key]; }),
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
});
