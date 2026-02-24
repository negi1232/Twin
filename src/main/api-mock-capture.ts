/**
 * @module main/api-mock-capture
 * @description 左ビューの API レスポンス（XHR/Fetch）をキャプチャし、
 * MSW ハンドラーとして export 可能な形式で保持するアドオン。
 *
 * CDP Network ドメインを使用して左ビューの通信をキャプチャする。
 * SyncManager が既にデバッガをアタッチしている前提で、
 * `Network.enable` のみ呼び出し、`detach()` はしない。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BrowserWindow, WebContentsView } from 'electron';
import { generateMswHandlers } from './msw-handler-generator';

export interface ApiMockCaptureManager {
  register(leftView: WebContentsView, mainWindow: BrowserWindow): void;
  unregister(): void;
  isCapturing(): boolean;
  startCapture(): Promise<void>;
  stopCapture(): void;
  getCapturedData(): CapturedApiGroup[];
  getCapturedCount(): number;
  exportToFiles(outputDir: string, mswVersion: 'v1' | 'v2'): Promise<ApiMockExportResult>;
  clearCapturedData(): void;
  setChildWindow(win: BrowserWindow | null): void;
}

interface PendingRequest {
  requestId: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  type: string;
  postData?: string;
}

interface PendingResponse {
  requestId: string;
  status: number;
  headers: Record<string, string>;
}

/**
 * ApiMockCaptureManager のファクトリ関数。SyncManager と同じパターン。
 */
