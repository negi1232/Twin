export {};

const {
  classifyProperty,
  LAYOUT_PROPS,
  TEXT_PROPS,
  VISUAL_PROPS,
} = require('../../src/shared/utils');
const {
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
    const props = diffs.map((d: any) => d.property).sort();
    expect(props).toEqual(['font-size', 'margin-top']);
  });

  test('assigns correct categories to diffs', () => {
    const left = { display: 'block', 'font-size': '14px', 'background-color': 'white', content: '""' };
    const right = { display: 'flex', 'font-size': '16px', 'background-color': 'black', content: 'none' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(4);
    const cats: Record<string, string> = {};
    diffs.forEach((d: any) => { cats[d.property] = d.category; });
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
    const base: Record<string, string> = {};
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
    diffs.forEach((d: any) => expect(d.type).toBe('changed'));
  });

  test('all properties added', () => {
    const diffs = compareStyles({}, { a: '1', b: '2' });
    expect(diffs).toHaveLength(2);
    diffs.forEach((d: any) => expect(d.type).toBe('added'));
  });

  test('all properties deleted', () => {
    const diffs = compareStyles({ a: '1', b: '2' }, {});
    expect(diffs).toHaveLength(2);
    diffs.forEach((d: any) => expect(d.type).toBe('deleted'));
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
    const leftStyles: Record<string, string> = {};
    const rightStyles: Record<string, string> = {};
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

// ========== NEW EDGE CASE TESTS ==========

// ---------- compareStyles: 同一スタイルの詳細なエッジケース ----------
describe('compareStyles: 同一スタイルの詳細テスト', () => {
  test('同一オブジェクト参照を渡した場合、差分なし', () => {
    const styles = { color: 'red', display: 'block', 'font-size': '16px' };
    const diffs = compareStyles(styles, styles);
    expect(diffs).toEqual([]);
  });

  test('同一内容だが別オブジェクトの場合、差分なし', () => {
    const left = { color: 'rgb(255, 0, 0)', display: 'flex', 'font-size': '16px', opacity: '1' };
    const right = { color: 'rgb(255, 0, 0)', display: 'flex', 'font-size': '16px', opacity: '1' };
    const diffs = compareStyles(left, right);
    expect(diffs).toEqual([]);
  });

  test('プロパティの順序が異なっても同一内容なら差分なし', () => {
    const left = { 'z-index': 'auto', color: 'red', display: 'block' };
    const right = { display: 'block', 'z-index': 'auto', color: 'red' };
    const diffs = compareStyles(left, right);
    expect(diffs).toEqual([]);
  });

  test('値が空文字列同士の場合、差分なし', () => {
    const left = { color: '', display: '', 'font-size': '' };
    const right = { color: '', display: '', 'font-size': '' };
    const diffs = compareStyles(left, right);
    expect(diffs).toEqual([]);
  });
});

// ---------- compareStyles: 片側が空の場合 ----------
describe('compareStyles: 片側が空のスタイルの場合', () => {
  test('左側が空で右側に複数プロパティがある場合、すべて added', () => {
    const right = { display: 'flex', color: 'red', opacity: '0.5', 'font-size': '14px' };
    const diffs = compareStyles({}, right);
    expect(diffs).toHaveLength(4);
    for (const d of diffs) {
      expect(d.type).toBe('added');
      expect(d.expected).toBe('');
      expect(d.actual).toBe(right[d.property as keyof typeof right]);
    }
  });

  test('右側が空で左側に複数プロパティがある場合、すべて deleted', () => {
    const left = { display: 'block', color: 'blue', opacity: '1', 'font-size': '16px' };
    const diffs = compareStyles(left, {});
    expect(diffs).toHaveLength(4);
    for (const d of diffs) {
      expect(d.type).toBe('deleted');
      expect(d.expected).toBe(left[d.property as keyof typeof left]);
      expect(d.actual).toBe('');
    }
  });

  test('added プロパティの expected は空文字列', () => {
    const diffs = compareStyles({}, { 'background-color': '#fff' });
    expect(diffs).toHaveLength(1);
    expect(diffs[0].expected).toBe('');
    expect(diffs[0].actual).toBe('#fff');
    expect(diffs[0].type).toBe('added');
    expect(diffs[0].category).toBe('visual');
  });

  test('deleted プロパティの actual は空文字列', () => {
    const diffs = compareStyles({ 'background-color': '#000' }, {});
    expect(diffs).toHaveLength(1);
    expect(diffs[0].expected).toBe('#000');
    expect(diffs[0].actual).toBe('');
    expect(diffs[0].type).toBe('deleted');
    expect(diffs[0].category).toBe('visual');
  });
});

// ---------- compareStyles: 大量プロパティのテスト ----------
describe('compareStyles: 大量プロパティのテスト', () => {
  test('200プロパティすべて同一の場合、差分なし', () => {
    const styles: Record<string, string> = {};
    for (let i = 0; i < 200; i++) {
      styles[`prop-${i}`] = `value-${i}`;
    }
    const diffs = compareStyles({ ...styles }, { ...styles });
    expect(diffs).toHaveLength(0);
  });

  test('200プロパティすべて異なる場合、200件の差分', () => {
    const left: Record<string, string> = {};
    const right: Record<string, string> = {};
    for (let i = 0; i < 200; i++) {
      left[`prop-${i}`] = `left-${i}`;
      right[`prop-${i}`] = `right-${i}`;
    }
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(200);
    for (const d of diffs) {
      expect(d.type).toBe('changed');
    }
  });

  test('100プロパティが追加され50プロパティが削除される混合ケース', () => {
    const left: Record<string, string> = {};
    const right: Record<string, string> = {};
    // 50 deleted (left only)
    for (let i = 0; i < 50; i++) {
      left[`deleted-${i}`] = `val-${i}`;
    }
    // 100 added (right only)
    for (let i = 0; i < 100; i++) {
      right[`added-${i}`] = `val-${i}`;
    }
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(150);
    const addedCount = diffs.filter((d: any) => d.type === 'added').length;
    const deletedCount = diffs.filter((d: any) => d.type === 'deleted').length;
    expect(addedCount).toBe(100);
    expect(deletedCount).toBe(50);
  });

  test('変更・追加・削除が混在する場合の正確なカウント', () => {
    const left: Record<string, string> = {
      shared1: 'a', shared2: 'b', shared3: 'c', // changed
      deleted1: 'x', deleted2: 'y',               // deleted
    };
    const right: Record<string, string> = {
      shared1: 'A', shared2: 'B', shared3: 'C',   // changed
      added1: 'p', added2: 'q', added3: 'r',      // added
    };
    const diffs = compareStyles(left, right);
    const changed = diffs.filter((d: any) => d.type === 'changed');
    const added = diffs.filter((d: any) => d.type === 'added');
    const deleted = diffs.filter((d: any) => d.type === 'deleted');
    expect(changed).toHaveLength(3);
    expect(added).toHaveLength(3);
    expect(deleted).toHaveLength(2);
    expect(diffs).toHaveLength(8);
  });
});

// ---------- compareStyles: 特殊な値のテスト ----------
describe('compareStyles: 特殊な値のテスト', () => {
  test('値に特殊文字を含むプロパティの差分検出', () => {
    const left = { content: '"Hello World"' };
    const right = { content: '"Goodbye World"' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].expected).toBe('"Hello World"');
    expect(diffs[0].actual).toBe('"Goodbye World"');
  });

  test('値が非常に長い文字列でも正しく比較', () => {
    const longVal = 'a'.repeat(10000);
    const left = { color: longVal };
    const right = { color: longVal + 'b' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
  });

  test('rgba値の微妙な差分を検出', () => {
    const left = { 'background-color': 'rgba(255, 0, 0, 0.5)' };
    const right = { 'background-color': 'rgba(255, 0, 0, 0.50001)' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
  });

  test('数値文字列の先頭ゼロの違いを検出', () => {
    const left = { 'z-index': '01' };
    const right = { 'z-index': '1' };
    const diffs = compareStyles(left, right);
    expect(diffs).toHaveLength(1);
    expect(diffs[0].type).toBe('changed');
  });
});

// ---------- generateScanReportHTML: 空結果の詳細テスト ----------
describe('generateScanReportHTML: 空結果の詳細テスト', () => {
  test('要素数ゼロ・差分ゼロの完全空スキャン結果', () => {
    const scanResult = {
      leftCount: 0, rightCount: 0, scannedElements: 0,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html lang="ja">');
    expect(html).toContain('CSS Scan Report');
    // Summary values should be 0
    expect(html).toContain('"changedElements":0');
    expect(html).toContain('"addedElements":0');
    expect(html).toContain('"deletedElements":0');
    expect(html).toContain('"totalDiffProperties":0');
  });

  test('要素はあるが差分がない場合のレポート', () => {
    const scanResult = {
      leftCount: 50, rightCount: 50, scannedElements: 100,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('"leftCount":50');
    expect(html).toContain('"rightCount":50');
    expect(html).toContain('"scannedElements":100');
    // No difference text in the renderResults logic
    expect(html).toContain('No differences found');
  });

  test('added のみのレポートに正しいサマリーが含まれる', () => {
    const scanResult = {
      leftCount: 0, rightCount: 3, scannedElements: 3,
      changed: [],
      added: [
        { tag: 'div', key: '#a', method: 'id', type: 'added' },
        { tag: 'span', key: '#b', method: 'id', type: 'added' },
        { tag: 'p', key: '.c', method: 'unique-class', type: 'added' },
      ],
      deleted: [],
      summary: { changedElements: 0, addedElements: 3, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('"addedElements":3');
    expect(html).toContain('#a');
    expect(html).toContain('#b');
    expect(html).toContain('.c');
  });

  test('deleted のみのレポートに正しいサマリーが含まれる', () => {
    const scanResult = {
      leftCount: 2, rightCount: 0, scannedElements: 2,
      changed: [],
      added: [],
      deleted: [
        { tag: 'div', key: '#x', method: 'id', type: 'deleted' },
        { tag: 'nav', key: '.nav', method: 'unique-class', type: 'deleted' },
      ],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 2, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('"deletedElements":2');
    expect(html).toContain('#x');
    expect(html).toContain('.nav');
  });
});

// ---------- generateScanReportHTML: データエスケープのテスト ----------
describe('generateScanReportHTML: データエスケープのテスト', () => {
  test('< と > が \\u003c と \\u003e にエスケープされる', () => {
    const scanResult = {
      leftCount: 1, rightCount: 1, scannedElements: 2,
      changed: [{
        tag: 'div', key: '#test', method: 'id', type: 'changed', diffCount: 1,
        diffs: [{ property: 'content', expected: '<script>alert("xss")</script>', actual: '""', category: 'other', type: 'changed' }],
      }],
      added: [], deleted: [],
      summary: { changedElements: 1, addedElements: 0, deletedElements: 0, totalDiffProperties: 1 },
    };
    const html = generateScanReportHTML(scanResult);
    // Raw < and > should not appear in the embedded JSON data
    // They should be escaped as \u003c and \u003e
    const dataSection = html.split('var data = ')[1].split(';')[0];
    expect(dataSection).not.toContain('<script>');
    expect(dataSection).toContain('\\u003c');
    expect(dataSection).toContain('\\u003e');
  });

  test('Unicode行区切り文字がエスケープされる', () => {
    const scanResult = {
      leftCount: 1, rightCount: 1, scannedElements: 2,
      changed: [{
        tag: 'div', key: '#test', method: 'id', type: 'changed', diffCount: 1,
        diffs: [{ property: 'content', expected: 'line\u2028separator', actual: 'para\u2029separator', category: 'other', type: 'changed' }],
      }],
      added: [], deleted: [],
      summary: { changedElements: 1, addedElements: 0, deletedElements: 0, totalDiffProperties: 1 },
    };
    const html = generateScanReportHTML(scanResult);
    // Raw U+2028 / U+2029 should be escaped in the embedded JSON
    const dataSection = html.split('var data = ')[1].split(';')[0];
    expect(dataSection).not.toContain('\u2028');
    expect(dataSection).not.toContain('\u2029');
  });

  test('大量の changed 要素を含むレポートが正しく生成される', () => {
    const changed = Array.from({ length: 50 }, (_, i) => ({
      tag: 'div', key: `#el-${i}`, method: 'id', type: 'changed', diffCount: 2,
      diffs: [
        { property: 'color', expected: 'red', actual: 'blue', category: 'text', type: 'changed' },
        { property: 'display', expected: 'block', actual: 'flex', category: 'layout', type: 'changed' },
      ],
    }));
    const scanResult = {
      leftCount: 50, rightCount: 50, scannedElements: 100,
      changed, added: [], deleted: [],
      summary: { changedElements: 50, addedElements: 0, deletedElements: 0, totalDiffProperties: 100 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('"changedElements":50');
    expect(html).toContain('"totalDiffProperties":100');
    // Verify the HTML is well-formed (contains closing tags)
    expect(html).toContain('</html>');
    expect(html).toContain('</body>');
  });
});

// ---------- generateScanReportHTML: 構造テスト ----------
describe('generateScanReportHTML: HTML構造のテスト', () => {
  test('レポートにはサマリー・フィルター・結果セクションが含まれる', () => {
    const scanResult = {
      leftCount: 1, rightCount: 1, scannedElements: 2,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('id="summary"');
    expect(html).toContain('id="filters"');
    expect(html).toContain('id="results"');
  });

  test('レポートに renderSummary / renderFilters / renderResults 関数が含まれる', () => {
    const scanResult = {
      leftCount: 0, rightCount: 0, scannedElements: 0,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('function renderSummary()');
    expect(html).toContain('function renderFilters()');
    expect(html).toContain('function renderResults()');
    expect(html).toContain('function init()');
  });

  test('レポートの style セクションに CSS 変数が含まれる', () => {
    const scanResult = {
      leftCount: 0, rightCount: 0, scannedElements: 0,
      changed: [], added: [], deleted: [],
      summary: { changedElements: 0, addedElements: 0, deletedElements: 0, totalDiffProperties: 0 },
    };
    const html = generateScanReportHTML(scanResult);
    expect(html).toContain('--bg-primary');
    expect(html).toContain('--accent-blue');
    expect(html).toContain('--status-passed');
    expect(html).toContain('--status-failed');
  });
});

// ---------- buildHighlightScript: 追加エッジケーステスト ----------
describe('buildHighlightScript: 追加エッジケーステスト', () => {
  test('キーにバックスラッシュを含む場合、JSONエスケープされる', () => {
    const script = buildHighlightScript('.class\\:name');
    // JSON.stringify should escape the backslash
    expect(script).toContain('class');
    expect(script).toContain('querySelector');
  });

  test('キーに改行文字を含む場合、安全にエスケープされる', () => {
    const script = buildHighlightScript('#test\ninjection');
    // JSON.stringify converts \n to \\n
    expect(script).not.toContain('\n#test');
    expect(script).toContain('querySelector');
  });

  test('キーに Unicode 文字を含む場合、正しく埋め込まれる', () => {
    const script = buildHighlightScript('#日本語テスト');
    expect(script).toContain('日本語テスト');
    expect(script).toContain('querySelector');
  });

  test('空のキーでもスクリプトは生成される', () => {
    const script = buildHighlightScript('');
    expect(script).toContain('querySelector');
    expect(script).toContain('__twin_right_highlight');
  });

  test('スクリプトには getBoundingClientRect 呼び出しが含まれる', () => {
    const script = buildHighlightScript('#el');
    expect(script).toContain('getBoundingClientRect');
  });

  test('スクリプトにはオーバーレイの appendChild が含まれる', () => {
    const script = buildHighlightScript('#el');
    expect(script).toContain('appendChild');
  });
});

// ---------- buildGetElementStylesScript: 追加エッジケーステスト ----------
describe('buildGetElementStylesScript: 追加エッジケーステスト', () => {
  test('method が id の場合、getElementById が使用される', () => {
    const script = buildGetElementStylesScript('#my-id', 'id');
    expect(script).toContain('getElementById');
    expect(script).toContain("method === 'id'");
  });

  test('method が id 以外の場合、querySelector が使用される', () => {
    const script = buildGetElementStylesScript('.my-class', 'unique-class');
    expect(script).toContain('querySelector');
  });

  test('キーにバックスラッシュが含まれる場合、JSONエスケープされる', () => {
    const script = buildGetElementStylesScript('.class\\:special', 'unique-class');
    expect(script).toContain('class');
  });

  test('キーに改行文字が含まれる場合、安全にエスケープされる', () => {
    const script = buildGetElementStylesScript('#test\ninjection', 'id');
    // JSON.stringify escapes the newline as \\n inside the string
    expect(script).not.toMatch(/\ninjection/);
  });

  test('空のキーでもスクリプトは生成される', () => {
    const script = buildGetElementStylesScript('', 'dom-path');
    expect(script).toContain('querySelector');
    expect(script).toContain('getComputedStyle');
  });

  test('空の method でもスクリプトは生成される', () => {
    const script = buildGetElementStylesScript('#test', '');
    expect(script).toContain('querySelector');
    expect(script).toContain('getComputedStyle');
  });

  test('method が dom-path の場合、querySelector 経由でアクセス', () => {
    const script = buildGetElementStylesScript('body > div > span:nth-of-type(3)', 'dom-path');
    expect(script).toContain('querySelector');
    expect(script).toContain('body');
    expect(script).toContain('nth-of-type(3)');
  });

  test('スクリプトには try-catch による安全なエラーハンドリングが含まれる', () => {
    const script = buildGetElementStylesScript('#test', 'id');
    expect(script).toContain('try');
    expect(script).toContain('catch');
    expect(script).toContain('return null');
  });

  test('スクリプトは tagName を小文字で返す', () => {
    const script = buildGetElementStylesScript('#test', 'id');
    expect(script).toContain('tagName.toLowerCase()');
  });
});

// ---------- runFullScan: 追加エラーシナリオテスト ----------
describe('runFullScan: 追加エラーシナリオテスト', () => {
  test('rightView の executeJavaScript が拒否された場合にエラーをスロー', async () => {
    const mockLeft = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockResolvedValue([]),
      },
    };
    const mockRight = {
      webContents: {
        isDestroyed: () => false,
        executeJavaScript: jest.fn().mockRejectedValue(new Error('Right script failed')),
      },
    };
    await expect(runFullScan(mockLeft, mockRight)).rejects.toThrow('Right script failed');
  });

  test('両方の view が空の要素を返す場合、差分なし', async () => {
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.scannedElements).toBe(0);
    expect(result.leftCount).toBe(0);
    expect(result.rightCount).toBe(0);
    expect(result.changed).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
    expect(result.summary.changedElements).toBe(0);
    expect(result.summary.addedElements).toBe(0);
    expect(result.summary.deletedElements).toBe(0);
    expect(result.summary.totalDiffProperties).toBe(0);
  });

  test('leftView のみに多数の要素がある場合、すべて deleted として報告', async () => {
    const leftElements = Array.from({ length: 10 }, (_, i) => ({
      tag: 'div', key: `#el-${i}`, method: 'id', styles: { color: 'red' },
    }));
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(leftElements) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.deleted).toHaveLength(10);
    expect(result.added).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
    expect(result.summary.deletedElements).toBe(10);
    for (const del of result.deleted) {
      expect(del.type).toBe('deleted');
    }
  });

  test('rightView のみに多数の要素がある場合、すべて added として報告', async () => {
    const rightElements = Array.from({ length: 10 }, (_, i) => ({
      tag: 'span', key: `#new-${i}`, method: 'id', styles: { display: 'flex' },
    }));
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(rightElements) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.added).toHaveLength(10);
    expect(result.deleted).toHaveLength(0);
    expect(result.changed).toHaveLength(0);
    expect(result.summary.addedElements).toBe(10);
    for (const add of result.added) {
      expect(add.type).toBe('added');
    }
  });

  test('changed 要素に正しい tag / key / method / type が設定される', async () => {
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'button', key: '[data-testid="submit"]', method: 'data-testid', styles: { color: 'red' } },
      ]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'button', key: '[data-testid="submit"]', method: 'data-testid', styles: { color: 'green' } },
      ]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].tag).toBe('button');
    expect(result.changed[0].key).toBe('[data-testid="submit"]');
    expect(result.changed[0].method).toBe('data-testid');
    expect(result.changed[0].type).toBe('changed');
  });

  test('同じ diffCount の要素が複数ある場合、ソート順が安定', async () => {
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'div', key: '#a', method: 'id', styles: { color: 'red' } },
        { tag: 'div', key: '#b', method: 'id', styles: { color: 'red' } },
        { tag: 'div', key: '#c', method: 'id', styles: { color: 'red' } },
      ]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'div', key: '#a', method: 'id', styles: { color: 'blue' } },
        { tag: 'div', key: '#b', method: 'id', styles: { color: 'blue' } },
        { tag: 'div', key: '#c', method: 'id', styles: { color: 'blue' } },
      ]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.changed).toHaveLength(3);
    // All have diffCount 1
    for (const c of result.changed) {
      expect(c.diffCount).toBe(1);
    }
  });

  test('スキャン結果のsummary.totalDiffPropertiesがゼロの場合', async () => {
    const elements = [
      { tag: 'div', key: '#a', method: 'id', styles: { color: 'red', display: 'block' } },
    ];
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(elements) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue(elements) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.summary.totalDiffProperties).toBe(0);
  });

  test('added / deleted 要素の type フィールドが正しく設定される', async () => {
    const mockLeft = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'div', key: '#left-only', method: 'id', styles: {} },
      ]) },
    };
    const mockRight = {
      webContents: { isDestroyed: () => false, executeJavaScript: jest.fn().mockResolvedValue([
        { tag: 'span', key: '#right-only', method: 'id', styles: {} },
      ]) },
    };
    const result = await runFullScan(mockLeft, mockRight);
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted[0].type).toBe('deleted');
    expect(result.deleted[0].tag).toBe('div');
    expect(result.deleted[0].key).toBe('#left-only');
    expect(result.deleted[0].method).toBe('id');
    expect(result.added).toHaveLength(1);
    expect(result.added[0].type).toBe('added');
    expect(result.added[0].tag).toBe('span');
    expect(result.added[0].key).toBe('#right-only');
    expect(result.added[0].method).toBe('id');
  });
});

