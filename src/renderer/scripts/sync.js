/**
 * @module renderer/sync
 * @description Renderer 側の同期状態管理とスクロール同期スクリプトのビルダー。
 */

let syncEnabled = true;

/**
 * 同期が有効かどうかを返す。
 * @returns {boolean}
 */
function isSyncEnabled() {
  return syncEnabled;
}

/**
 * 同期の有効/無効を切り替える。
 * @returns {boolean} 切り替え後の状態
 */
function toggleSync() {
  syncEnabled = !syncEnabled;
  return syncEnabled;
}

/**
 * スクロールイベントを electronAPI.syncScroll に送信する JS スクリプトを生成する。
 * @returns {string} インジェクション用の JavaScript コード
 */
function buildScrollSyncScript() {
  return `
    (function() {
      let ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            window.electronAPI.syncScroll({
              scrollX: window.scrollX,
              scrollY: window.scrollY
            });
            ticking = false;
          });
          ticking = true;
        }
      });
    })();
  `;
}

/**
 * 指定座標にスクロールする JS スクリプトを生成する。
 * @param {number} scrollX - 水平スクロール位置
 * @param {number} scrollY - 垂直スクロール位置
 * @returns {string}
 */
function buildScrollToScript(scrollX, scrollY) {
  return `window.scrollTo(${scrollX}, ${scrollY})`;
}

/**
 * URL からパス部分を抽出する。パース失敗時は "/" を返す。
 * @param {string} url - 対象の URL
 * @returns {string} パス部分
 */
function extractPathFromUrl(url) {
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
    buildScrollSyncScript,
    buildScrollToScript,
    extractPathFromUrl,
  };
}
