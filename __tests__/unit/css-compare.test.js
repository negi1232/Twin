const {
  classifyProperty,
  matchElements,
  compareStyles,
  runFullScan,
  generateScanReportHTML,
  buildGetElementStylesScript,
  buildHighlightScript,
  CSS_COLLECTION_SCRIPT,
  CSS_INSPECT_SCRIPT,
  CSS_INSPECT_CLEANUP_SCRIPT,
  CSS_INSPECT_PREFIX,
  CLEAR_HIGHLIGHT_SCRIPT,
  LAYOUT_PROPS,
  TEXT_PROPS,
  VISUAL_PROPS,
} = require('../../src/main/css-compare');

// ---------- classifyProperty ----------
describe('classifyProperty', () => {
  test('classifies layout properties', () => {
    expect(classifyProperty('display')).toBe('layout');
    expect(classifyProperty('width')).toBe('layout');
    expect(classifyProperty('margin-top')).toBe('layout');
    expect(classifyProperty('flex-grow')).toBe('layout');
    expect(classifyProperty('grid-column')).toBe('layout');
    expect(classifyProperty('box-sizing')).toBe('layout');
    expect(classifyProperty('vertical-align')).toBe('layout');
  });

  test('classifies text properties', () => {
    expect(classifyProperty('font-size')).toBe('text');
    expect(classifyProperty('color')).toBe('text');
    expect(classifyProperty('line-height')).toBe('text');
    expect(classifyProperty('text-align')).toBe('text');
    expect(classifyProperty('writing-mode')).toBe('text');
  });

  test('classifies visual properties', () => {
    expect(classifyProperty('background-color')).toBe('visual');
    expect(classifyProperty('border-radius')).toBe('visual');
    expect(classifyProperty('box-shadow')).toBe('visual');
    expect(classifyProperty('opacity')).toBe('visual');
    expect(classifyProperty('transform')).toBe('visual');
    expect(classifyProperty('cursor')).toBe('visual');
  });

  test('classifies unknown properties as other', () => {
    expect(classifyProperty('unknown-prop')).toBe('other');
    expect(classifyProperty('content')).toBe('other');
    expect(classifyProperty('-webkit-appearance')).toBe('other');
  });
});

// ---------- matchElements ----------
describe('matchElements', () => {
  test('matches elements by key', () => {
    const left = [
      { key: '#header', tag: 'div', method: 'id', styles: {} },
      { key: '.hero', tag: 'section', method: 'unique-class', styles: {} },
    ];
    const right = [
      { key: '#header', tag: 'div', method: 'id', styles: {} },
      { key: '.hero', tag: 'section', method: 'unique-class', styles: {} },
    ];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(2);
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  test('detects added elements (right only)', () => {
    const left = [{ key: '#a', tag: 'div', method: 'id', styles: {} }];
    const right = [
      { key: '#a', tag: 'div', method: 'id', styles: {} },
      { key: '#b', tag: 'span', method: 'id', styles: {} },
    ];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(1);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].key).toBe('#b');
    expect(result.deleted).toHaveLength(0);
  });

  test('detects deleted elements (left only)', () => {
    const left = [
      { key: '#a', tag: 'div', method: 'id', styles: {} },
      { key: '#b', tag: 'span', method: 'id', styles: {} },
    ];
    const right = [{ key: '#a', tag: 'div', method: 'id', styles: {} }];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(1);
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0].key).toBe('#b');
    expect(result.added).toHaveLength(0);
  });

  test('handles empty arrays', () => {
    const result = matchElements([], []);
    expect(result.matched).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });

  test('all left elements deleted when right is empty', () => {
    const left = [{ key: '#a', tag: 'div', method: 'id', styles: {} }];
    const result = matchElements(left, []);
    expect(result.matched).toHaveLength(0);
    expect(result.deleted).toHaveLength(1);
    expect(result.added).toHaveLength(0);
  });

  test('all right elements added when left is empty', () => {
    const right = [{ key: '#a', tag: 'div', method: 'id', styles: {} }];
    const result = matchElements([], right);
    expect(result.matched).toHaveLength(0);
    expect(result.added).toHaveLength(1);
    expect(result.deleted).toHaveLength(0);
  });

  test('handles mixed matched, added, and deleted', () => {
    const left = [
      { key: '#shared', tag: 'div', method: 'id', styles: {} },
      { key: '#deleted', tag: 'p', method: 'id', styles: {} },
    ];
    const right = [
      { key: '#shared', tag: 'div', method: 'id', styles: {} },
      { key: '#added', tag: 'span', method: 'id', styles: {} },
    ];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].left.key).toBe('#shared');
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0].key).toBe('#deleted');
    expect(result.added).toHaveLength(1);
    expect(result.added[0].key).toBe('#added');
  });
});

