const Store = require('electron-store');

let store = null;

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

function getStore() {
  if (!store) {
    store = new Store({ schema });
  }
  return store;
}

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

function saveSettings(settings) {
  const s = getStore();
  for (const [key, value] of Object.entries(settings)) {
    if (schema[key] !== undefined) {
      s.set(key, value);
    }
  }
}

module.exports = { getStore, getSettings, saveSettings };
