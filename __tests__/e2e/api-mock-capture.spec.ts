/**
 * API Mock Capture E2E Test
 *
 * API Captureボタン・ドロワー表示・XHR/Fetchキャプチャ・Export の基本動作を検証する。
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { startApiMockServers, stopServers } from '../fixtures/mock-server/server';

let expectedServer: any;
let actualServer: any;

test.beforeAll(async () => {
  const servers = await startApiMockServers();
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
    () => document.getElementById('api-capture-btn') !== null,
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

async function navigateToApiServers(page: any) {
  await page.evaluate(() => {
    const left = document.getElementById('left-url') as HTMLInputElement;
    left.value = 'http://127.0.0.1:3400';
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const right = document.getElementById('right-url') as HTMLInputElement;
    right.value = 'http://127.0.0.1:3401';
    right.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.waitForTimeout(2000);
}

/**
 * 左ビュー (BrowserView) 上で JavaScript を実行するヘルパー。
 * BrowserView は page.evaluate では操作できないため、
 * Electron の webContents API 経由で実行する。
 */
async function evalOnLeftView(app: any, script: string): Promise<any> {
  return app.evaluate(async ({ webContents: wcModule }: any, js: string) => {
    const allWc = wcModule.getAllWebContents();
    for (const wc of allWc) {
      if (wc.getURL().includes('127.0.0.1:3400')) {
        return wc.executeJavaScript(js);
      }
    }
    return null;
  }, script);
}

// ── テスト ──

test.describe('API Capture ボタン', () => {
  test('初期状態で API Capture ボタンが表示される', async () => {
    const { app, page } = await launchApp();
    try {
      const text = await jsText(page, '#api-capture-btn');
      expect(text).toContain('API Capture');
    } finally {
      await app.close();
    }
  });

  test('クリックするとキャプチャ ON/OFF が切り替わる', async () => {
    const { app, page } = await launchApp();
    try {
      // ページを読み込んでからキャプチャ（デバッガが接続される必要あり）
      await navigateToApiServers(page);

      // 初期状態: OFF
      let text = await jsText(page, '#api-capture-btn');
      expect(text).toContain('API Capture');
      expect(text).not.toContain('Capturing');

      // クリック → ON
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);
      text = await jsText(page, '#api-capture-btn');
      expect(text).toContain('Capturing');

      let cls = await jsClassList(page, '#api-capture-btn');
      expect(cls).toContain('api-capture-active');

      // クリック → OFF
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);
      text = await jsText(page, '#api-capture-btn');
      expect(text).not.toContain('Capturing');

      cls = await jsClassList(page, '#api-capture-btn');
      expect(cls).not.toContain('api-capture-active');
    } finally {
      await app.close();
    }
  });
});

test.describe('API Mock Capture ドロワー', () => {
  test('初期状態でドロワーは非表示', async () => {
    const { app, page } = await launchApp();
    try {
      const cls = await jsClassList(page, '#api-mock-drawer');
      expect(cls).toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('キャプチャ開始でドロワーが表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);
      const cls = await jsClassList(page, '#api-mock-drawer');
      expect(cls).not.toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('×ボタンでドロワーが閉じる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);

      // ドロワーが開いていることを確認
      let cls = await jsClassList(page, '#api-mock-drawer');
      expect(cls).not.toContain('hidden');

      await jsClick(page, '#api-mock-drawer-close');
      await page.waitForTimeout(300);
      cls = await jsClassList(page, '#api-mock-drawer');
      expect(cls).toContain('hidden');
    } finally {
      await app.close();
    }
  });
});

test.describe('ステータスバー', () => {
  test('キャプチャ OFF 時は API: OFF と表示', async () => {
    const { app, page } = await launchApp();
    try {
      const text = await jsText(page, '#status-api-mock');
      expect(text).toBe('API: OFF');
    } finally {
      await app.close();
    }
  });

  test('キャプチャ ON 時は API: ON と表示', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);
      const text = await jsText(page, '#status-api-mock');
      expect(text).toBe('API: ON');
    } finally {
      await app.close();
    }
  });
});

test.describe('API リクエストキャプチャ', () => {
  test('左ビューの Fetch リクエストがキャプチャされドロワーに表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);

      // キャプチャ開始
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);

      // 左ビューで API を呼び出す
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await page.waitForTimeout(1500);

      // ドロワーヘッダーにリクエスト数が表示される
      const headerText = await jsText(page, '#api-mock-header-info');
      expect(headerText).toContain('request');
      expect(headerText).toContain('endpoint');
    } finally {
      await app.close();
    }
  });

  test('複数の異なるエンドポイントがキャプチャされる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);

      // キャプチャ開始
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);

      // 複数の API を呼び出す
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await page.waitForTimeout(1000);
      await evalOnLeftView(app, `document.getElementById('fetch-posts').click()`);
      await page.waitForTimeout(1000);
      await evalOnLeftView(app, `document.getElementById('post-login').click()`);
      await page.waitForTimeout(1500);

      // ヘッダーに複数エンドポイントが報告される
      const headerText = await jsText(page, '#api-mock-header-info');
      expect(headerText).toContain('3 request');
      expect(headerText).toContain('3 endpoint');
    } finally {
      await app.close();
    }
  });

  test('同じエンドポイントへの複数リクエストは1グループにまとまる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);

      // キャプチャ開始
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);

      // 同じ API を2回呼び出す
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await page.waitForTimeout(1000);
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await page.waitForTimeout(1500);

      // 2リクエスト、1エンドポイント
      const headerText = await jsText(page, '#api-mock-header-info');
      expect(headerText).toContain('2 request');
      expect(headerText).toContain('1 endpoint');
    } finally {
      await app.close();
    }
  });
});

test.describe('Clear', () => {
  test('Clear ボタンでキャプチャデータがクリアされる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);

      // キャプチャ開始 → API呼び出し
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(500);
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await page.waitForTimeout(1500);

      // データがキャプチャされたことを確認
      let headerText = await jsText(page, '#api-mock-header-info');
      expect(headerText).toContain('request');

      // Clear
      await jsClick(page, '#api-mock-clear-btn');
      await page.waitForTimeout(500);

      headerText = await jsText(page, '#api-mock-header-info');
      expect(headerText).toContain('0 requests');
    } finally {
      await app.close();
    }
  });
});

test.describe('MSW バージョン選択', () => {
  test('デフォルトは v2 が選択されている', async () => {
    const { app, page } = await launchApp();
    try {
      // ドロワーを開く
      await jsClick(page, '#api-capture-btn');
      await page.waitForTimeout(300);

      const value = await page.evaluate(
        () => (document.getElementById('api-mock-msw-version') as HTMLSelectElement).value,
      );
      expect(value).toBe('v2');
    } finally {
      await app.close();
    }
  });
});
