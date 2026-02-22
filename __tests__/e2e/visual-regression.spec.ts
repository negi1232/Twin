/**
 * Visual Regression E2E Tests
 *
 * Playwright toHaveScreenshot() を使って UI の見た目の変化を検出する。
 * 初回実行時にベースラインスクリーンショットが生成され、
 * 以降の実行で差分が検出されるとテストが失敗する。
 *
 * ベースライン更新: npx playwright test visual-regression --update-snapshots
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
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

  // DOM 要素の存在 + スクリプト初期化完了を待つ
  // initUIControls() が完了すると Sync ボタンに "Sync" テキストが設定される
  await page.waitForFunction(
    () => {
      const syncBtn = document.getElementById('toggle-sync');
      return syncBtn && syncBtn.textContent && syncBtn.textContent.includes('Sync');
    },
    { timeout: 15000 },
  );
  // initUIControls() / initCssCompare() 完了を待つための追加ウェイト
  await page.waitForTimeout(500);
  return { app, page };
}

/** URL 入力欄をクリアして環境依存を排除する */
function clearUrlInputs(page: any) {
  return page.evaluate(() => {
    (document.getElementById('left-url') as HTMLInputElement).value = '';
    (document.getElementById('right-url') as HTMLInputElement).value = '';
  });
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
 * DOM 上でクリックをディスパッチし、状態変化の安定化を待つ。
 * element.click() は intermittent に失敗するため MouseEvent を使用。
 */
async function clickAndWait(page: any, selector: string, waitMs = 500) {
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel);
    if (el) el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, selector);
  await page.waitForTimeout(waitMs);
}

// ── Visual Regression テスト ──

test.describe('初期表示', () => {
  test('アプリ起動直後の全体レイアウト', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      await expect(page).toHaveScreenshot('initial-layout.png', {
        fullPage: true,
      });
    } finally {
      await app.close();
    }
  });

  test('ツールバー部分のレイアウト', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      await expect(page.locator('#toolbar')).toHaveScreenshot('toolbar-layout.png');
    } finally {
      await app.close();
    }
  });

  test('ステータスバー部分のレイアウト', async () => {
    const { app, page } = await launchApp();
    try {
      await expect(page.locator('#status-bar')).toHaveScreenshot('statusbar-layout.png');
    } finally {
      await app.close();
    }
  });
});

test.describe('サイドバー', () => {
  test('サイドバー開いた状態の全体レイアウト', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      await clickAndWait(page, '#toggle-sidebar');
      await expect(page).toHaveScreenshot('layout-with-sidebar.png', {
        fullPage: true,
      });
    } finally {
      await app.close();
    }
  });
});

test.describe('モーダル', () => {
  test('設定モーダルの表示', async () => {
    const { app, page } = await launchApp();
    try {
      await clickAndWait(page, '#settings-btn');
      await expect(page).toHaveScreenshot('settings-modal-open.png', {
        fullPage: true,
      });
    } finally {
      await app.close();
    }
  });

  test('New Report モーダルの表示', async () => {
    const { app, page } = await launchApp();
    try {
      await clickAndWait(page, '#new-report-btn');
      await expect(page).toHaveScreenshot('new-report-modal-open.png', {
        fullPage: true,
      });
    } finally {
      await app.close();
    }
  });
});

test.describe('Sync トグル', () => {
  test('Sync ON 状態のツールバー', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      await expect(page.locator('#toolbar')).toHaveScreenshot('toolbar-sync-on.png');
    } finally {
      await app.close();
    }
  });

  test('Sync OFF 状態のツールバー', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      await clickAndWait(page, '#toggle-sync');
      await expect(page.locator('#toolbar')).toHaveScreenshot('toolbar-sync-off.png');
    } finally {
      await app.close();
    }
  });

  test('Sync OFF 時のステータスバー', async () => {
    const { app, page } = await launchApp();
    try {
      await clickAndWait(page, '#toggle-sync');
      await expect(page.locator('#status-bar')).toHaveScreenshot('statusbar-sync-off.png');
    } finally {
      await app.close();
    }
  });
});

test.describe('ズーム表示', () => {
  test('ズーム 110% のステータスバー', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 1.1 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '110%',
        { timeout: 10000 },
      );
      await expect(page.locator('#status-bar')).toHaveScreenshot('statusbar-zoom-110.png');
    } finally {
      await app.close();
    }
  });

  test('ズーム 50% のズームコントロール', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);
      await page.evaluate(() => window.electronAPI.setZoom({ zoom: 0.5 }));
      await page.waitForFunction(
        () => document.getElementById('zoom-level-btn')!.textContent === '50%',
        { timeout: 10000 },
      );
      await expect(page.locator('.zoom-controls')).toHaveScreenshot('zoom-controls-50pct.png');
    } finally {
      await app.close();
    }
  });
});

test.describe('CSS Inspect モード', () => {
  test('Inspect ON 時のツールバー', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      await clickAndWait(page, '#css-inspect-btn');
      await expect(page.locator('#toolbar')).toHaveScreenshot('toolbar-inspect-on.png');
    } finally {
      await app.close();
    }
  });

  test('Inspect ドロワーが表示された全体レイアウト', async () => {
    const { app, page } = await launchApp();
    try {
      await clearUrlInputs(page);
      // ドロワーの hidden クラスを除去してレイアウトを検証
      await page.evaluate(() => {
        document.getElementById('css-inspect-drawer')!.classList.remove('hidden');
      });
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('layout-inspect-drawer.png', {
        fullPage: true,
      });
    } finally {
      await app.close();
    }
  });
});

test.describe('トースト通知', () => {
  test('Reload & Re-sync 後のトースト表示', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);
      await clearUrlInputs(page);
      await clickAndWait(page, '#reload-sync-btn', 300);
      await page.waitForFunction(
        () => {
          const toast = document.getElementById('toast');
          return toast && toast.classList.contains('show');
        },
        { timeout: 15000 },
      );
      await expect(page).toHaveScreenshot('toast-reload-sync.png', {
        fullPage: true,
      });
    } finally {
      await app.close();
    }
  });
});
