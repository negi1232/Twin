export {};

const {
  escapeHtml,
  classifyProperty,
  LAYOUT_PROPS,
  TEXT_PROPS,
  VISUAL_PROPS,
} = require('../../src/shared/utils');

// ---------- escapeHtml ----------
describe('escapeHtml', () => {
  test('null を渡すと空文字列を返す', () => {
    expect(escapeHtml(null)).toBe('');
  });

  test('undefined を渡すと空文字列を返す', () => {
    expect(escapeHtml(undefined)).toBe('');
  });

  test('空文字列を渡すと空文字列を返す', () => {
    expect(escapeHtml('')).toBe('');
  });

  test('特殊文字を含まない文字列はそのまま返す', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  test('& をエスケープする', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
  });

  test('< をエスケープする', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  test('> をエスケープする', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  test('" をエスケープする', () => {
    expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
  });

  test("' をエスケープする", () => {
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  test('すべての特殊文字を同時にエスケープする', () => {
    expect(escapeHtml('<div class="test">&\'</div>')).toBe(
      '&lt;div class=&quot;test&quot;&gt;&amp;&#39;&lt;/div&gt;'
    );
  });

  test('複数の同じ特殊文字をすべてエスケープする', () => {
    expect(escapeHtml('<<>>')).toBe('&lt;&lt;&gt;&gt;');
  });

  test('特殊文字のみの文字列をエスケープする', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

// ---------- LAYOUT_PROPS ----------
describe('LAYOUT_PROPS', () => {
  test('ReadonlySet である', () => {
    expect(LAYOUT_PROPS).toBeInstanceOf(Set);
  });

  test('主要なレイアウトプロパティを含む', () => {
    const expected = [
      'display', 'position', 'top', 'right', 'bottom', 'left',
      'float', 'clear', 'z-index', 'overflow', 'overflow-x', 'overflow-y',
      'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
      'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
      'border-width', 'border-top-width', 'border-right-width',
      'border-bottom-width', 'border-left-width',
      'flex', 'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'flex-wrap',
      'justify-content', 'align-items', 'align-self', 'align-content',
      'grid-template-columns', 'grid-template-rows', 'grid-column', 'grid-row',
      'gap', 'row-gap', 'column-gap',
      'box-sizing', 'vertical-align',
    ];
    for (const prop of expected) {
      expect(LAYOUT_PROPS.has(prop)).toBe(true);
    }
  });

  test('テキスト・ビジュアル系プロパティを含まない', () => {
    expect(LAYOUT_PROPS.has('color')).toBe(false);
    expect(LAYOUT_PROPS.has('background-color')).toBe(false);
    expect(LAYOUT_PROPS.has('font-size')).toBe(false);
  });
});

// ---------- TEXT_PROPS ----------
describe('TEXT_PROPS', () => {
  test('ReadonlySet である', () => {
    expect(TEXT_PROPS).toBeInstanceOf(Set);
  });

  test('主要なテキストプロパティを含む', () => {
    const expected = [
      'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
      'line-height', 'letter-spacing', 'word-spacing',
      'text-align', 'text-decoration', 'text-transform', 'text-indent', 'text-shadow',
      'white-space', 'word-break', 'word-wrap', 'overflow-wrap',
      'color', 'direction', 'unicode-bidi', 'writing-mode',
    ];
    for (const prop of expected) {
      expect(TEXT_PROPS.has(prop)).toBe(true);
    }
  });

  test('レイアウト・ビジュアル系プロパティを含まない', () => {
    expect(TEXT_PROPS.has('display')).toBe(false);
    expect(TEXT_PROPS.has('opacity')).toBe(false);
    expect(TEXT_PROPS.has('background')).toBe(false);
  });
});

// ---------- VISUAL_PROPS ----------
describe('VISUAL_PROPS', () => {
  test('ReadonlySet である', () => {
    expect(VISUAL_PROPS).toBeInstanceOf(Set);
  });

  test('主要なビジュアルプロパティを含む', () => {
    const expected = [
      'background', 'background-color', 'background-image',
      'background-position', 'background-size', 'background-repeat',
      'border-color', 'border-top-color', 'border-right-color',
      'border-bottom-color', 'border-left-color',
      'border-style', 'border-top-style', 'border-right-style',
      'border-bottom-style', 'border-left-style',
      'border-radius', 'border-top-left-radius', 'border-top-right-radius',
      'border-bottom-left-radius', 'border-bottom-right-radius',
      'box-shadow', 'opacity', 'visibility',
      'outline', 'outline-color', 'outline-style', 'outline-width',
      'transform', 'transition', 'animation',
      'cursor', 'filter', 'backdrop-filter',
    ];
    for (const prop of expected) {
      expect(VISUAL_PROPS.has(prop)).toBe(true);
    }
  });

  test('レイアウト・テキスト系プロパティを含まない', () => {
    expect(VISUAL_PROPS.has('display')).toBe(false);
    expect(VISUAL_PROPS.has('font-size')).toBe(false);
    expect(VISUAL_PROPS.has('color')).toBe(false);
  });
});

// ---------- classifyProperty ----------
describe('classifyProperty', () => {
  test('レイアウトプロパティを layout に分類する', () => {
    expect(classifyProperty('display')).toBe('layout');
    expect(classifyProperty('width')).toBe('layout');
    expect(classifyProperty('margin-top')).toBe('layout');
    expect(classifyProperty('flex-grow')).toBe('layout');
    expect(classifyProperty('grid-column')).toBe('layout');
    expect(classifyProperty('box-sizing')).toBe('layout');
    expect(classifyProperty('vertical-align')).toBe('layout');
  });

  test('テキストプロパティを text に分類する', () => {
    expect(classifyProperty('font-size')).toBe('text');
    expect(classifyProperty('color')).toBe('text');
    expect(classifyProperty('line-height')).toBe('text');
    expect(classifyProperty('text-align')).toBe('text');
    expect(classifyProperty('writing-mode')).toBe('text');
  });

  test('ビジュアルプロパティを visual に分類する', () => {
    expect(classifyProperty('background-color')).toBe('visual');
    expect(classifyProperty('opacity')).toBe('visual');
    expect(classifyProperty('box-shadow')).toBe('visual');
    expect(classifyProperty('transform')).toBe('visual');
    expect(classifyProperty('cursor')).toBe('visual');
    expect(classifyProperty('backdrop-filter')).toBe('visual');
  });

  test('未知のプロパティを other に分類する', () => {
    expect(classifyProperty('unknown-property')).toBe('other');
    expect(classifyProperty('')).toBe('other');
    expect(classifyProperty('content')).toBe('other');
    expect(classifyProperty('pointer-events')).toBe('other');
    expect(classifyProperty('user-select')).toBe('other');
  });

  test('3つのカテゴリに該当しないCSSプロパティを other に分類する', () => {
    expect(classifyProperty('clip-path')).toBe('other');
    expect(classifyProperty('resize')).toBe('other');
    expect(classifyProperty('appearance')).toBe('other');
  });
});
