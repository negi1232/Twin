/**
 * Twin デモ動画シナリオ
 *
 * Playwright のビデオ録画機能で全機能をウォークスルーするデモ動画を生成する。
 * 実行: npx playwright test demo-scenario
 * 出力: test-results/ ディレクトリに .webm 動画が保存される
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import { startDemoServers, stopServers } from '../fixtures/mock-server/server';

// デモ動画のテンポ調整用
const SCENE_PAUSE = 2000;   // シーン間の間
const ACTION_PAUSE = 800;   // アクション間の間
const QUICK_PAUSE = 400;    // 素早い操作の間

let demoExpectedServer: any;
let demoActualServer: any;

test.beforeAll(async () => {
  const servers = await startDemoServers();
  demoExpectedServer = servers.expected;
  demoActualServer = servers.actual;
});

test.afterAll(async () => {
  await stopServers(demoExpectedServer, demoActualServer);
});

// ── ヘルパー ──

async function launchApp() {
  const args = [
    '--no-sandbox',
    '--disable-gpu',
    '--disable-software-rasterizer',
    path.join(__dirname, '..', '..', 'src', 'main', 'index.js'),
  ];
  const app = await electron.launch({ args });

  let page: any = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('index.html')) { page = w; break; }
      } catch (_) { /* loading */ }
    }
    if (page) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!page) page = await app.firstWindow();

  await page.waitForFunction(
    () => document.getElementById('left-url') !== null,
    { timeout: 10000 }
  );
  return { app, page };
}

function jsClick(pg: any, sel: string) {
  return pg.evaluate((s: string) => document.querySelector(s)!.click(), sel);
}
function jsText(pg: any, sel: string) {
  return pg.evaluate((s: string) => document.querySelector(s)!.textContent, sel);
}
function jsClassList(pg: any, sel: string) {
  return pg.evaluate((s: string) => (document.querySelector(s) as HTMLElement).className, sel);
}