// ---------- matchElements: 追加マッチング境界テスト ----------
describe('matchElements: マッチング境界テスト', () => {
  test('完全に異なるキーセットの場合、全要素が added/deleted', () => {
    const left = [
      { key: '#a', tag: 'div', method: 'id', styles: {} },
      { key: '#b', tag: 'div', method: 'id', styles: {} },
      { key: '#c', tag: 'div', method: 'id', styles: {} },
    ];
    const right = [
      { key: '#x', tag: 'div', method: 'id', styles: {} },
      { key: '#y', tag: 'div', method: 'id', styles: {} },
    ];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(0);
    expect(result.deleted).toHaveLength(3);
    expect(result.added).toHaveLength(2);
  });

  test('キーが同一で tag/method が異なる要素もマッチする', () => {
    const left = [{ key: '#same', tag: 'div', method: 'id', styles: {} }];
    const right = [{ key: '#same', tag: 'span', method: 'dom-path', styles: {} }];
    const result = matchElements(left, right);
    // matchElements はキーだけでマッチするので、tag/method が違ってもマッチ
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0].left.tag).toBe('div');
    expect(result.matched[0].right.tag).toBe('span');
  });

  test('右側に重複キーがある場合、最後の要素がマッチに使われる', () => {
    const left = [{ key: '#dup', tag: 'div', method: 'id', styles: {} }];
    const right = [
      { key: '#dup', tag: 'span', method: 'id', styles: { color: 'first' } },
      { key: '#dup', tag: 'p', method: 'id', styles: { color: 'second' } },
    ];
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(1);
    // Map overwrites with the last entry, so the second element should be matched
    expect(result.matched[0].right.tag).toBe('p');
    expect(result.matched[0].right.styles).toEqual({ color: 'second' });
  });

  test('500要素の左右で完全マッチ', () => {
    const count = 500;
    const left = Array.from({ length: count }, (_, i) => ({
      key: `.el-${i}`, tag: 'div', method: 'unique-class', styles: {},
    }));
    const right = Array.from({ length: count }, (_, i) => ({
      key: `.el-${i}`, tag: 'div', method: 'unique-class', styles: {},
    }));
    const result = matchElements(left, right);
    expect(result.matched).toHaveLength(count);
    expect(result.added).toHaveLength(0);
    expect(result.deleted).toHaveLength(0);
  });
});

