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
    expect(extractPathFromUrl(null)).toBe('/');
  });

  test('extractPathFromUrl returns / for undefined', () => {
    expect(extractPathFromUrl(undefined)).toBe('/');
  });
});
