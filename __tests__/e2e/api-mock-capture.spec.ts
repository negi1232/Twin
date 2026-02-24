/**
 * API Mock Capture E2E Test
 *
 * API Captureボタンによる別ウィンドウの開閉・キャプチャ開始/停止・
 * XHR/Fetchキャプチャ・Clear・MSWバージョン選択の基本動作を検証する。
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';
import path from 'path';
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

async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const args = [path.join(__dirname, '..', '..', 'dist', 'main', 'index.js')];
  if (process.env.CI) {
    args.unshift('--no-sandbox');
  }
  const app = await electron.launch({ args });

  let page: Page | null = null;
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

  // initUIControls 完了を確認するため URL 値がセットされるまで待つ
  await page.waitForFunction(
    () => {
      const el = document.getElementById('left-url') as HTMLInputElement;
      return el && el.value && el.value.length > 0;
    },
    { timeout: 10000 },
  );
  return { app, page };
}

function jsClick(pg: Page, sel: string) {
  return pg.evaluate((s: string) => document.querySelector(s)!.click(), sel);
}
function jsText(pg: Page, sel: string) {
  return pg.evaluate((s: string) => document.querySelector(s)!.textContent, sel);
}

async function navigateToApiServers(page: Page) {
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
 * API Capture ボタンを押して API Mock ウィンドウを開く。
 */
async function openApiMockWindow(app: ElectronApplication, page: Page): Promise<Page> {
  const windowsBefore = app.windows().length;
  await jsClick(page, '#api-capture-btn');

  // 新しいウィンドウが開くのを待つ
  let apiPage: Page | null = null;
  for (let i = 0; i < 30; i++) {
    for (const w of app.windows()) {
      try {
        if (w.url().includes('api-mock-window')) {
          apiPage = w;
          break;
        }
      } catch (_) { /* loading */ }
    }
    if (apiPage) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!apiPage) throw new Error('API Mock window did not open');

  await apiPage.waitForFunction(
    () => document.getElementById('capture-btn') !== null,
    { timeout: 10000 },
  );
  return apiPage;
}

/**
 * 左ビュー (BrowserView) 上で JavaScript を実行するヘルパー。
 */
async function evalOnLeftView(app: ElectronApplication, script: string): Promise<any> {
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

test.describe('API Mock ウィンドウ', () => {
  test('API Capture ボタンをクリックすると API Mock ウィンドウが開く', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);
      const title = await apiPage.title();
      expect(title).toBe('API Mock Capture');
    } finally {
      await app.close();
    }
  });

  test('初期状態でステータスが Stopped、Start Capture ボタンが表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);
      const status = await jsText(apiPage, '#capture-status');
      expect(status).toBe('Stopped');
      const btnText = await jsText(apiPage, '#capture-btn');
      expect(btnText).toBe('Start Capture');
    } finally {
      await app.close();
    }
  });
});

test.describe('キャプチャ ON/OFF', () => {
  test('Start Capture でキャプチャが開始され、Stop Capture で停止される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);

      // Start Capture
      await jsClick(apiPage, '#capture-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('capture-status')!.textContent === 'Capturing...',
        { timeout: 5000 },
      );
      expect(await jsText(apiPage, '#capture-btn')).toBe('Stop Capture');

      // Stop Capture
      await jsClick(apiPage, '#capture-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('capture-status')!.textContent === 'Stopped',
        { timeout: 5000 },
      );
      expect(await jsText(apiPage, '#capture-btn')).toBe('Start Capture');
    } finally {
      await app.close();
    }
  });
});

test.describe('ステータスバー', () => {
  test('キャプチャ OFF 時はメインウィンドウに API: OFF と表示', async () => {
    const { app, page } = await launchApp();
    try {
      const text = await jsText(page, '#status-api-mock');
      expect(text).toBe('API: OFF');
    } finally {
      await app.close();
    }
  });
});

