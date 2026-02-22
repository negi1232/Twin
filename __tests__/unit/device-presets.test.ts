export {};

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

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

describe('Device Presets - ブラウザ環境（module 未定義）', () => {
  test('module が未定義の場合、module.exports へのエクスポートをスキップする', () => {
    const filePath = path.resolve(__dirname, '../../src/renderer/scripts/device-presets.ts');
    const source = fs.readFileSync(filePath, 'utf-8');

    // TypeScript の型注釈を除去して素の JS として実行可能にする
    const jsSource = source
      .replace(/: Record<string, \{ width: number; height: number \}>/g, '')
      .replace(/: DevicePreset\[\]/g, '')
      .replace(/: number\)/g, ')')
      .replace(/: DevicePreset \| null/g, '');

    // istanbul-lib-instrument でソースを計装する
    const { createInstrumenter } = require('istanbul-lib-instrument');
    const instrumenter = createInstrumenter({
      esModules: false,
      compact: false,
    });
    const instrumentedCode = instrumenter.instrumentSync(jsSource, filePath);

    // module が存在しないサンドボックスコンテキストで実行
    const coverageData: Record<string, unknown> = {};
    const sandbox: Record<string, unknown> = {
      Object: Object,
      __coverage__: coverageData,
    };
    vm.createContext(sandbox);

    // エラーが発生しないことを確認（module 未定義のブランチを通過）
    expect(() => {
      vm.runInContext(instrumentedCode, sandbox);
    }).not.toThrow();

    // module.exports がセットされていないことを確認
    expect(sandbox.module).toBeUndefined();

    // 計装されたカバレッジデータを Jest のグローバル __coverage__ にマージする
    const globalCoverage = (global as any).__coverage__;
    if (globalCoverage && coverageData) {
      for (const key of Object.keys(coverageData)) {
        if (globalCoverage[key]) {
          // 既存のカバレッジデータとマージ
          const existing = globalCoverage[key];
          const incoming = coverageData[key] as any;

          // ブランチカバレッジをマージ
          for (const branchId of Object.keys(incoming.b)) {
            if (existing.b[branchId]) {
              for (let i = 0; i < incoming.b[branchId].length; i++) {
                existing.b[branchId][i] += incoming.b[branchId][i];
              }
            } else {
              existing.b[branchId] = incoming.b[branchId];
            }
          }

          // ステートメントカバレッジをマージ
          for (const stmtId of Object.keys(incoming.s)) {
            existing.s[stmtId] = (existing.s[stmtId] || 0) + incoming.s[stmtId];
          }

          // 関数カバレッジをマージ
          for (const fnId of Object.keys(incoming.f)) {
            existing.f[fnId] = (existing.f[fnId] || 0) + incoming.f[fnId];
          }
        } else {
          globalCoverage[key] = coverageData[key];
        }
      }
    }
  });
});