function createApiMockCaptureManager(): ApiMockCaptureManager {
  let leftView: WebContentsView | null = null;
  let mainWindow: BrowserWindow | null = null;
  let childWindow: BrowserWindow | null = null;
  let capturing = false;

  // Internal state
  const pendingRequests = new Map<string, PendingRequest>();
  const pendingResponses = new Map<string, PendingResponse>();
  const capturedGroups = new Map<string, CapturedApiGroup>();

  /**
   * URL からパス名部分のみを抽出する（クエリパラメータ除外）。
   */
  function extractPathname(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  }

  /**
   * エンドポイントのキーを生成する。"METHOD /path" 形式。
   */
  function makeEndpointKey(method: string, url: string): string {
    return `${method} ${extractPathname(url)}`;
  }

  /**
   * mainWindow へキャプチャ状況を通知する。
   */
  function notifyUpdate(): void {
    const endpoints = Array.from(capturedGroups.keys());
    let count = 0;
    for (const group of capturedGroups.values()) {
      count += group.entries.length;
    }
    const data = { count, endpoints };
    if (mainWindow && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('api-mock-capture-update', data);
    }
    if (childWindow && !childWindow.isDestroyed() && !childWindow.webContents.isDestroyed()) {
      childWindow.webContents.send('api-mock-capture-update', data);
    }
  }

  /**
   * CDP Network イベントハンドラ。
   */
  function handleCDPEvent(_event: unknown, method: string, params: Record<string, unknown>): void {
    if (!capturing) return;

    switch (method) {
      case 'Network.requestWillBeSent':
        handleRequestWillBeSent(params);
        break;
      case 'Network.responseReceived':
        handleResponseReceived(params);
        break;
      case 'Network.loadingFinished':
        handleLoadingFinished(params);
        break;
    }
  }

  function handleRequestWillBeSent(params: Record<string, unknown>): void {
    const requestId = params.requestId as string;
    const type = params.type as string;

    // XHR/Fetch のみ対象
    if (type !== 'XHR' && type !== 'Fetch') return;

    const request = params.request as Record<string, unknown>;
    pendingRequests.set(requestId, {
      requestId,
      method: request.method as string,
      url: request.url as string,
      headers: (request.headers || {}) as Record<string, string>,
      type,
      postData: request.postData as string | undefined,
    });
  }

  function handleResponseReceived(params: Record<string, unknown>): void {
    const requestId = params.requestId as string;
    if (!pendingRequests.has(requestId)) return;

    const response = params.response as Record<string, unknown>;
    pendingResponses.set(requestId, {
      requestId,
      status: response.status as number,
      headers: (response.headers || {}) as Record<string, string>,
    });
  }

  async function handleLoadingFinished(params: Record<string, unknown>): Promise<void> {
    const requestId = params.requestId as string;
    const request = pendingRequests.get(requestId);
    const response = pendingResponses.get(requestId);

    if (!request || !response) {
      pendingRequests.delete(requestId);
      pendingResponses.delete(requestId);
      return;
    }

    // Get response body via CDP
    let body: unknown = null;
    if (leftView && !leftView.webContents.isDestroyed()) {
      try {
        const dbg = leftView.webContents.debugger;
        const result = await dbg.sendCommand('Network.getResponseBody', { requestId });
        const bodyStr = result.body as string;
        const base64Encoded = result.base64Encoded as boolean;

        if (base64Encoded) {
          body = bodyStr; // Keep as base64 string
        } else {
          try {
            body = JSON.parse(bodyStr);
          } catch {
            body = bodyStr;
          }
        }
      } catch {
        // Response body may not be available (e.g., redirects)
      }
    }

    // Parse request body (postData)
    let requestBody: unknown;
    if (request.postData) {
      try {
        requestBody = JSON.parse(request.postData);
      } catch {
        requestBody = request.postData;
      }
    }

    // Build entry
    const entry: CapturedApiEntry = {
      requestId,
      timestamp: Date.now(),
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: requestBody,
      },
      response: {
        status: response.status,
        headers: response.headers,
        body,
      },
    };

    // Group by endpoint key
    const key = makeEndpointKey(request.method, request.url);
    const group = capturedGroups.get(key);
    if (group) {
      group.entries.push(entry);
    } else {
      capturedGroups.set(key, {
        method: request.method,
        urlPattern: extractPathname(request.url),
        entries: [entry],
      });
    }

    // Cleanup pending
    pendingRequests.delete(requestId);
    pendingResponses.delete(requestId);

    notifyUpdate();
  }

  /**
   * did-finish-load 時に Network.enable を再呼び出しする。
   */
  function onDidFinishLoad(): void {
    if (!capturing || !leftView || leftView.webContents.isDestroyed()) return;
    const dbg = leftView.webContents.debugger;
    if (dbg.isAttached()) {
      dbg.sendCommand('Network.enable').catch(() => {
        // Ignore errors during re-enable
      });
    }
  }

  function register(lv: WebContentsView, mw: BrowserWindow): void {
    leftView = lv;
    mainWindow = mw;
  }

  function unregister(): void {
    if (capturing) {
      stopCapture();
    }
    leftView = null;
    mainWindow = null;
  }

  async function startCapture(): Promise<void> {
    if (capturing || !leftView || leftView.webContents.isDestroyed()) return;

    const dbg = leftView.webContents.debugger;

    // Ensure debugger is attached (SyncManager should have attached already)
    if (!dbg.isAttached()) {
      try {
        dbg.attach('1.3');
      } catch {
        // Already attached by SyncManager
      }
    }

    // Enable Network domain
    await dbg.sendCommand('Network.enable');

    // Listen for CDP events
    dbg.on('message', handleCDPEvent);

    // Re-enable on page load
    leftView.webContents.on('did-finish-load', onDidFinishLoad);

    capturing = true;
    notifyUpdate();
  }

  function stopCapture(): void {
    if (!capturing) return;

    capturing = false;

    if (leftView && !leftView.webContents.isDestroyed()) {
      const dbg = leftView.webContents.debugger;
      try {
        dbg.removeListener('message', handleCDPEvent);
      } catch {
        // Debugger may not be attached
      }
      leftView.webContents.removeListener('did-finish-load', onDidFinishLoad);

      // Disable Network domain but don't detach debugger
      if (dbg.isAttached()) {
        dbg.sendCommand('Network.disable').catch(() => {
          // Ignore
        });
      }
    }

    pendingRequests.clear();
    pendingResponses.clear();
    notifyUpdate();
  }

  function getCapturedData(): CapturedApiGroup[] {
    return Array.from(capturedGroups.values());
  }

  function getCapturedCount(): number {
    let count = 0;
    for (const group of capturedGroups.values()) {
      count += group.entries.length;
    }
    return count;
  }

  async function exportToFiles(outputDir: string, mswVersion: 'v1' | 'v2'): Promise<ApiMockExportResult> {
    const groups = getCapturedData();
    const { handlers, jsonFiles } = generateMswHandlers(groups, mswVersion);

    // Create mocks subdirectory
    const mocksDir = path.join(outputDir, 'mocks');
    await fs.promises.mkdir(mocksDir, { recursive: true });

    // Write JSON files
    const writtenJsonFiles: string[] = [];
    for (const file of jsonFiles) {
      const filePath = path.join(mocksDir, file.filename);
      await fs.promises.writeFile(filePath, file.content, 'utf-8');
      writtenJsonFiles.push(file.filename);
    }

    // Write handlers file
    const handlerFile = 'handlers.ts';
    const handlerPath = path.join(outputDir, handlerFile);
    await fs.promises.writeFile(handlerPath, handlers, 'utf-8');

    return {
      outputDir,
      jsonFiles: writtenJsonFiles,
      handlerFile,
      totalEndpoints: groups.length,
    };
  }

  function clearCapturedData(): void {
    capturedGroups.clear();
    pendingRequests.clear();
    pendingResponses.clear();
    notifyUpdate();
  }

  function setChildWindow(win: BrowserWindow | null): void {
    childWindow = win;
  }

  return {
    register,
    unregister,
    isCapturing: () => capturing,
    startCapture,
    stopCapture,
    getCapturedData,
    getCapturedCount,
    exportToFiles,
    clearCapturedData,
    setChildWindow,
  };
}

export { createApiMockCaptureManager };
