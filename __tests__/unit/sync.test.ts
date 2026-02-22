export {};

import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const {
  isSyncEnabled,
  toggleSync,
  buildScrollToScript,
  extractPathFromUrl,
} = require('../../src/renderer/scripts/sync');

describe('Sync Module', () => {
  test('sync is enabled by default', () => {
    expect(isSyncEnabled()).toBe(true);
  });

  test('toggleSync toggles state and returns new value', () => {
    const result = toggleSync();
    expect(result).toBe(false);
    expect(isSyncEnabled()).toBe(false);

    // Toggle back
    const result2 = toggleSync();
    expect(result2).toBe(true);
    expect(isSyncEnabled()).toBe(true);
  });

  test('buildScrollToScript generates correct JavaScript', () => {
    const script = buildScrollToScript(100, 200);
    expect(script).toBe('window.scrollTo(100, 200)');
  });

  test('buildScrollToScript handles zero values', () => {
    const script = buildScrollToScript(0, 0);
    expect(script).toBe('window.scrollTo(0, 0)');
  });

  test('extractPathFromUrl extracts pathname correctly', () => {
    expect(extractPathFromUrl('http://localhost:3000/about')).toBe('/about');
    expect(extractPathFromUrl('http://localhost:3000/')).toBe('/');
    expect(extractPathFromUrl('http://localhost:3000/products/123')).toBe('/products/123');
  });

  test('extractPathFromUrl returns / for invalid URLs', () => {
    expect(extractPathFromUrl('not-a-url')).toBe('/');
    expect(extractPathFromUrl('')).toBe('/');
  });

  test('toggleSync multiple times returns alternating values', () => {
    // Reset to known state
    while (!isSyncEnabled()) toggleSync();
    expect(toggleSync()).toBe(false);
    expect(toggleSync()).toBe(true);
    expect(toggleSync()).toBe(false);
    expect(toggleSync()).toBe(true);
  });

  test('buildScrollToScript with large values', () => {
    const script = buildScrollToScript(99999, 88888);
    expect(script).toBe('window.scrollTo(99999, 88888)');
  });

  test('buildScrollToScript with negative values', () => {
    const script = buildScrollToScript(-10, -20);
    expect(script).toBe('window.scrollTo(-10, -20)');
  });

  test('buildScrollToScript with float values', () => {
    const script = buildScrollToScript(100.5, 200.7);
    expect(script).toBe('window.scrollTo(100.5, 200.7)');
  });

  test('extractPathFromUrl with query string', () => {
    expect(extractPathFromUrl('http://localhost:3000/page?q=test')).toBe('/page');
  });

  test('extractPathFromUrl with hash fragment', () => {
    expect(extractPathFromUrl('http://localhost:3000/page#section')).toBe('/page');
  });

  test('extractPathFromUrl with https URL', () => {
    expect(extractPathFromUrl('https://example.com/secure/path')).toBe('/secure/path');
  });

  test('extractPathFromUrl with port and path', () => {
    expect(extractPathFromUrl('http://localhost:8080/api/v1/users')).toBe('/api/v1/users');
  });

  test('extractPathFromUrl returns / for null', () => {
    expect(extractPathFromUrl(null as any)).toBe('/');
  });

  test('extractPathFromUrl returns / for undefined', () => {
    expect(extractPathFromUrl(undefined as any)).toBe('/');
  });
});

describe('Sync Module - ブラウザ環境（module 未定義）', () => {
  test('module が未定義の場合、module.exports へのエクスポートをスキップする', () => {
    const filePath = path.resolve(__dirname, '../../src/renderer/scripts/sync.ts');
    const source = fs.readFileSync(filePath, 'utf-8');

    // TypeScript の型注釈を除去して素の JS として実行可能にする
    const jsSource = source
      .replace(/: boolean/g, '')
      .replace(/: number/g, '')
      .replace(/: string/g, '');

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
      URL: URL,
      window: { scrollTo: () => {} },
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
