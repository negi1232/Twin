/**
 * @module renderer/sync
 * @description Renderer 側の同期状態管理とスクロール同期スクリプトのビルダー。
 */

let syncEnabled: boolean = true;

/**
 * 同期が有効かどうかを返す。
 */
function isSyncEnabled(): boolean {
  return syncEnabled;
}

/**
 * 同期の有効/無効を切り替える。
 */
function toggleSync(): boolean {
  syncEnabled = !syncEnabled;
  return syncEnabled;
}

/**
 * 指定座標にスクロールする JS スクリプトを生成する。
 */
function buildScrollToScript(scrollX: number, scrollY: number): string {
  return `window.scrollTo(${scrollX}, ${scrollY})`;
}

/**
 * URL からパス部分を抽出する。パース失敗時は "/" を返す。
 */
function extractPathFromUrl(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return '/';
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    isSyncEnabled,
    toggleSync,
    buildScrollToScript,
    extractPathFromUrl,
  };
}
