/**
 * @module main/screenshot
 * @description 左右ビューのスクリーンショットを撮影し、expected / actual ディレクトリに保存する。
 */

const { mkdir, writeFile } = require('fs/promises');
const path = require('path');

/**
 * 左右ビューのスクリーンショットを同時に撮影し PNG ファイルとして保存する。
 * @param {Electron.WebContentsView} leftView - Expected 側ビュー
 * @param {Electron.WebContentsView} rightView - Actual 側ビュー
 * @param {string} snapshotDir - スナップショットの保存先ディレクトリ
 * @param {string} pageName - ページ名（ファイル名のプレフィックスに使用）
 * @returns {Promise<string>} 保存されたファイル名（例: "page_1234567890.png"）
 */
async function captureScreenshots(leftView, rightView, snapshotDir, pageName) {
  const timestamp = Date.now();
  const fileName = `${pageName}_${timestamp}.png`;

  await mkdir(path.join(snapshotDir, 'expected'), { recursive: true });
  await mkdir(path.join(snapshotDir, 'actual'), { recursive: true });

  const [leftImage, rightImage] = await Promise.all([
    leftView.webContents.capturePage(),
    rightView.webContents.capturePage(),
  ]);

  await Promise.all([
    writeFile(path.join(snapshotDir, 'expected', fileName), leftImage.toPNG()),
    writeFile(path.join(snapshotDir, 'actual', fileName), rightImage.toPNG()),
  ]);

  return fileName;
}

module.exports = { captureScreenshots };
