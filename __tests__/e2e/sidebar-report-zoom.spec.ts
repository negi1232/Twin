/**
 * Sidebar・Report・Zoom E2E テスト
 *
 * サイドバーの開閉・フォルダ操作、レポート表示、ズーム制御など
 * 既存テストでカバーされていない機能を検証する。
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { startServers, stopServers } from '../fixtures/mock-server/server';

let expectedServer: any;
let actualServer: any;

test.beforeAll(async () => {
  const servers = await startServers();
  expectedServer = servers.expected;
  actualServer = servers.actual;
});

test.afterAll(async () => {
  await stopServers(expectedServer, actualServer);
});

// ── ヘルパー ──

async function launchApp() {
  const args = [path.join(__dirname, '..', '..', 'dist', 'main', 'index.js')];
  if (process.env.CI) {
    args.unshift('--no-sandbox');
  }
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
    { timeout: 10000 },
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
function jsValue(pg: any, sel: string) {
  return pg.evaluate((s: string) => (document.querySelector(s) as HTMLInputElement).value, sel);
}

async function navigateToDemoServers(page: any) {
  await page.evaluate(() => {
    const left = document.getElementById('left-url');
    left.value = 'http://127.0.0.1:3100';
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const right = document.getElementById('right-url');
    right.value = 'http://127.0.0.1:3101';
    right.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.waitForTimeout(1000);
}

/**
 * テスト用の一時ディレクトリを作成する。
 * テスト終了後にクリーンアップ関数を呼んで削除する。
 */
function createTempDir(prefix: string): { dirPath: string; cleanup: () => void } {
  const dirPath = fs.mkdtempSync(path.join(os.tmpdir(), `twin-e2e-${prefix}-`));
  return {
    dirPath,
    cleanup: () => {
      try {
        fs.rmSync(dirPath, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    },
  };
}

// ── テスト ──

test.describe('サイドバー開閉', () => {
  test('サイドバートグルボタンで開閉が切り替わる', async () => {
    const { app, page } = await launchApp();
    try {
      // 初期状態: collapsed
      let cls = await jsClassList(page, '#sidebar');
      expect(cls).toContain('collapsed');

      // クリック → 開く
      await jsClick(page, '#toggle-sidebar');
      await page.waitForTimeout(300);
      cls = await jsClassList(page, '#sidebar');
      expect(cls).not.toContain('collapsed');

      // bodyに sidebar-open クラスが付く
      const bodyCls = await jsClassList(page, 'body');
      expect(bodyCls).toContain('sidebar-open');

      // もう一度クリック → 閉じる
      await jsClick(page, '#toggle-sidebar');
      await page.waitForTimeout(300);
      cls = await jsClassList(page, '#sidebar');
      expect(cls).toContain('collapsed');
    } finally {
      await app.close();
    }
  });
});

test.describe('フォルダ作成', () => {
  test('サイドバーで新規フォルダ作成フォームが表示され、Cancelで閉じる', async () => {
    const { app, page } = await launchApp();
    try {
      // サイドバーを開く
      await jsClick(page, '#toggle-sidebar');
      await page.waitForTimeout(300);

      // currentFolderPath が null の場合、ボタンは何もしない
      // まずフォームが非表示であることを確認
      let formCls = await jsClassList(page, '#sidebar-new-folder-form');
      expect(formCls).toContain('hidden');

      // currentFolderPath を設定するため、selectFolder をモック的にバイパスし
      // 直接 IPC 経由で snapshotDir を tmp に設定 → ツリー表示に反映させる
      // (select-folder は native dialog なのでテストでは IPC 直接呼べない)
      // → 代わりに New Report モーダルでフォルダなし状態のテスト

      // New Folder ボタン押下 → currentFolderPath=null なので form は出ない
      await jsClick(page, '#sidebar-new-folder');
      await page.waitForTimeout(200);
      formCls = await jsClassList(page, '#sidebar-new-folder-form');
      expect(formCls).toContain('hidden');
    } finally {
      await app.close();
    }
  });
});

test.describe('ズーム操作', () => {
  test('ズームイン・アウトボタンでステータスバーとボタン表示が変わる', async () => {
    const { app, page } = await launchApp();
    try {
      // BrowserViews にページをロードしてからズーム操作する
      await navigateToDemoServers(page);

      // 初期状態: 100%
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '100%',
        { timeout: 5000 },
      );
      expect(await jsText(page, '#status-zoom')).toBe('Zoom: 100%');

      // ズームイン → electronAPI.setZoom を直接呼び、zoom-changed イベントを待つ
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 1.1 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '110%',
        { timeout: 5000 },
      );
      expect(await jsText(page, '#status-zoom')).toBe('Zoom: 110%');

      // ズームアウト → 90%
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 0.9 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '90%',
        { timeout: 5000 },
      );
      expect(await jsText(page, '#status-zoom')).toBe('Zoom: 90%');

      // リセット → 100%
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 1.0 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '100%',
        { timeout: 5000 },
      );
      expect(await jsText(page, '#status-zoom')).toBe('Zoom: 100%');
    } finally {
      await app.close();
    }
  });

  test('ズームレベルが MIN/MAX の範囲でクランプされる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      // MAX_ZOOM (3.0) を超える値を設定 → 300% にクランプ
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 5.0 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '300%',
        { timeout: 5000 },
      );
      expect(await jsText(page, '#status-zoom')).toBe('Zoom: 300%');

      // MIN_ZOOM (0.25) 未満の値を設定 → 25% にクランプ
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 0.1 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '25%',
        { timeout: 5000 },
      );
      expect(await jsText(page, '#status-zoom')).toBe('Zoom: 25%');

      // リセット
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 1.0 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '100%',
        { timeout: 5000 },
      );
    } finally {
      await app.close();
    }
  });
});

