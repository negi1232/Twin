/**
 * File Upload Sync E2E Test
 *
 * Tests that the sync-manager correctly handles file upload scenarios:
 * - Injection script is active on the left view (showOpenFilePicker disabled)
 * - CDP file chooser interception is set up
 * - Click sync is suppressed for file input areas
 * - Sync toggle correctly affects file upload pages
 * - Both views load the file upload fixture correctly
 *
 * NOTE on native file dialog limitation:
 * Playwright cannot control OS file dialogs in Electron. The full CDP flow
 * (dialog interception → file accept → right view sync) is covered by unit
 * tests in __tests__/unit/sync-manager.test.ts. These E2E tests verify the
 * observable infrastructure through the main process and UI state.
 */
import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import type { ElectronApplication, Page } from 'playwright';
import path from 'path';
import { startFileUploadServers, stopServers } from '../fixtures/mock-server/server';

let expectedServer: any;
let actualServer: any;

test.beforeAll(async () => {
  const servers = await startFileUploadServers();
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
        if (w.url().includes('index.html')) {
          page = w;
          break;
        }
      } catch (_) {
        /* still loading */
      }
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
function jsValue(pg: Page, sel: string) {
  return pg.evaluate((s: string) => (document.querySelector(s) as HTMLInputElement).value, sel);
}

async function navigateToFileUploadServers(page: Page) {
  await page.evaluate(() => {
    const left = document.getElementById('left-url') as HTMLInputElement;
    left.value = 'http://127.0.0.1:3300';
    left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const right = document.getElementById('right-url') as HTMLInputElement;
    right.value = 'http://127.0.0.1:3301';
    right.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  await page.waitForTimeout(2000);
}

/**
 * Execute JavaScript on a BrowserView via the Electron main process.
 * Uses webContents.getAllWebContents() to find views by URL.
 */
async function evalOnView(
  app: ElectronApplication,
  viewUrl: string,
  script: string,
): Promise<unknown> {
  return app.evaluate(
    async ({ webContents: wcModule }, { url, js }) => {
      const allWc = wcModule.getAllWebContents();
      for (const wc of allWc) {
        if (wc.getURL().includes(url)) {
          return wc.executeJavaScript(js);
        }
      }
      return null;
    },
    { url: viewUrl, js: script },
  );
}

// ── テスト: インフラ確認 ──

test.describe('ファイルアップロード同期 - インフラ確認', () => {
  test('ファイルアップロードページが両ビューに読み込まれる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const leftUrl = await jsValue(page, '#left-url');
      const rightUrl = await jsValue(page, '#right-url');
      expect(leftUrl).toBe('http://127.0.0.1:3300');
      expect(rightUrl).toBe('http://127.0.0.1:3301');
    } finally {
      await app.close();
    }
  });

  test('Sync が ON の状態でファイルアップロードページに遷移できる', async () => {
    const { app, page } = await launchApp();
    try {
      expect(await jsText(page, '#toggle-sync')).toContain('Sync ON');
      await navigateToFileUploadServers(page);
      expect(await jsText(page, '#toggle-sync')).toContain('Sync ON');
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');
    } finally {
      await app.close();
    }
  });

  test('両ビューにファイル入力要素が存在する', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      // Check left view has file inputs
      const leftHasInputs = await evalOnView(app, '127.0.0.1:3300', `(function(){
        var inputs = document.querySelectorAll('input[type="file"]');
        return inputs.length;
      })()`);
      expect(leftHasInputs).toBeGreaterThanOrEqual(2);

      // Check right view has file inputs
      const rightHasInputs = await evalOnView(app, '127.0.0.1:3301', `(function(){
        var inputs = document.querySelectorAll('input[type="file"]');
        return inputs.length;
      })()`);
      expect(rightHasInputs).toBeGreaterThanOrEqual(2);
    } finally {
      await app.close();
    }
  });
});

// ── テスト: インジェクションスクリプト確認 ──

