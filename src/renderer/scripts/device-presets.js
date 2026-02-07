const PRESETS = {
  'iPhone SE': { width: 375, height: 667 },
  'iPhone 14 Pro': { width: 393, height: 852 },
  'iPad': { width: 768, height: 1024 },
  'Desktop': { width: 1280, height: 900 },
  'Full HD': { width: 1920, height: 1080 },
};

const PRESET_LIST = Object.entries(PRESETS).map(([name, size]) => ({
  name,
  ...size,
}));

function getPresetByIndex(index) {
  if (index < 0 || index >= PRESET_LIST.length) {
    return null;
  }
  return PRESET_LIST[index];
}

// Export for Node.js (tests) or set as global for browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PRESETS, PRESET_LIST, getPresetByIndex };
}
