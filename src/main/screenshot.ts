/**
 * @module main/screenshot
 * @description 左右ビューのスクリーンショットを撮影し、expected / actual ディレクトリに保存する。
 */

import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { WebContentsView } from 'electron';

/**
 * 左右ビューのスクリーンショットを同時に撮影し PNG ファイルとして保存する。
 * @param leftView - Expected 側ビュー
 * @param rightView - Actual 側ビュー
 * @param snapshotDir - スナップショットの保存先ディレクトリ
 * @param pageName - ページ名（ファイル名のプレフィックスに使用）
 * @returns 保存されたファイル名（例: "page_1234567890.png"）
 */
async function captureScreenshots(
  leftView: WebContentsView,
  rightView: WebContentsView,
  snapshotDir: string,
  pageName: string,
): Promise<string> {
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

export { captureScreenshots };