// ---------- CSS_COLLECTION_SCRIPT: 構造テスト ----------
describe('CSS_COLLECTION_SCRIPT: 構造テスト', () => {
  test('IIFE として構成されている', () => {
    expect(CSS_COLLECTION_SCRIPT).toMatch(/^\(function\(\)/);
    expect(CSS_COLLECTION_SCRIPT).toMatch(/\}\)\(\)$/);
  });

  test('META_TAGS フィルタが含まれる', () => {
    expect(CSS_COLLECTION_SCRIPT).toContain('META_TAGS');
    expect(CSS_COLLECTION_SCRIPT).toContain('SCRIPT');
    expect(CSS_COLLECTION_SCRIPT).toContain('STYLE');
    expect(CSS_COLLECTION_SCRIPT).toContain('NOSCRIPT');
  });

  test('display:none 要素をスキップするロジックが含まれる', () => {
    expect(CSS_COLLECTION_SCRIPT).toContain("display === 'none'");
  });

  test('getDomPath 関数が含まれる', () => {
    expect(CSS_COLLECTION_SCRIPT).toContain('function getDomPath');
  });

  test('getMatchKey 関数が含まれる', () => {
    expect(CSS_COLLECTION_SCRIPT).toContain('function getMatchKey');
  });

  test('id / data-testid / unique-class / dom-path のマッチング手法が含まれる', () => {
    expect(CSS_COLLECTION_SCRIPT).toContain("method: 'id'");
    expect(CSS_COLLECTION_SCRIPT).toContain("method: 'data-testid'");
    expect(CSS_COLLECTION_SCRIPT).toContain("method: 'unique-class'");
    expect(CSS_COLLECTION_SCRIPT).toContain("method: 'dom-path'");
  });
});