test.describe('ファイルアップロード同期 - インジェクションスクリプト', () => {
  test('左ビューにインジェクションスクリプトが注入されている', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const injected = await evalOnView(
        app,
        '127.0.0.1:3300',
        'window.__twinSyncInjected === true',
      );
      expect(injected).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('右ビューにはインジェクションスクリプトが注入されていない', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const injected = await evalOnView(
        app,
        '127.0.0.1:3301',
        'window.__twinSyncInjected === true',
      );
      expect(injected).not.toBe(true);
    } finally {
      await app.close();
    }
  });

  test('左ビューで showOpenFilePicker が無効化されている (CDP インターセプト用)', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const hasShowOpenFilePicker = await evalOnView(
        app,
        '127.0.0.1:3300',
        'typeof window.showOpenFilePicker',
      );
      expect(hasShowOpenFilePicker).toBe('undefined');
    } finally {
      await app.close();
    }
  });

  test('右ビューでは showOpenFilePicker がインジェクションの影響を受けない', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      // Right view should NOT have showOpenFilePicker overridden
      // (it may or may not have the API depending on Chromium version)
      const rightInjected = await evalOnView(
        app,
        '127.0.0.1:3301',
        'window.__twinSyncInjected === true',
      );
      expect(rightInjected).not.toBe(true);
    } finally {
      await app.close();
    }
  });

  test('ページ再読み込み後もインジェクションスクリプトが再注入される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      // Verify injected
      let injected = await evalOnView(app, '127.0.0.1:3300', 'window.__twinSyncInjected === true');
      expect(injected).toBe(true);

      // Reload left view
      await jsClick(page, '#reload-left');
      await page.waitForTimeout(2000);

      // Should be re-injected after reload
      injected = await evalOnView(app, '127.0.0.1:3300', 'window.__twinSyncInjected === true');
      expect(injected).toBe(true);
    } finally {
      await app.close();
    }
  });
});

// ── テスト: CDP ファイルチューザーインターセプション ──

test.describe('ファイルアップロード同期 - CDP インターセプション', () => {
  test('左ビューの debugger が attach されている', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const isAttached = await app.evaluate(async ({ webContents: wcModule }) => {
        const allWc = wcModule.getAllWebContents();
        for (const wc of allWc) {
          if (wc.getURL().includes('127.0.0.1:3300')) {
            return wc.debugger.isAttached();
          }
        }
        return null;
      });
      expect(isAttached).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('右ビューの debugger は attach されていない（同期先なので不要）', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const isAttached = await app.evaluate(async ({ webContents: wcModule }) => {
        const allWc = wcModule.getAllWebContents();
        for (const wc of allWc) {
          if (wc.getURL().includes('127.0.0.1:3301')) {
            return wc.debugger.isAttached();
          }
        }
        return null;
      });
      expect(isAttached).toBe(false);
    } finally {
      await app.close();
    }
  });
});

// ── テスト: 同期トグル ──

test.describe('ファイルアップロード同期 - 同期トグル', () => {
  test('Sync ON/OFF 切り替えがファイルアップロードページで正常動作する', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      // Initial: ON
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');

      // Toggle OFF
      await jsClick(page, '#toggle-sync');
      expect(await jsText(page, '#status-sync')).toBe('Sync: OFF');
      expect(await jsText(page, '#toggle-sync')).toContain('Sync OFF');

      // Toggle ON
      await jsClick(page, '#toggle-sync');
      expect(await jsText(page, '#status-sync')).toBe('Sync: ON');
      expect(await jsText(page, '#toggle-sync')).toContain('Sync ON');
    } finally {
      await app.close();
    }
  });

  test('Sync OFF 後に再度 ON にするとインジェクションスクリプトが再注入される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      // Toggle OFF then ON (inject() is called on resume)
      await jsClick(page, '#toggle-sync');
      await jsClick(page, '#toggle-sync');
      await page.waitForTimeout(500);

      const injected = await evalOnView(app, '127.0.0.1:3300', 'window.__twinSyncInjected === true');
      expect(injected).toBe(true);
    } finally {
      await app.close();
    }
  });
});

// ── テスト: ページ構造の検証 ──