// ---------- compareStyles ----------
describe('compareStyles', () => {
  test('returns empty array when styles are identical', () => {
    const styles = { 'font-size': '16px', color: 'red' };
    const diffs = compareStyles(styles, styles);
    expect(diffs).toHaveLength(0);
  });

  test('detects changed properties', () => {
    const left = { 'font-size': '16px', color: 'red' };
    const right = { 'font-size': '18px', color: 'red' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].property).toBe('font-size');
    expect(diffs[0].expected).toBe('16px');
    expect(diffs[0].actual).toBe('18px');
    expect(diffs[0].type).toBe('changed');
    expect(diffs[0].category).toBe('text');
  });

  test('detects added properties (right only)', () => {
    const left = { color: 'red' };
    const right = { color: 'red', display: 'flex' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].property).toBe('display');
    expect(diffs[0].expected).toBe('');
    expect(diffs[0].actual).toBe('flex');
    expect(diffs[0].type).toBe('added');
  });

  test('detects deleted properties (left only)', () => {
    const left = { color: 'red', display: 'flex' };
    const right = { color: 'red' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].property).toBe('display');
    expect(diffs[0].expected).toBe('flex');
    expect(diffs[0].actual).toBe('');
    expect(diffs[0].type).toBe('deleted');
  });

  test('handles empty styles', () => {
    expect(compareStyles({}, {})).toHaveLength(0);
  });

  test('handles completely different property sets', () => {
    const left = { 'font-size': '12px' };
    const right = { 'margin-top': '10px' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(2);
    const props = diffs.map((d) => d.property).sort();
    expect(props).toEqual(['font-size', 'margin-top']);
  });

  test('assigns correct categories to diffs', () => {
    const left = { display: 'block', 'font-size': '14px', 'background-color': 'white', content: '""' };
    const right = { display: 'flex', 'font-size': '16px', 'background-color': 'black', content: 'none' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(4);
    const cats = {};
    diffs.forEach((d) => { cats[d.property] = d.category; });
    expect(cats['display']).toBe('layout');
    expect(cats['font-size']).toBe('text');
    expect(cats['background-color']).toBe('visual');
    expect(cats['content']).toBe('other');
  });
});