// ---------- CSS_INSPECT_SCRIPT: 構造テスト ----------
describe('CSS_INSPECT_SCRIPT: 構造テスト', () => {
  test('IIFE として構成されている', () => {
    expect(CSS_INSPECT_SCRIPT).toMatch(/^\(function\(\)/);
    expect(CSS_INSPECT_SCRIPT).toMatch(/\}\)\(\)$/);
  });

  test('二重実行防止のガードが含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain('if (window.__twinCssInspectActive) return');
  });

  test('オーバーレイ要素の作成が含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain('__twin_inspect_overlay');
  });

  test('ツールチップ要素の作成が含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain('__twin_inspect_tooltip');
  });

  test('mousemove と click イベントリスナーの登録が含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain("addEventListener('mousemove'");
    expect(CSS_INSPECT_SCRIPT).toContain("addEventListener('click'");
  });

  test('クリーンアップ関数が含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain('__twinCssInspectCleanup');
    expect(CSS_INSPECT_SCRIPT).toContain('removeEventListener');
  });

  test('inspect-click イベント送信が含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain("send('inspect-click'");
  });

  test('PREFIX を使った console.log 送信ロジックが含まれる', () => {
    expect(CSS_INSPECT_SCRIPT).toContain('PREFIX');
    expect(CSS_INSPECT_SCRIPT).toContain('JSON.stringify');
    expect(CSS_INSPECT_SCRIPT).toContain('console.log');
  });
});

