const { PRESETS, PRESET_LIST, getPresetByIndex } = require('../../src/renderer/scripts/device-presets');

describe('Device Presets', () => {
  test('PRESETS contains expected devices', () => {
    expect(PRESETS).toHaveProperty('iPhone SE');
    expect(PRESETS).toHaveProperty('iPhone 14 Pro');
    expect(PRESETS).toHaveProperty('iPad');
    expect(PRESETS).toHaveProperty('Desktop');
    expect(PRESETS).toHaveProperty('Full HD');
  });

  test('each preset has width and height', () => {
    for (const [name, preset] of Object.entries(PRESETS)) {
      expect(preset).toHaveProperty('width');
      expect(preset).toHaveProperty('height');
      expect(typeof preset.width).toBe('number');
      expect(typeof preset.height).toBe('number');
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });

  test('iPhone SE has correct dimensions', () => {
    expect(PRESETS['iPhone SE']).toEqual({ width: 375, height: 667 });
  });

  test('Full HD has correct dimensions', () => {
    expect(PRESETS['Full HD']).toEqual({ width: 1920, height: 1080 });
  });

  test('PRESET_LIST has 5 entries', () => {
    expect(PRESET_LIST).toHaveLength(5);
  });

  test('getPresetByIndex returns correct preset', () => {
    const se = getPresetByIndex(0);
    expect(se.name).toBe('iPhone SE');
    expect(se.width).toBe(375);
    expect(se.height).toBe(667);
  });

  test('getPresetByIndex returns null for invalid index', () => {
    expect(getPresetByIndex(-1)).toBeNull();
    expect(getPresetByIndex(5)).toBeNull();
    expect(getPresetByIndex(100)).toBeNull();
  });
});