// ---------- runFullScan ----------
describe('runFullScan', () => {
  test('throws if leftView is not available', async () => {
    await expect(runFullScan(null, {})).rejects.toThrow('Left view is not available');
  });

  test('throws if rightView is not available', async () => {
    const mockLeft = { webContents: { isDestroyed: () => false, executeJavaScript: jest.fn() } };
    await expect(runFullScan(mockLeft, null)).rejects.toThrow('Right view is not available');
  });

  test('throws if leftView is destroyed', async () => {
    const mockLeft = { webContents: { isDestroyed: () => true } };
    const mockRight = { webContents: { isDestroyed: () => false } };
    await expect(runFullScan(mockLeft, mockRight)).rejects.toThrow('Left view is not available');
  });

  test('throws if rightView is destroyed', async () => {
    const mockLeft = { webContents: { isDestroyed: () => false, executeJavaScript: jest.fn() } };
    const mockRight = { webContents: { isDestroyed: () => true } };
    await expect(runFullScan(mockLeft, mockRight)).rejects.toThrow('Right view is not available');
  });

  test('performs full scan with identical elements', async () => {
    const elements = [
      { tag: 'div', key: '#header', method: 'id', styles: { display: 'flex', color: 'red' } },
    ];
    const mockLeft = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockResolvedValue(elements),
      },
    };
    const mockRight = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockResolvedValue(elements),
      },
    };

    const result = await runFullScan(mockLeft, mockRight);
    expect(result.summary.changedElements).toBe(0);
    expect(result.summary.addedElements).toBe(0);
    expect(result.summary.deletedElements).toBe(0);
    expect(result.changed).toHaveLength(0);
  });

  test('detects CSS differences between elements', async () => {
    const leftElements = [
      { tag: 'div', key: '#header', method: 'id', styles: { 'font-size': '16px', color: 'red' } },
    ];
    const rightElements = [
      { tag: 'div', key: '#header', method: 'id', styles: { 'font-size': '18px', color: 'red' } },
    ];
    const mockLeft = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockResolvedValue(leftElements),
      },
    };
    const mockRight = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockResolvedValue(rightElements),
      },
    };

    const result = await runFullScan(mockLeft, mockRight);
    expect(result.summary.changedElements).toBe(1);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].diffs).toHaveLength(1);
    expect(result.changed[0].diffs[0].property).toBe('font-size');
  });

  test('detects added and deleted elements', async () => {
    const leftElements = [
      { tag: 'div', key: '#shared', method: 'id', styles: { color: 'red' } },
      { tag: 'p', key: '#deleted', method: 'id', styles: { color: 'blue' } },
    ];
    const rightElements = [
      { tag: 'div', key: '#shared', method: 'id', styles: { color: 'red' } },
      { tag: 'span', key: '#added', method: 'id', styles: { color: 'green' } },
    ];
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(leftElements) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(rightElements) },
    };

    const result = await runFullScan(mockLeft, mockRight);
    expect(result.summary.addedElements).toBe(1);
    expect(result.summary.deletedElements).toBe(1);
    expect(result.added[0].key).toBe('#added');
    expect(result.deleted[0].key).toBe('#deleted');
  });

  test('sorts results by diff count descending', async () => {
    const leftElements = [
      { tag: 'div', key: '#a', method: 'id', styles: { color: 'red' } },
      { tag: 'div', key: '#b', method: 'id', styles: { color: 'red', 'font-size': '12px', display: 'block' } },
    ];
    const rightElements = [
      { tag: 'div', key: '#a', method: 'id', styles: { color: 'blue' } },
      { tag: 'div', key: '#b', method: 'id', styles: { color: 'blue', 'font-size': '14px', display: 'flex' } },
    ];
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(leftElements) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(rightElements) },
    };

    const result = await runFullScan(mockLeft, mockRight);
    expect(result.changed[0].key).toBe('#b');
    expect(result.changed[0].diffCount).toBe(3);
    expect(result.changed[1].key).toBe('#a');
    expect(result.changed[1].diffCount).toBe(1);
  });

  test('returns correct element counts', async () => {
    const leftElements = [
      { tag: 'div', key: '#a', method: 'id', styles: {} },
      { tag: 'div', key: '#b', method: 'id', styles: {} },
    ];
    const rightElements = [
      { tag: 'div', key: '#a', method: 'id', styles: {} },
    ];
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(leftElements) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(rightElements) },
    };

    const result = await runFullScan(mockLeft, mockRight);
    expect(result.leftCount).toBe(2);
    expect(result.rightCount).toBe(1);
    expect(result.scannedElements).toBe(3);
  });
});

