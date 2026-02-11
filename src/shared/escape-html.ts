/**
 * @module shared/escape-html
 * @description HTML 特殊文字をエスケープするユーティリティ。
 * Main プロセス (generateScanReportHTML) と Renderer プロセス (UI) の
 * 両方から参照される単一の定義。
 */

function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export { escapeHtml };

// Allow renderer <script> tag usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { escapeHtml };
}
