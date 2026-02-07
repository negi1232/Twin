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
});