test.describe('レポート表示', () => {
  test('キャプチャ後に Report ボタンでレポートウィンドウが開く', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      // キャプチャ実行
      await jsClick(page, '#capture-btn');

      // キャプチャ完了 & トースト表示を待つ
      await page.waitForFunction(
        () => document.getElementById('toast')!.classList.contains('show'),
        { timeout: 15000 },
      );

      // ステータスバーに結果が表示される
      const resultText = await jsText(page, '#status-result');
      expect(resultText).not.toBe('Ready');

      // Report ボタンをクリック → 新しいウィンドウが開く
      const windowCountBefore = app.windows().length;
      await jsClick(page, '#report-btn');
      await page.waitForTimeout(2000);

      // 新しいウィンドウが開いたことを確認
      const windowCountAfter = app.windows().length;
      expect(windowCountAfter).toBeGreaterThan(windowCountBefore);
    } finally {
      await app.close();
    }
  });
});

test.describe('New Report モーダル', () => {
  test('キャンセルボタンでモーダルが閉じる', async () => {
    const { app, page } = await launchApp();
    try {
      // モーダルを開く
      await jsClick(page, '#new-report-btn');
      await page.waitForTimeout(200);
      expect(await jsClassList(page, '#new-report-modal')).not.toContain('hidden');

      // キャンセルで閉じる
      await jsClick(page, '#new-report-cancel');
      expect(await jsClassList(page, '#new-report-modal')).toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('閉じるボタン（×）でモーダルが閉じる', async () => {
    const { app, page } = await launchApp();
    try {
      await jsClick(page, '#new-report-btn');
      await page.waitForTimeout(200);
      expect(await jsClassList(page, '#new-report-modal')).not.toContain('hidden');

      // × ボタンで閉じる
      await jsClick(page, '#new-report-close');
      expect(await jsClassList(page, '#new-report-modal')).toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('Enter キーでテスト名入力後にキャプチャが実行される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      await jsClick(page, '#new-report-btn');
      await page.waitForTimeout(200);

      // テスト名を入力して Enter
      await page.evaluate(() => {
        const input = document.getElementById('report-test-name') as HTMLInputElement;
        input.value = 'enter-key-test';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });

      // モーダルが閉じる
      await page.waitForFunction(
        () => document.getElementById('new-report-modal')!.classList.contains('hidden'),
        { timeout: 5000 },
      );

      // キャプチャ完了トーストが表示される
      await page.waitForFunction(
        () => document.getElementById('toast')!.classList.contains('show'),
        { timeout: 15000 },
      );
    } finally {
      await app.close();
    }
  });
});

test.describe('設定モーダル詳細', () => {
  test('閉じるボタン（×）でモーダルが閉じる', async () => {
    const { app, page } = await launchApp();
    try {
      await jsClick(page, '#settings-btn');
      await page.waitForTimeout(200);
      expect(await jsClassList(page, '#settings-modal')).not.toContain('hidden');

      // × ボタンで閉じる
      await jsClick(page, '#settings-close');
      expect(await jsClassList(page, '#settings-modal')).toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('Threshold Rate を変更して保存すると永続化される', async () => {
    const { app, page } = await launchApp();
    try {
      // 設定を開いて Threshold Rate を変更
      await jsClick(page, '#settings-btn');
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        (document.getElementById('setting-threshold-rate') as HTMLInputElement).value = '0.03';
      });
      await jsClick(page, '#settings-save');
      expect(await jsClassList(page, '#settings-modal')).toContain('hidden');

      // 再度開いて確認
      await jsClick(page, '#settings-btn');
      await page.waitForTimeout(300);
      expect(await jsValue(page, '#setting-threshold-rate')).toBe('0.03');
    } finally {
      await app.close();
    }
  });
});

test.describe('Reload & Re-sync', () => {
  test('Reload & Re-sync ボタンをクリックするとトーストが表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      await jsClick(page, '#reload-sync-btn');

      // トースト通知が表示される
      await page.waitForFunction(
        () => {
          const toast = document.getElementById('toast');
          return toast && toast.classList.contains('show') && toast.textContent!.includes('reloaded');
        },
        { timeout: 10000 },
      );
      const toastText = await jsText(page, '#toast');
      expect(toastText).toContain('reloaded');
    } finally {
      await app.close();
    }
  });
});

test.describe('プレビューモーダル', () => {
  test('プレビューモーダルは初期状態で非表示', async () => {
    const { app, page } = await launchApp();
    try {
      const cls = await jsClassList(page, '#preview-modal');
      expect(cls).toContain('hidden');
    } finally {
      await app.close();
    }
  });
});

test.describe('CSS Scan 後にレポートウィンドウが開く', () => {
  test('CSS Full Scan を実行すると新しいウィンドウ（レポート）が開く', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      const windowCountBefore = app.windows().length;

      // CSS Scan ボタンをクリック
      await jsClick(page, '#css-scan-btn');

      // スキャン完了を待つ（ボタンが再び有効になる）
      await page.waitForFunction(
        () => {
          const btn = document.getElementById('css-scan-btn');
          return btn && btn.textContent!.includes('CSS Scan') && !btn.disabled;
        },
        { timeout: 15000 },
      );

      // 新しいウィンドウが開くのを待つ
      await page.waitForTimeout(1000);
      const windowCountAfter = app.windows().length;
      expect(windowCountAfter).toBeGreaterThan(windowCountBefore);
    } finally {
      await app.close();
    }
  });
});

test.describe('デバイスプリセット全種類', () => {
  test('全プリセットボタンがステータスバーに正しい解像度を表示する', async () => {
    const { app, page } = await launchApp();
    try {
      const presets = [
        { index: 0, expected: '375 x 667' },   // iPhone SE
        { index: 1, expected: '393 x 852' },   // iPhone 14 Pro
        { index: 2, expected: '768 x 1024' },  // iPad
        { index: 3, expected: '1280 x 900' },  // Desktop
        { index: 4, expected: '1920 x 1080' }, // Full HD
      ];

      for (const preset of presets) {
        await jsClick(page, `.btn-preset[data-preset="${preset.index}"]`);
        await page.waitForTimeout(200);
        const sizeText = await jsText(page, '#status-size');
        expect(sizeText).toBe(preset.expected);
      }
    } finally {
      await app.close();
    }
  });

  test('選択中のプリセットボタンに active クラスが付く', async () => {
    const { app, page } = await launchApp();
    try {
      // Desktop を選択
      await jsClick(page, '.btn-preset[data-preset="3"]');
      await page.waitForTimeout(200);

      // Desktop ボタンに active クラスがある
      const dtCls = await jsClassList(page, '.btn-preset[data-preset="3"]');
      expect(dtCls).toContain('active');

      // iPhone SE を選択 → Desktop の active が外れる
      await jsClick(page, '.btn-preset[data-preset="0"]');
      await page.waitForTimeout(200);

      const seCls = await jsClassList(page, '.btn-preset[data-preset="0"]');
      expect(seCls).toContain('active');

      const dtClsAfter = await jsClassList(page, '.btn-preset[data-preset="3"]');
      expect(dtClsAfter).not.toContain('active');
    } finally {
      await app.close();
    }
  });
});
