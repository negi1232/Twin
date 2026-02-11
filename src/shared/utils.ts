/**
 * @module shared/utils
 * @description 共有ユーティリティ関数と CSS プロパティ分類。
 * Main プロセスと Renderer プロセスの両方から使用される。
 * - Main: import { classifyProperty, ... } from '../shared/utils'
 * - Renderer: CommonJS shim 経由で <script> タグとしてロード
 * - Tests: require('../../src/shared/utils')
 */

// --- HTML Escape ---

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- CSS Property Category Classification ---

const LAYOUT_PROPS: ReadonlySet<string> = new Set([
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'clear',
  'z-index',
  'overflow',
  'overflow-x',
  'overflow-y',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-width',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'flex',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-self',
  'align-content',
  'grid-template-columns',
  'grid-template-rows',
  'grid-column',
  'grid-row',
  'gap',
  'row-gap',
  'column-gap',
  'box-sizing',
  'vertical-align',
]);

const TEXT_PROPS: ReadonlySet<string> = new Set([
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-decoration',
  'text-transform',
  'text-indent',
  'text-shadow',
  'white-space',
  'word-break',
  'word-wrap',
  'overflow-wrap',
  'color',
  'direction',
  'unicode-bidi',
  'writing-mode',
]);

const VISUAL_PROPS: ReadonlySet<string> = new Set([
  'background',
  'background-color',
  'background-image',
  'background-position',
  'background-size',
  'background-repeat',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-style',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  'box-shadow',
  'opacity',
  'visibility',
  'outline',
  'outline-color',
  'outline-style',
  'outline-width',
  'transform',
  'transition',
  'animation',
  'cursor',
  'filter',
  'backdrop-filter',
]);

function classifyProperty(prop: string): string {
  if (LAYOUT_PROPS.has(prop)) return 'layout';
  if (TEXT_PROPS.has(prop)) return 'text';
  if (VISUAL_PROPS.has(prop)) return 'visual';
  return 'other';
}

export { escapeHtml, classifyProperty, LAYOUT_PROPS, TEXT_PROPS, VISUAL_PROPS };
