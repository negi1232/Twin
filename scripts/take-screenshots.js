/**
 * README用スクリーンショット自動撮影スクリプト
 *
 * Usage: node scripts/take-screenshots.js
 *
 * モックサーバーを起動し、Electronアプリの各状態をキャプチャして
 * docs/screenshots/ に保存します。
 */
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { startServers, stopServers } = require('../__tests__/fixtures/mock-server/server');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const MAIN_ENTRY = path.join(__dirname, '..', 'src', 'main', 'index.js');

// Swift で CGWindowID を取得して screencapture する
// ownerHint: ウィンドウオーナー名の一部 (例: "Electron")
// nameHint: ウィンドウ名の一部 (例: "Twin"), 空でも可
function captureWindowByOwner(ownerHint, nameHint, outputPath) {
  const tmpSwift = path.join(SCREENSHOT_DIR, '_find_window.swift');
  try {
    const swiftCode = [
      'import CoreGraphics',
      'import Foundation',
      'let windowList = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as! [[String: Any]]',
      '// 最大面積のウィンドウを選択 (メインウィンドウ)',
      'var bestId = -1',
      'var bestArea = 0',
      'for window in windowList {',
      '    let owner = window[kCGWindowOwnerName as String] as? String ?? ""',
      '    let name = window[kCGWindowName as String] as? String ?? ""',
      `    let ownerMatch = owner.contains("${ownerHint}")`,
      `    let nameMatch = "${nameHint}".isEmpty || name.contains("${nameHint}")`,
      '    if ownerMatch && nameMatch {',
      '        let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]',
      '        let w = bounds["Width"] as? Int ?? 0',
      '        let h = bounds["Height"] as? Int ?? 0',
      '        let area = w * h',
      '        if area > bestArea {',
      '            bestArea = area',
      '            bestId = window[kCGWindowNumber as String] as! Int',
      '        }',
      '    }',
      '}',
      'if bestId >= 0 { print(bestId) }',
      'else { exit(1) }',
    ].join('\n');
    fs.writeFileSync(tmpSwift, swiftCode);
    const windowId = execSync(`swift "${tmpSwift}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    }).trim();
    if (windowId && windowId !== '-1') {
      execSync(`screencapture -l ${windowId} -o "${outputPath}"`);
      return true;
    }
  } catch (e) {
    // swift/screencapture が使えない場合はフォールバック
  } finally {
    try { fs.unlinkSync(tmpSwift); } catch (_) {}
  }
  return false;
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function launchApp() {
  const app = await electron.launch({ args: [MAIN_ENTRY] });

  let page = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('index.html')) { page = w; break; }
      } catch (_) { /* not ready yet */ }
    }
    if (page) break;
    await sleep(500);
  }
  if (!page) page = await app.firstWindow();

  await page.waitForFunction(
    () => document.getElementById('left-url') !== null,
    { timeout: 10000 }
  );

  return { app, page };
}

function jsClick(pg, sel) {
  return pg.evaluate((s) => document.querySelector(s).click(), sel);
}

async function navigateToDemoServers(page) {
  await page.evaluate(() => {
    const left = document.getElementById('left-url');
    left.value = 'http://127.0.0.1:3100';
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const right = document.getElementById('right-url');
    right.value = 'http://127.0.0.1:3101';
    right.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await sleep(2000);
}

// screencapture でキャプチャ、失敗時は page.screenshot フォールバック
async function captureScreen(outputPath, page) {
  const ok = captureWindowByOwner('Electron', '', outputPath);
  if (ok) {
    console.log(`  -> ${path.basename(outputPath)} (screencapture)`);
    return true;
  }
  await page.screenshot({ path: outputPath });
  console.log(`  -> ${path.basename(outputPath)} (renderer fallback)`);
  return false;
}

async function main() {
  console.log('Starting mock servers...');
  const { expected, actual } = await startServers();

  console.log('Launching app...');
  const { app, page } = await launchApp();

  try {
    // Desktop プリセットに設定 (1280x900)
    await jsClick(page, '.btn-preset[data-preset="3"]');
    await sleep(500);

    // デモサーバーに接続
    console.log('Navigating to demo servers...');
    await navigateToDemoServers(page);

    // 1. メイン画面 (app-overview, main-window)
    console.log('Capturing: main window...');
    await sleep(1000);
    await captureScreen(path.join(SCREENSHOT_DIR, 'app-overview.png'), page);
    fs.copyFileSync(
      path.join(SCREENSHOT_DIR, 'app-overview.png'),
      path.join(SCREENSHOT_DIR, 'main-window.png')
    );
    console.log('  -> main-window.png (copy)');

    // 2. Capture 実行後
    console.log('Capturing: after capture...');
    await jsClick(page, '#capture-btn');
    await page.waitForFunction(
      () => document.getElementById('toast').classList.contains('show'),
      { timeout: 15000 }
    );
    await sleep(500);
    await captureScreen(path.join(SCREENSHOT_DIR, 'capture-result.png'), page);

    // トーストが消えるのを待つ
    await sleep(3000);

    // 3. サイドバーを開いた状態
    console.log('Capturing: sidebar...');
    await jsClick(page, '#toggle-sidebar');
    await sleep(500);
    await captureScreen(path.join(SCREENSHOT_DIR, 'sidebar.png'), page);
    await jsClick(page, '#toggle-sidebar');
    await sleep(300);

    // 4. 設定モーダル
    console.log('Capturing: settings modal...');
    await jsClick(page, '#settings-btn');
    await sleep(500);
    await captureScreen(path.join(SCREENSHOT_DIR, 'settings-modal.png'), page);
    await jsClick(page, '#settings-cancel');
    await sleep(300);

    // 5. New Report モーダル
    console.log('Capturing: new report modal...');
    await jsClick(page, '#new-report-btn');
    await sleep(500);
    await captureScreen(path.join(SCREENSHOT_DIR, 'new-report-modal.png'), page);
    await jsClick(page, '#new-report-cancel');
    await sleep(300);

    // 6. レポート画面
    console.log('Capturing: report...');
    await jsClick(page, '#report-btn');
    await sleep(2000);

    // レポートウィンドウを探す
    let reportCaptured = false;
    const reportCapturedByScreencapture = captureWindowByOwner('Electron', 'reg', path.join(SCREENSHOT_DIR, 'report.png'));
    if (reportCapturedByScreencapture) {
      console.log('  -> report.png (screencapture)');
      reportCaptured = true;
    }

    if (!reportCaptured) {
      for (const w of app.windows()) {
        try {
          const url = w.url();
          if (url.includes('report.html') || (url.includes('file://') && !url.includes('index.html'))) {
            await w.screenshot({ path: path.join(SCREENSHOT_DIR, 'report.png') });
            reportCaptured = true;
            console.log('  -> report.png (report window)');
            break;
          }
        } catch (_) { /* skip */ }
      }
    }

    if (!reportCaptured) {
      console.log('  -> report.png SKIPPED (no report window found)');
    }

    console.log('\nDone! Screenshots saved to docs/screenshots/');

  } finally {
    await app.close();
    await stopServers(expected, actual);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