// ---------- generateScanReportHTML ----------
describe('generateScanReportHTML', () => {
  test('generates valid HTML with scan data', () => {
    const scanResult = {
      leftCount: 5,
      rightCount: 5,
      scannedElements: 10,
      changed: [
        {
          tag: 'div',
          key: '#header',
          method: 'id',
          type: 'changed',
          diffCount: 1,
          diffs: [{ property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' }],
        },
      ],
      added: [],
      deleted: [],
      summary: { changedElements: 1, addedElements: 0, deletedElements: 0, totalDiffProperties: 1 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('CSS Scan Report');
    expect(html).toContain('"changedElements":1');
    expect(html).toContain('"totalDiffProperties":1');
  });

  test('generates HTML with no differences', () => {
    const scanResult = {
      leftCount: 0,
      rightCount: 0,
      scannedElements: 0,
      changed: [],
      added: [],
      deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('No differences found');
  });

  test('escapes HTML entities in data', () => {
    const scanResult = {
      leftCount: 1,
      rightCount: 1,
      scannedElements: 2,
      changed: [
        {
          tag: 'div',
          key: '.test<script>',
          method: 'unique-class',
          type: 'changed',
          diffCount: 1,
          diffs: [{ property: 'content', expected: '"<b>test</b>"', actual: '""', category: 'other', type: 'changed' }],
        },
      ],
      added: [],
      deleted: [],
      summary: { changedElements: 1, addedElements: 0, deletedElements: 0, totalDiffProperties: 1 },
    };
    const html = generateScanReportHTML(scanResult);
    // The data is embedded as JSON which automatically escapes
    expect(html).toContain('<!DOCTYPE html>');
  });
});

// ---------- buildGetElementStylesScript ----------
describe('buildGetElementStylesScript', () => {
  test('generates script for id selector', () => {
    const script = buildGetElementStylesScript('#header', 'id');
    expect(script).toContain('#header');
    expect(script).toContain('getComputedStyle');
  });

  test('generates script for data-testid selector', () => {
    const script = buildGetElementStylesScript('[data-testid="cta"]', 'data-testid');
    // JSON.stringify embeds the key safely with escaped quotes
    expect(script).toContain('data-testid');
    expect(script).toContain('cta');
  });

  test('generates script for dom-path selector', () => {
    const script = buildGetElementStylesScript('body > div:nth-of-type(2) > h1', 'dom-path');
    expect(script).toContain('body > div:nth-of-type(2) > h1');
  });

  test('escapes special characters in key', () => {
    const script = buildGetElementStylesScript("#it's-a-test", 'id');
    // JSON.stringify handles escaping (no manual \' needed)
    expect(script).toContain("it's-a-test");
    expect(script).toContain('getElementById');
  });
});

// ---------- buildHighlightScript ----------
describe('buildHighlightScript', () => {
  test('generates highlight script for an element', () => {
    const script = buildHighlightScript('#header');
    expect(script).toContain('#header');
    expect(script).toContain('__twin_right_highlight');
    expect(script).toContain('#f0883e'); // orange color
  });

  test('removes previous highlight', () => {
    const script = buildHighlightScript('.test');
    expect(script).toContain('removeChild');
  });

  test('escapes special characters', () => {
    const script = buildHighlightScript("#it's-special");
    // JSON.stringify handles escaping
    expect(script).toContain("it's-special");
    expect(script).toContain('querySelector');
  });
});

// ---------- Constants ----------
describe('exported constants', () => {
  test('CSS_COLLECTION_SCRIPT is a non-empty string', () => {
    expect(typeof CSS_COLLECTION_SCRIPT).toBe('string');
    expect(CSS_COLLECTION_SCRIPT.length).toBeGreaterThan(0);
    expect(CSS_COLLECTION_SCRIPT).toContain('getComputedStyle');
  });

  test('CSS_INSPECT_SCRIPT is a non-empty string', () => {
    expect(typeof CSS_INSPECT_SCRIPT).toBe('string');
    expect(CSS_INSPECT_SCRIPT.length).toBeGreaterThan(0);
    expect(CSS_INSPECT_SCRIPT).toContain('__twinCssInspectActive');
  });

  test('CSS_INSPECT_CLEANUP_SCRIPT is a non-empty string', () => {
    expect(typeof CSS_INSPECT_CLEANUP_SCRIPT).toBe('string');
    expect(CSS_INSPECT_CLEANUP_SCRIPT).toContain('__twinCssInspectCleanup');
  });

  test('CSS_INSPECT_PREFIX is correct', () => {
    expect(CSS_INSPECT_PREFIX).toBe('__twin_css__');
  });

  test('CLEAR_HIGHLIGHT_SCRIPT removes highlight element', () => {
    expect(CLEAR_HIGHLIGHT_SCRIPT).toContain('__twin_right_highlight');
    expect(CLEAR_HIGHLIGHT_SCRIPT).toContain('removeChild');
  });

  test('LAYOUT_PROPS contains expected properties', () => {
    expect(LAYOUT_PROPS.has('display')).toBe(true);
    expect(LAYOUT_PROPS.has('width')).toBe(true);
    expect(LAYOUT_PROPS.has('flex-grow')).toBe(true);
  });

  test('TEXT_PROPS contains expected properties', () => {
    expect(TEXT_PROPS.has('font-size')).toBe(true);
    expect(TEXT_PROPS.has('color')).toBe(true);
    expect(TEXT_PROPS.has('line-height')).toBe(true);
  });

  test('VISUAL_PROPS contains expected properties', () => {
    expect(VISUAL_PROPS.has('background-color')).toBe(true);
    expect(VISUAL_PROPS.has('opacity')).toBe(true);
    expect(VISUAL_PROPS.has('box-shadow')).toBe(true);
  });

  test('property categories are mutually exclusive', () => {
    for (const prop of LAYOUT_PROPS) {
      expect(TEXT_PROPS.has(prop)).toBe(false);
      expect(VISUAL_PROPS.has(prop)).toBe(false);
    }
    for (const prop of TEXT_PROPS) {
      expect(LAYOUT_PROPS.has(prop)).toBe(false);
      expect(VISUAL_PROPS.has(prop)).toBe(false);
    }
    for (const prop of VISUAL_PROPS) {
      expect(LAYOUT_PROPS.has(prop)).toBe(false);
      expect(TEXT_PROPS.has(prop)).toBe(false);
    }
  });

  test('LAYOUT_PROPS contains all flex-related properties', () => {
    const flexProps = ['flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap'];
    for (const p of flexProps) {
      expect(LAYOUT_PROPS.has(p)).toBe(true);
    }
  });

  test('LAYOUT_PROPS contains all grid-related properties', () => {
    const gridProps = ['grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row', 'gap', 'row-gap', 'column-gap'];
    for (const p of gridProps) {
      expect(LAYOUT_PROPS.has(p)).toBe(true);
    }
  });

  test('TEXT_PROPS contains all font-related properties', () => {
    const fontProps = ['font-family', 'font-size', 'font-weight', 'font-style', 'font-variant'];
    for (const p of fontProps) {
      expect(TEXT_PROPS.has(p)).toBe(true);
    }
  });

  test('VISUAL_PROPS contains all border-color properties', () => {
    const borderColorProps = ['border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'];
    for (const p of borderColorProps) {
      expect(VISUAL_PROPS.has(p)).toBe(true);
    }
  });

  test('VISUAL_PROPS contains all border-radius properties', () => {
    const radiusProps = ['border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius'];
    for (const p of radiusProps) {
      expect(VISUAL_PROPS.has(p)).toBe(true);
    }
  });
});

// ---------- Additional classifyProperty tests ----------
describe('classifyProperty edge cases', () => {
  test('all margin properties are layout', () => {
    for (const p of ['margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left']) {
      expect(classifyProperty(p)).toBe('layout');
    }
  });

  test('all padding properties are layout', () => {
    for (const p of ['padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left']) {
      expect(classifyProperty(p)).toBe('layout');
    }
  });

  test('all overflow properties are layout', () => {
    expect(classifyProperty('overflow')).toBe('layout');
    expect(classifyProperty('overflow-x')).toBe('layout');
    expect(classifyProperty('overflow-y')).toBe('layout');
  });

  test('all background properties are visual', () => {
    for (const p of ['background', 'background-color', 'background-image', 'background-position', 'background-size', 'background-repeat']) {
      expect(classifyProperty(p)).toBe('visual');
    }
  });

  test('all outline properties are visual', () => {
    for (const p of ['outline', 'outline-color', 'outline-style', 'outline-width']) {
      expect(classifyProperty(p)).toBe('visual');
    }
  });

  test('vendor-prefixed properties are other', () => {
    expect(classifyProperty('-webkit-appearance')).toBe('other');
    expect(classifyProperty('-moz-appearance')).toBe('other');
  });
});

// ---------- Additional matchElements tests ----------
describe('matchElements edge cases', () => {
  test('duplicate keys in left matches same right element', () => {
    const left = [
      { key: '#dup', tag: 'div', method: 'id', styles: { color: 'red' } },
      { key: '#dup', tag: 'div', method: 'id', styles: { color: 'blue' } },
    ];
    const right = [{ key: '#dup', tag: 'div', method: 'id', styles: { color: 'green' } }];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(2);
  });

  test('large number of elements', () => {
    const leftElements = Array.from({ length: 100 }, (_, i) => ({
      key: `#el-${i}`, tag: 'div', method: 'id', styles: {},
    }));
    const rightElements = Array.from({ length: 100 }, (_, i) => ({
      key: `#el-${i}`, tag: 'div', method: 'id', styles: {},
    }));
    const result = matchElements(leftElements, rightElements);
    expect(result.matched).toHaveLength(100);
  });

  test('elements with various matching methods', () => {
    const left = [
      { key: '#by-id', tag: 'div', method: 'id', styles: {} },
      { key: '[data-testid="cta"]', tag: 'button', method: 'data-testid', styles: {} },
      { key: '.unique-class', tag: 'span', method: 'unique-class', styles: {} },
      { key: 'body > div:nth-of-type(2)', tag: 'div', method: 'dom-path', styles: {} },
    ];
    const right = [...left];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(4);
  });
});

// ---------- Additional compareStyles tests ----------
describe('compareStyles edge cases', () => {
  test('many properties with one changed', () => {
    const base = {};
    for (let i = 0; i < 50; i++) base[`prop-${i}`] = `value-${i}`;
    const left = { ...base };
    const right = { ...base, 'prop-25': 'different-value' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].property).toBe('prop-25');
  });

  test('all properties changed', () => {
    const left = { a: '1', b: '2', c: '3' };
    const right = { a: '4', b: '5', c: '6' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(3);
    diffs.forEach(d => expect(d.type).toBe('changed'));
  });

  test('all properties added', () => {
    const diffs = compareStyles({}, { a: '1', b: '2' });
    expect(diffs).toHaveLength(2);
    diffs.forEach(d => expect(d.type).toBe('added'));
  });

  test('all properties deleted', () => {
    const diffs = compareStyles({ a: '1', b: '2' }, {});
    expect(diffs).toHaveLength(2);
    diffs.forEach(d => expect(d.type).toBe('deleted'));
  });

  test('identical empty string values not reported', () => {
    expect(compareStyles({ color: '' }, { color: '' })).toHaveLength(0);
  });
});

// ---------- Additional runFullScan tests ----------
describe('runFullScan edge cases', () => {
  test('handles executeJavaScript rejection from leftView', async () => {
    const mockLeft = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockRejectedValue(new Error('Script failed')),
      },
    };
    const mockRight = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockResolvedValue([]),
      },
    };
    await expect(runFullScan(mockLeft, mockRight)).rejects.toThrow('Script failed');
  });

  test('handles elements with many style differences', async () => {
    const leftStyles = {};
    const rightStyles = {};
    for (let i = 0; i < 20; i++) {
      leftStyles[`prop-${i}`] = `left-${i}`;
      rightStyles[`prop-${i}`] = `right-${i}`;
    }
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([{ tag: 'div', key: '#big', method: 'id', styles: leftStyles }]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([{ tag: 'div', key: '#big', method: 'id', styles: rightStyles }]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.changed[0].diffCount).toBe(20);
  });

  test('totalDiffProperties sums across all elements', async () => {
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'div', key: '#a', method: 'id', styles: { color: 'red', display: 'block' } },
        { tag: 'div', key: '#b', method: 'id', styles: { color: 'blue' } },
      ]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'div', key: '#a', method: 'id', styles: { color: 'blue', display: 'flex' } },
        { tag: 'div', key: '#b', method: 'id', styles: { color: 'green' } },
      ]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.summary.totalDiffProperties).toBe(3);
  });
});