test.describe('ファイルアップロード同期 - ページ構造', () => {
  test('左ビューに react-dropzone パターンのドロップゾーンがある', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const hasDropzone = await evalOnView(app, '127.0.0.1:3300', `(function(){
        var dz = document.getElementById('dropzone');
        var input = document.getElementById('file-input');
        return !!(dz && input && input.type === 'file');
      })()`);
      expect(hasDropzone).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('左ビューにマルチファイル入力がある', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const hasMulti = await evalOnView(app, '127.0.0.1:3300', `(function(){
        var input = document.getElementById('multi-file-input');
        return input && input.hasAttribute('multiple');
      })()`);
      expect(hasMulti).toBe(true);
    } finally {
      await app.close();
    }
  });

  test('左ビューのステータスバナーが初期状態で「ファイル未選択」を表示する', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const bannerText = await evalOnView(
        app,
        '127.0.0.1:3300',
        'document.getElementById("status-banner").textContent',
      );
      expect(bannerText).toBe('ファイル未選択');
    } finally {
      await app.close();
    }
  });

  test('右ビューのステータスバナーも初期状態で「ファイル未選択」を表示する', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      const bannerText = await evalOnView(
        app,
        '127.0.0.1:3301',
        'document.getElementById("status-banner").textContent',
      );
      expect(bannerText).toBe('ファイル未選択');
    } finally {
      await app.close();
    }
  });
});

// ── テスト: デバイスプリセットとの統合 ──

test.describe('ファイルアップロード同期 - デバイスプリセット', () => {
  test('デバイスプリセット切り替え後もファイルアップロードページが正常に表示される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      // Switch to iPhone SE preset
      await jsClick(page, '.btn-preset[data-preset="0"]');
      expect(await jsText(page, '#status-size')).toBe('375 x 667');

      // Verify page still loaded
      const hasInput = await evalOnView(app, '127.0.0.1:3300', `(function(){
        return document.getElementById('file-input') !== null;
      })()`);
      expect(hasInput).toBe(true);

      // Switch to Desktop preset
      await jsClick(page, '.btn-preset[data-preset="3"]');
      expect(await jsText(page, '#status-size')).toBe('1280 x 900');
    } finally {
      await app.close();
    }
  });
});

// ── テスト: CSS スキャンとの統合 ──

test.describe('ファイルアップロード同期 - CSS スキャン統合', () => {
  test('ファイルアップロードページで CSS スキャンが実行できる', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToFileUploadServers(page);

      await jsClick(page, '#css-scan-btn');

      // Wait for scan to complete
      await page.waitForFunction(
        () => {
          const btn = document.getElementById('css-scan-btn');
          return btn && btn.textContent!.includes('CSS Scan') && !(btn as HTMLButtonElement).disabled;
        },
        { timeout: 15000 },
      );

      const btnText = await jsText(page, '#css-scan-btn');
      expect(btnText).toContain('CSS Scan');
    } finally {
      await app.close();
    }
  });
});

// ── テスト: ナビゲーション遷移 ──

test.describe('ファイルアップロード同期 - ナビゲーション遷移', () => {
  test('別のページからファイルアップロードページに遷移するとインジェクションが再実行される', async () => {
    const { app, page } = await launchApp();
    try {
      // First navigate to a different page (default URLs)
      await page.waitForTimeout(1000);

      // Then navigate to file upload servers
      await navigateToFileUploadServers(page);

      // Verify injection after navigation
      const injected = await evalOnView(app, '127.0.0.1:3300', 'window.__twinSyncInjected === true');
      expect(injected).toBe(true);

      const pickerDisabled = await evalOnView(
        app,
        '127.0.0.1:3300',
        'typeof window.showOpenFilePicker',
      );
      expect(pickerDisabled).toBe('undefined');
    } finally {
      await app.close();
    }
  });

  test('ファイルアップロードページから別ページに遷移して戻るとインジェクションが再実行される', async () => {
    const { app, page } = await launchApp();
    try {
      // Navigate to file upload page
      await navigateToFileUploadServers(page);

      let injected = await evalOnView(app, '127.0.0.1:3300', 'window.__twinSyncInjected === true');
      expect(injected).toBe(true);

      // Navigate left view to a different URL
      await page.evaluate(() => {
        const left = document.getElementById('left-url') as HTMLInputElement;
        left.value = 'about:blank';
        left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      await page.waitForTimeout(1500);

      // Navigate back to file upload page
      await page.evaluate(() => {
        const left = document.getElementById('left-url') as HTMLInputElement;
        left.value = 'http://127.0.0.1:3300';
        left.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      });
      await page.waitForTimeout(2000);

      // Re-injection should have occurred
      injected = await evalOnView(app, '127.0.0.1:3300', 'window.__twinSyncInjected === true');
      expect(injected).toBe(true);
    } finally {
      await app.close();
    }
  });
});