async function navigateToDemo(page: any) {
  await page.evaluate(() => {
    const left = document.getElementById('left-url');
    left.value = 'http://127.0.0.1:3200';
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.waitForTimeout(ACTION_PAUSE);
  await page.evaluate(() => {
    const right = document.getElementById('right-url');
    right.value = 'http://127.0.0.1:3201';
    right.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.waitForTimeout(1500); // ページ読み込み待ち
}

// ── デモシナリオ ──

test.describe('Twin デモ動画', () => {
  test('全機能ウォークスルー', async () => {
    test.setTimeout(120000); // 2分タイムアウト

    const { app, page } = await launchApp();
    try {

      // ============================
      // Scene 1: アプリ起動・初期画面
      // ============================
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 2: URL ナビゲーション
      // ============================
      await navigateToDemo(page);
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 3: デバイスプリセット切り替え
      // ============================

      // iPhone SE
      await jsClick(page, '.btn-preset[data-preset="0"]');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsText(page, '#status-size')).toBe('375 x 667');

      // iPad
      await jsClick(page, '.btn-preset[data-preset="2"]');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsText(page, '#status-size')).toBe('768 x 1024');

      // Desktop
      await jsClick(page, '.btn-preset[data-preset="3"]');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsText(page, '#status-size')).toBe('1280 x 900');

      // Full HD
      await jsClick(page, '.btn-preset[data-preset="4"]');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsText(page, '#status-size')).toBe('1920 x 1080');

      // Desktop に戻す（見やすいサイズ）
      await jsClick(page, '.btn-preset[data-preset="3"]');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 4: ズーム操作
      // ============================

      // ズームアウト 2回
      await jsClick(page, '#zoom-out-btn');
      await page.waitForTimeout(QUICK_PAUSE);
      await jsClick(page, '#zoom-out-btn');
      await page.waitForTimeout(ACTION_PAUSE);

      // ズームイン 2回（元に戻す）
      await jsClick(page, '#zoom-in-btn');
      await page.waitForTimeout(QUICK_PAUSE);
      await jsClick(page, '#zoom-in-btn');
      await page.waitForTimeout(ACTION_PAUSE);

      // リセット
      await jsClick(page, '#zoom-level-btn');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 5: 同期 ON/OFF
      // ============================
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');

      // OFF に切り替え
      await jsClick(page, '#toggle-sync');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsText(page, '#status-sync')).toBe('Sync: OFF');

      // ON に戻す
      await jsClick(page, '#toggle-sync');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 6: 設定モーダル
      // ============================
      await jsClick(page, '#settings-btn');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsClassList(page, '#settings-modal')).not.toContain('hidden');

      // 閾値を変更
      await page.evaluate(() => {
        document.getElementById('setting-matching-threshold').value = '0.05';
        document.getElementById('setting-threshold-rate').value = '0.01';
      });
      await page.waitForTimeout(ACTION_PAUSE);

      // 保存して閉じる
      await jsClick(page, '#settings-save');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsClassList(page, '#settings-modal')).toContain('hidden');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 7: 新規レポート作成 & キャプチャ
      // ============================
      await jsClick(page, '#new-report-btn');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsClassList(page, '#new-report-modal')).not.toContain('hidden');

      // テスト名を入力
      await page.evaluate(() => {
        document.getElementById('report-test-name').value = 'demo-landing-page';
      });
      await page.waitForTimeout(ACTION_PAUSE);

      // キャプチャ実行
      await jsClick(page, '#new-report-capture');

      // モーダルが閉じるのを待つ
      await page.waitForFunction(
        () => document.getElementById('new-report-modal').classList.contains('hidden'),
        { timeout: 15000 }
      );

      // トースト通知が表示される
      await page.waitForFunction(
        () => document.getElementById('toast').classList.contains('show'),
        { timeout: 15000 }
      );
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 8: クイックキャプチャ
      // ============================
      await jsClick(page, '#capture-btn');

      // トースト通知
      await page.waitForFunction(
        () => document.getElementById('toast').classList.contains('show'),
        { timeout: 15000 }
      );

      // ステータスバーに結果が表示される
      const resultText = await jsText(page, '#status-result');
      expect(resultText).not.toBe('Ready');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 9: CSS Full Scan
      // ============================
      await jsClick(page, '#css-scan-btn');
      await page.waitForTimeout(3000); // スキャン完了を待つ

      // 新しいウィンドウ（レポート）が開かれるのを確認
      const windows = app.windows();
      // レポートウィンドウが開いていれば少し表示
      if (windows.length > 1) {
        await page.waitForTimeout(SCENE_PAUSE);
      }
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 10: CSS Inspect Mode
      // ============================
      await jsClick(page, '#css-inspect-btn');
      await page.waitForTimeout(ACTION_PAUSE);

      // インスペクトドロワーが表示される
      await page.waitForFunction(
        () => !document.getElementById('css-inspect-drawer').classList.contains('hidden'),
        { timeout: 5000 }
      ).catch(() => { /* ドロワーが出ない場合も続行 */ });
      await page.waitForTimeout(SCENE_PAUSE);

      // インスペクトモード OFF
      await jsClick(page, '#css-inspect-btn');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 11: サイドバー
      // ============================
      await jsClick(page, '#toggle-sidebar');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsClassList(page, '#sidebar')).not.toContain('collapsed');
      await page.waitForTimeout(SCENE_PAUSE);

      // サイドバーを閉じる
      await jsClick(page, '#toggle-sidebar');
      await page.waitForTimeout(ACTION_PAUSE);
      expect(await jsClassList(page, '#sidebar')).toContain('collapsed');
      await page.waitForTimeout(SCENE_PAUSE);

      // ============================
      // Scene 12: エンディング
      // ============================
      await page.waitForTimeout(SCENE_PAUSE);

    } finally {
      await app.close();
    }
  });
});