test.describe('API リクエストキャプチャ', () => {
  test('左ビューの Fetch リクエストがキャプチャされウィンドウに表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);

      // キャプチャ開始
      await jsClick(apiPage, '#capture-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('capture-status')!.textContent === 'Capturing...',
        { timeout: 5000 },
      );

      // 左ビューで API を呼び出す
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await apiPage.waitForFunction(
        () => parseInt(document.getElementById('request-count')!.textContent!) > 0,
        { timeout: 10000 },
      );

      const reqCount = await jsText(apiPage, '#request-count');
      expect(parseInt(reqCount!)).toBeGreaterThanOrEqual(1);
      const epCount = await jsText(apiPage, '#endpoint-count');
      expect(parseInt(epCount!)).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
    }
  });

  test('複数の異なるエンドポイントがキャプチャされる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);

      // キャプチャ開始
      await jsClick(apiPage, '#capture-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('capture-status')!.textContent === 'Capturing...',
        { timeout: 5000 },
      );

      // 複数の API を呼び出す
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await apiPage.waitForTimeout(1000);
      await evalOnLeftView(app, `document.getElementById('fetch-posts').click()`);
      await apiPage.waitForTimeout(1000);
      await evalOnLeftView(app, `document.getElementById('post-login').click()`);

      // 3 エンドポイントがキャプチャされるのを待つ
      await apiPage.waitForFunction(
        () => parseInt(document.getElementById('endpoint-count')!.textContent!) >= 3,
        { timeout: 10000 },
      );

      const reqCount = await jsText(apiPage, '#request-count');
      expect(parseInt(reqCount!)).toBeGreaterThanOrEqual(3);
      const epCount = await jsText(apiPage, '#endpoint-count');
      expect(parseInt(epCount!)).toBeGreaterThanOrEqual(3);
    } finally {
      await app.close();
    }
  });

  test('同じエンドポイントへの複数リクエストは1エンドポイントにまとまる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);

      // キャプチャ開始
      await jsClick(apiPage, '#capture-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('capture-status')!.textContent === 'Capturing...',
        { timeout: 5000 },
      );

      // 同じ API を2回呼び出す
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await apiPage.waitForTimeout(1000);
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);

      // 2リクエスト、1エンドポイント
      await apiPage.waitForFunction(
        () => parseInt(document.getElementById('request-count')!.textContent!) >= 2,
        { timeout: 10000 },
      );

      const reqCount = await jsText(apiPage, '#request-count');
      expect(parseInt(reqCount!)).toBeGreaterThanOrEqual(2);
      const epCount = await jsText(apiPage, '#endpoint-count');
      expect(parseInt(epCount!)).toBe(1);
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
      const apiPage = await openApiMockWindow(app, page);

      // キャプチャ開始 → API呼び出し
      await jsClick(apiPage, '#capture-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('capture-status')!.textContent === 'Capturing...',
        { timeout: 5000 },
      );
      await evalOnLeftView(app, `document.getElementById('fetch-users').click()`);
      await apiPage.waitForFunction(
        () => parseInt(document.getElementById('request-count')!.textContent!) > 0,
        { timeout: 10000 },
      );

      // Clear
      await jsClick(apiPage, '#clear-btn');
      await apiPage.waitForFunction(
        () => document.getElementById('request-count')!.textContent === '0',
        { timeout: 5000 },
      );

      expect(await jsText(apiPage, '#request-count')).toBe('0');
      expect(await jsText(apiPage, '#endpoint-count')).toBe('0');
    } finally {
      await app.close();
    }
  });
});

test.describe('MSW バージョン選択', () => {
  test('デフォルトは v2 が選択されている', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToApiServers(page);
      const apiPage = await openApiMockWindow(app, page);
      const value = await apiPage.evaluate(
        () => (document.getElementById('msw-version') as HTMLSelectElement).value,
      );
      expect(value).toBe('v2');
    } finally {
      await app.close();
    }
  });
});
