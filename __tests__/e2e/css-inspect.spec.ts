/**
 * CSS Inspect Mode E2E Test
 *
 * CSS Scan ボタン・Inspect Mode トグル・ドロワーの基本動作を検証する。
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

  await page.waitForFunction(
    () => document.getElementById('css-scan-btn') !== null,
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

// ── テスト ──

test.describe('CSS Scan', () => {
  test('CSS Scan ボタンをクリックするとスキャンが実行される', async () => {
    const { app, page } = await launchApp();
    try {
      await navigateToDemoServers(page);

      // CSS Scan ボタンをクリック
      await jsClick(page, '#css-scan-btn');

      // ボタンが "Scanning..." に変わる（すぐに戻る可能性もあるが一瞬は変わる）
      // スキャン完了後にボタンテキストが元に戻ることを確認
      await page.waitForFunction(
        () => {
          const btn = document.getElementById('css-scan-btn');
          return btn && btn.textContent.includes('CSS Scan') && !btn.disabled;
        },
        { timeout: 15000 },
      );
      const text = await jsText(page, '#css-scan-btn');
      expect(text).toContain('CSS Scan');
    } finally {
      await app.close();
    }
  });
});

test.describe('CSS Inspect Mode', () => {
  test('Inspect ボタンをクリックするとモードが ON/OFF に切り替わる', async () => {
    const { app, page } = await launchApp();
    try {
      // 初期状態: Inspect (OFF)
      let text = await jsText(page, '#css-inspect-btn');
      expect(text).toContain('Inspect');
      expect(text).not.toContain('ON');

      // クリック → ON
      await jsClick(page, '#css-inspect-btn');
      await page.waitForTimeout(300);
      text = await jsText(page, '#css-inspect-btn');
      expect(text).toContain('Inspect ON');

      let cls = await jsClassList(page, '#css-inspect-btn');
      expect(cls).toContain('css-inspect-active');

      // クリック → OFF
      await jsClick(page, '#css-inspect-btn');
      await page.waitForTimeout(300);
      text = await jsText(page, '#css-inspect-btn');
      expect(text).not.toContain('ON');

      cls = await jsClassList(page, '#css-inspect-btn');
      expect(cls).not.toContain('css-inspect-active');
    } finally {
      await app.close();
    }
  });

  test('Inspect ドロワーは初期状態で非表示', async () => {
    const { app, page } = await launchApp();
    try {
      const cls = await jsClassList(page, '#css-inspect-drawer');
      expect(cls).toContain('hidden');
    } finally {
      await app.close();
    }
  });

  test('Escape キーで Inspect モードが OFF になる', async () => {
    const { app, page } = await launchApp();
    try {
      // Inspect ON
      await jsClick(page, '#css-inspect-btn');
      await page.waitForTimeout(300);
      let text = await jsText(page, '#css-inspect-btn');
      expect(text).toContain('Inspect ON');

      // Escape to OFF
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      text = await jsText(page, '#css-inspect-btn');
      expect(text).not.toContain('ON');
    } finally {
      await app.close();
    }
  });
});
