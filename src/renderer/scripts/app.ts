/**
 * @module renderer/app
 * @description Renderer プロセスのエントリーポイント。
 * DOM 読み込み完了後に UI コントロールを初期化する。
 */
document.addEventListener('DOMContentLoaded', () => {
  initUIControls();
  initCssCompare();
});
