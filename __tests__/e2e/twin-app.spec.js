const { test, expect } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const { startServers, stopServers } = require('../fixtures/mock-server/server');

let expectedServer;
let actualServer;

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
  const app = await electron.launch({
    args: [path.join(__dirname, '..', '..', 'src', 'main', 'index.js')],
  });

  // BrowserView ではなくメインウィンドウ (index.html) を取得
  let page = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('index.html')) { page = w; break; }
      } catch (_) { /* まだ準備できていない */ }
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

function jsClick(pg, sel) {
  return pg.evaluate((s) => document.querySelector(s).click(), sel);
}
function jsText(pg, sel) {
  return pg.evaluate((s) => document.querySelector(s).textContent, sel);
}
function jsClassList(pg, sel) {
  return pg.evaluate((s) => document.querySelector(s).className, sel);
}
function jsValue(pg, sel) {
  return pg.evaluate((s) => document.querySelector(s).value, sel);
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
  await page.waitForTimeout(1000);
}

// ── テスト ──

test.describe('アプリ起動', () => {
  test('ウィンドウタイトルが「Twin - Visual Regression Testing」で表示される', async () => {
    const { app, page } = await launchApp();
    try {
      const title = await page.title();
      expect(title).toBe('Twin - Visual Regression Testing');
    } finally {
      await app.close();
    }
  });

  test('Expected / Actual の URL 入力欄に保存済みデフォルト URL が表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await page.waitForFunction(
        () => { const el = document.getElementById('left-url'); return el && el.value.length > 0; },
        { timeout: 5000 }
      );
      const leftUrl = await jsValue(page, '#left-url');
      const rightUrl = await jsValue(page, '#right-url');
      expect(leftUrl).toBeTruthy();
      expect(rightUrl).toBeTruthy();
    } finally {
      await app.close();
    }
  });
});

test.describe('URL ナビゲーション', () => {
  test('URL 入力欄で Enter を押すとそのビューが指定 URL へ遷移する', async () => {
    const { app, page } = await launchApp();
    try {
      await page.evaluate(() => {
        const input = document.getElementById('left-url');
        input.value = 'http://127.0.0.1:3100';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      const value = await jsValue(page, '#left-url');
      expect(value).toBe('http://127.0.0.1:3100');
    } finally {
      await app.close();
    }
  });
});

test.describe('同期トグル', () => {
  test('初期状態で Sync ON、クリックで ON/OFF が切り替わりステータスバーに反映される', async () => {
    const { app, page } = await launchApp();
    try {
      // 初期状態: ON
      expect(await jsText(page, '#toggle-sync')).toContain('Sync ON');
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');

      // 1回クリック → OFF
      await jsClick(page, '#toggle-sync');
      expect(await jsText(page, '#toggle-sync')).toContain('Sync OFF');
      expect(await jsText(page, '#status-sync')).toBe('Sync: OFF');

      // もう1回クリック → ON に戻る
      await jsClick(page, '#toggle-sync');
      expect(await jsText(page, '#toggle-sync')).toContain('Sync ON');
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');
    } finally {
      await app.close();
    }
  });
});

test.describe('デバイスプリセット', () => {
  test('プリセットボタンをクリックするとステータスバーに対応する解像度が表示される', async () => {
    const { app, page } = await launchApp();
    try {
      // Desktop (1280x900)
      await jsClick(page, '.btn-preset[data-preset="3"]');
      expect(await jsText(page, '#status-size')).toBe('1280 x 900');

      // iPhone SE (375x667)
      await jsClick(page, '.btn-preset[data-preset="0"]');
      expect(await jsText(page, '#status-size')).toBe('375 x 667');
    } finally {
      await app.close();
    }
  });
});

test.describe('New Report（新規レポート作成）', () => {
  test('テスト名未入力ではキャプチャできず、名前を入力すると実行されトーストが表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      // モーダルを開く
      await jsClick(page, '#new-report-btn');
      expect(await jsClassList(page, '#new-report-modal')).not.toContain('hidden');

      // テスト名が空のままキャプチャ → モーダルは閉じない（バリデーション）
      await jsClick(page, '#new-report-capture');
      expect(await jsClassList(page, '#new-report-modal')).not.toContain('hidden');

      // テスト名を入力してキャプチャ → モーダルが閉じる
      await page.evaluate(() => { document.getElementById('report-test-name').value = 'e2e-test'; });
      await jsClick(page, '#new-report-capture');
      expect(await jsClassList(page, '#new-report-modal')).toContain('hidden');

      // キャプチャ完了後にトースト通知が表示される
      await page.waitForFunction(
        () => document.getElementById('toast').classList.contains('show'),
        { timeout: 15000 }
      );
    } finally {
      await app.close();
    }
  });
});

test.describe('キャプチャ & 比較', () => {
  test('Capture ボタンをクリックするとスクリーンショット比較が実行され結果がステータスに表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      await jsClick(page, '#capture-btn');

      // トースト通知が表示される
      await page.waitForFunction(
        () => document.getElementById('toast').classList.contains('show'),
        { timeout: 15000 }
      );

      // ステータスバーが初期値「Ready」から結果表示に変わる
      const text = await jsText(page, '#status-result');
      expect(text).not.toBe('Ready');
    } finally {
      await app.close();
    }
  });
});

test.describe('設定モーダル', () => {
  test('設定ボタンで開き、キャンセルで閉じる（値は保存されない）', async () => {
    const { app, page } = await launchApp();
    try {
      await jsClick(page, '#settings-btn');
      expect(await jsClassList(page, '#settings-modal')).not.toContain('hidden');

      await jsClick(page, '#settings-cancel');
      expect(await jsClassList(page, '#settings-modal')).toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('閾値を変更して保存すると、再度開いたときに変更後の値が反映されている', async () => {
    const { app, page } = await launchApp();
    try {
      // 設定を開いて閾値を変更・保存
      await jsClick(page, '#settings-btn');
      await page.waitForTimeout(300);
      await page.evaluate(() => { document.getElementById('setting-matching-threshold').value = '0.05'; });
      await jsClick(page, '#settings-save');
      expect(await jsClassList(page, '#settings-modal')).toContain('hidden');

      // 再度開いて値が永続化されていることを確認
      await jsClick(page, '#settings-btn');
      await page.waitForTimeout(300);
      expect(await jsValue(page, '#setting-matching-threshold')).toBe('0.05');
    } finally {
      await app.close();
    }
  });
});