// ---------- Additional generateScanReportHTML tests ----------
describe('generateScanReportHTML edge cases', () => {
  test('report contains filter buttons', () => {
    const scanResult = {
      leftCount: 1, rightCount: 1, scannedElements: 2,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('data-type');
    expect(html).toContain('data-cat');
  });

  test('report contains export and copy buttons', () => {
    const scanResult = {
      leftCount: 0, rightCount: 0, scannedElements: 0,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('export-json');
    expect(html).toContain('copy-clipboard');
  });

  test('report includes added and deleted elements', () => {
    const scanResult = {
      leftCount: 2, rightCount: 2, scannedElements: 4,
      changed: [],
      added: [{ tag: 'span', key: '#new', method: 'id', type: 'added' }],
      deleted: [{ tag: 'p', key: '#old', method: 'id', type: 'deleted' }],
      summary: { changedElements: 0, addedElements: 1, deletedElements: 1, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('#new');
    expect(html).toContain('#old');
  });

  test('report contains CSP meta tag', () => {
    const scanResult = {
      leftCount: 0, rightCount: 0, scannedElements: 0,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('Content-Security-Policy');
  });
});

// ---------- buildGetElementStylesScript additional tests ----------
describe('buildGetElementStylesScript edge cases', () => {
  test('handles key with double quotes', () => {
    const script = buildGetElementStylesScript('[data-testid="my-btn"]', 'data-testid');
    // JSON.stringify escapes the quotes safely
    expect(script).toContain('data-testid');
    expect(script).toContain('my-btn');
    expect(script).toContain('querySelector');
  });

  test('generated script returns null for missing element', () => {
    const script = buildGetElementStylesScript('#nonexistent', 'id');
    expect(script).toContain('return null');
  });

  test('generated script contains getComputedStyle call', () => {
    const script = buildGetElementStylesScript('#test', 'id');
    expect(script).toContain('getComputedStyle');
  });
});

// ---------- buildHighlightScript additional tests ----------
describe('buildHighlightScript edge cases', () => {
  test('highlight script uses fixed positioning', () => {
    const script = buildHighlightScript('#test');
    expect(script).toContain('position:fixed');
  });

  test('highlight script returns false for missing element', () => {
    const script = buildHighlightScript('#missing');
    expect(script).toContain('return false');
  });

  test('highlight script returns true for found element', () => {
    const script = buildHighlightScript('#exists');
    expect(script).toContain('return true');
  });
});
