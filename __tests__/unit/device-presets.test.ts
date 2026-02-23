export {};

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
    for (const [name, preset] of Object.entries(PRESETS) as [string, any][]) {
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

  test('iPhone 14 Pro has correct dimensions', () => {
    expect(PRESETS['iPhone 14 Pro']).toEqual({ width: 393, height: 852 });
  });

  test('iPad has correct dimensions', () => {
    expect(PRESETS['iPad']).toEqual({ width: 768, height: 1024 });
  });

  test('Desktop has correct dimensions', () => {
    expect(PRESETS['Desktop']).toEqual({ width: 1280, height: 900 });
  });

  test('PRESET_LIST items have name, width, and height', () => {
    PRESET_LIST.forEach((preset: any) => {
      expect(preset).toHaveProperty('name');
      expect(preset).toHaveProperty('width');
      expect(preset).toHaveProperty('height');
      expect(typeof preset.name).toBe('string');
    });
  });

  test('getPresetByIndex returns all 5 presets', () => {
    for (let i = 0; i < 5; i++) {
      const preset = getPresetByIndex(i);
      expect(preset).not.toBeNull();
      expect(preset.name).toBeTruthy();
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
    }
  });

  test('PRESET_LIST order matches PRESETS keys', () => {
    const names = PRESET_LIST.map((p: any) => p.name);
    expect(names).toEqual(['iPhone SE', 'iPhone 14 Pro', 'iPad', 'Desktop', 'Full HD']);
  });

  test('getPresetByIndex returns falsy for float index', () => {
    expect(getPresetByIndex(1.5)).toBeFalsy();
  });

  test('getPresetByIndex returns falsy for NaN', () => {
    expect(getPresetByIndex(NaN)).toBeFalsy();
  });

  test('all preset widths are positive integers', () => {
    PRESET_LIST.forEach((preset: any) => {
      expect(Number.isInteger(preset.width)).toBe(true);
      expect(preset.width).toBeGreaterThan(0);
    });
  });

  test('all preset heights are positive integers', () => {
    PRESET_LIST.forEach((preset: any) => {
      expect(Number.isInteger(preset.height)).toBe(true);
      expect(preset.height).toBeGreaterThan(0);
    });
  });

  test('presets are sorted by width ascending', () => {
    for (let i = 1; i < PRESET_LIST.length; i++) {
      expect(PRESET_LIST[i].width).toBeGreaterThanOrEqual(PRESET_LIST[i - 1].width);
    }
  });
});