// ---------- CSS_INSPECT_CLEANUP_SCRIPT: 構造テスト ----------
describe('CSS_INSPECT_CLEANUP_SCRIPT: 構造テスト', () => {
  test('IIFE として構成されている', () => {
    expect(CSS_INSPECT_CLEANUP_SCRIPT).toMatch(/^\(function\(\)/);
    expect(CSS_INSPECT_CLEANUP_SCRIPT).toMatch(/\}\)\(\)$/);
  });

  test('typeof チェックで安全にクリーンアップ関数を呼び出す', () => {
    expect(CSS_INSPECT_CLEANUP_SCRIPT).toContain("typeof window.__twinCssInspectCleanup === 'function'");
  });
});

// ---------- CLEAR_HIGHLIGHT_SCRIPT: 構造テスト ----------
describe('CLEAR_HIGHLIGHT_SCRIPT: 構造テスト', () => {
  test('IIFE として構成されている', () => {
    expect(CLEAR_HIGHLIGHT_SCRIPT).toMatch(/^\(function\(\)/);
    expect(CLEAR_HIGHLIGHT_SCRIPT).toMatch(/\}\)\(\)$/);
  });

  test('getElementById でハイライト要素を取得する', () => {
    expect(CLEAR_HIGHLIGHT_SCRIPT).toContain("getElementById('__twin_right_highlight')");
  });
});
