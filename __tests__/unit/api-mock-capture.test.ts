export {};

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/main/msw-handler-generator', () => ({
  generateMswHandlers: jest.fn().mockReturnValue({
    handlers: 'export const handlers = [];',
    jsonFiles: [{ filename: 'GET-api-users.json', content: '[]' }],
  }),
}));

const { createApiMockCaptureManager } = require('../../src/main/api-mock-capture');

function createMockDebugger() {
  const dbgListeners: Record<string, any[]> = {};
  return {
    isAttached: jest.fn(() => true),
    attach: jest.fn(),
    detach: jest.fn(),
    sendCommand: jest.fn().mockImplementation((cmd: string) => {
      if (cmd === 'Network.enable') return Promise.resolve({});
      if (cmd === 'Network.disable') return Promise.resolve({});
      if (cmd === 'Network.getResponseBody') {
        return Promise.resolve({
          body: JSON.stringify({ id: 1, name: 'Alice' }),
          base64Encoded: false,
        });
      }
      return Promise.resolve({});
    }),
    on: jest.fn((event: any, cb: any) => {
      if (!dbgListeners[event]) dbgListeners[event] = [];
      dbgListeners[event].push(cb);
    }),
    removeListener: jest.fn((event: any, cb: any) => {
      if (dbgListeners[event]) {
        dbgListeners[event] = dbgListeners[event].filter((l: any) => l !== cb);
      }
    }),
    _listeners: dbgListeners,
  };
}

function createMockView() {
  const listeners: Record<string, any[]> = {};
  return {
    webContents: {
      on: jest.fn((event: any, cb: any) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      removeListener: jest.fn((event: any, cb: any) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l: any) => l !== cb);
        }
      }),
      isDestroyed: jest.fn(() => false),
      send: jest.fn(),
      debugger: createMockDebugger(),
    },
    _listeners: listeners,
    _emit(event: any, ...args: any[]) {
      (listeners[event] || []).forEach((cb: any) => cb(...args));
    },
  };
}

function createMockMainWindow() {
  return {
    webContents: {
      isDestroyed: jest.fn(() => false),
      send: jest.fn(),
    },
  };
}

describe('ApiMockCaptureManager', () => {
  let leftView: any;
  let mainWindow: any;
  let manager: any;

  beforeEach(() => {
    leftView = createMockView();
    mainWindow = createMockMainWindow();
    manager = createApiMockCaptureManager();
    manager.register(leftView, mainWindow);
  });

  afterEach(() => {
    manager.unregister();
  });

  // --- Lifecycle ---
  describe('lifecycle', () => {
    test('isCapturing returns false by default', () => {
      expect(manager.isCapturing()).toBe(false);
    });

    test('startCapture sets capturing to true', async () => {
      await manager.startCapture();
      expect(manager.isCapturing()).toBe(true);
    });

    test('stopCapture sets capturing to false', async () => {
      await manager.startCapture();
      manager.stopCapture();
      expect(manager.isCapturing()).toBe(false);
    });

    test('startCapture enables Network domain via CDP', async () => {
      await manager.startCapture();
      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith('Network.enable');
    });

    test('startCapture attaches debugger if not attached', async () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      await manager.startCapture();
      expect(leftView.webContents.debugger.attach).toHaveBeenCalledWith('1.3');
    });

    test('startCapture does not re-attach if already attached', async () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(true);
      await manager.startCapture();
      expect(leftView.webContents.debugger.attach).not.toHaveBeenCalled();
    });

    test('startCapture registers CDP message listener', async () => {
      await manager.startCapture();
      expect(leftView.webContents.debugger.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('startCapture registers did-finish-load listener', async () => {
      await manager.startCapture();
      expect(leftView.webContents.on).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    });

    test('stopCapture removes CDP message listener', async () => {
      await manager.startCapture();
      manager.stopCapture();
      expect(leftView.webContents.debugger.removeListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('stopCapture removes did-finish-load listener', async () => {
      await manager.startCapture();
      manager.stopCapture();
      expect(leftView.webContents.removeListener).toHaveBeenCalledWith('did-finish-load', expect.any(Function));
    });

    test('stopCapture disables Network domain', async () => {
      await manager.startCapture();
      leftView.webContents.debugger.sendCommand.mockClear();
      manager.stopCapture();
      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith('Network.disable');
    });

    test('startCapture does nothing when leftView is null', async () => {
      manager.unregister();
      manager = createApiMockCaptureManager();
      await manager.startCapture();
      expect(manager.isCapturing()).toBe(false);
    });

    test('startCapture does nothing when already capturing', async () => {
      await manager.startCapture();
      leftView.webContents.debugger.sendCommand.mockClear();
      await manager.startCapture();
      // Network.enable should not be called again
      expect(leftView.webContents.debugger.sendCommand).not.toHaveBeenCalledWith('Network.enable');
    });

    test('stopCapture does nothing when not capturing', () => {
      // Should not throw
      manager.stopCapture();
      expect(leftView.webContents.debugger.removeListener).not.toHaveBeenCalled();
    });

    test('unregister stops capture if active', async () => {
      await manager.startCapture();
      manager.unregister();
      expect(manager.isCapturing()).toBe(false);
    });
  });

  // --- Request Capture ---
  describe('request capture', () => {
    async function simulateXhrRequest(requestId: string, method: string, url: string, status: number, body: unknown) {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      // requestWillBeSent
      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId,
        type: 'XHR',
        request: { method, url, headers: {} },
      });

      // responseReceived
      cdpHandler(null, 'Network.responseReceived', {
        requestId,
        response: { status, headers: {} },
      });

      // loadingFinished
      await cdpHandler(null, 'Network.loadingFinished', { requestId });
    }

    test('captures XHR request', async () => {
      await simulateXhrRequest('req1', 'GET', 'http://localhost:3000/api/users', 200, [{ id: 1 }]);
      const data = manager.getCapturedData();
      expect(data).toHaveLength(1);
      expect(data[0].method).toBe('GET');
      expect(data[0].urlPattern).toBe('/api/users');
      expect(data[0].entries).toHaveLength(1);
    });

    test('captures Fetch request', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req2',
        type: 'Fetch',
        request: { method: 'POST', url: 'http://localhost:3000/api/data', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req2',
        response: { status: 201, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req2' });

      const data = manager.getCapturedData();
      expect(data).toHaveLength(1);
      expect(data[0].method).toBe('POST');
    });

    test('ignores non-XHR/Fetch requests (e.g., Document, Image)', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req3',
        type: 'Document',
        request: { method: 'GET', url: 'http://localhost:3000/', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req3',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req3' });

      expect(manager.getCapturedData()).toHaveLength(0);
    });

    test('groups duplicate endpoints', async () => {
      await simulateXhrRequest('req1', 'GET', 'http://localhost:3000/api/users', 200, [{ id: 1 }]);
      // Re-get the handler (startCapture was already called)
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req4',
        type: 'XHR',
        request: { method: 'GET', url: 'http://localhost:3000/api/users?page=2', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req4',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req4' });

      const data = manager.getCapturedData();
      expect(data).toHaveLength(1);
      expect(data[0].entries).toHaveLength(2);
    });

    test('separate groups for different methods on same path', async () => {
      await simulateXhrRequest('req1', 'GET', 'http://localhost:3000/api/users', 200, null);

      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req5',
        type: 'XHR',
        request: { method: 'POST', url: 'http://localhost:3000/api/users', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req5',
        response: { status: 201, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req5' });

      const data = manager.getCapturedData();
      expect(data).toHaveLength(2);
    });

    test('getCapturedCount returns total entry count', async () => {
      await simulateXhrRequest('req1', 'GET', 'http://localhost:3000/api/users', 200, null);

      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req6',
        type: 'Fetch',
        request: { method: 'GET', url: 'http://localhost:3000/api/users?page=2', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req6',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req6' });

      expect(manager.getCapturedCount()).toBe(2);
    });

    test('notifies mainWindow on capture update', async () => {
      await simulateXhrRequest('req1', 'GET', 'http://localhost:3000/api/users', 200, null);
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'api-mock-capture-update',
        expect.objectContaining({
          count: expect.any(Number),
          endpoints: expect.any(Array),
        }),
      );
    });

    test('does not capture when not in capturing state', async () => {
      // Do NOT call startCapture
      const dbgHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      );
      // If no handler registered, that's fine
      if (dbgHandler) {
        dbgHandler[1](null, 'Network.requestWillBeSent', {
          requestId: 'req7',
          type: 'XHR',
          request: { method: 'GET', url: 'http://localhost:3000/api/test', headers: {} },
        });
      }
      expect(manager.getCapturedData()).toHaveLength(0);
    });

    test('handles loadingFinished without matching request gracefully', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      // loadingFinished without prior requestWillBeSent
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'unknown' });
      expect(manager.getCapturedData()).toHaveLength(0);
    });

    test('handles getResponseBody failure gracefully', async () => {
      leftView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'Network.getResponseBody') return Promise.reject(new Error('No body'));
        return Promise.resolve({});
      });

      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req8',
        type: 'XHR',
        request: { method: 'GET', url: 'http://localhost:3000/api/test', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req8',
        response: { status: 302, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req8' });

      const data = manager.getCapturedData();
      expect(data).toHaveLength(1);
      expect(data[0].entries[0].response.body).toBeNull();
    });

    test('handles base64 encoded response body', async () => {
      leftView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'Network.getResponseBody') {
          return Promise.resolve({ body: 'SGVsbG8=', base64Encoded: true });
        }
        return Promise.resolve({});
      });

      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req9',
        type: 'XHR',
        request: { method: 'GET', url: 'http://localhost:3000/api/binary', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req9',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req9' });

      const data = manager.getCapturedData();
      expect(data[0].entries[0].response.body).toBe('SGVsbG8=');
    });

    test('handles non-JSON text response body', async () => {
      leftView.webContents.debugger.sendCommand.mockImplementation((cmd: string) => {
        if (cmd === 'Network.getResponseBody') {
          return Promise.resolve({ body: 'plain text response', base64Encoded: false });
        }
        return Promise.resolve({});
      });

      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req10',
        type: 'Fetch',
        request: { method: 'GET', url: 'http://localhost:3000/api/text', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req10',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req10' });

      const data = manager.getCapturedData();
      expect(data[0].entries[0].response.body).toBe('plain text response');
    });

    test('captures POST request body as parsed JSON', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req-post-json',
        type: 'Fetch',
        request: {
          method: 'POST',
          url: 'http://localhost:3000/api/users',
          headers: { 'content-type': 'application/json' },
          postData: JSON.stringify({ name: 'Alice', age: 30 }),
        },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req-post-json',
        response: { status: 201, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req-post-json' });

      const data = manager.getCapturedData();
      expect(data[0].entries[0].request.body).toEqual({ name: 'Alice', age: 30 });
    });

    test('captures POST request body as string for non-JSON form data', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req-post-form',
        type: 'XHR',
        request: {
          method: 'POST',
          url: 'http://localhost:3000/api/submit',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          postData: 'name=Alice&age=30',
        },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req-post-form',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req-post-form' });

      const data = manager.getCapturedData();
      expect(data[0].entries[0].request.body).toBe('name=Alice&age=30');
    });

    test('GET request has undefined request body', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req-get-nobody',
        type: 'XHR',
        request: {
          method: 'GET',
          url: 'http://localhost:3000/api/users',
          headers: {},
        },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req-get-nobody',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req-get-nobody' });

      const data = manager.getCapturedData();
      expect(data[0].entries[0].request.body).toBeUndefined();
    });
  });

  // --- Clear Data ---
  describe('clearCapturedData', () => {
    test('clears all captured data', async () => {
      await manager.startCapture();
      const cdpHandler = leftView.webContents.debugger.on.mock.calls.find(
        (call: any[]) => call[0] === 'message',
      )[1];

      cdpHandler(null, 'Network.requestWillBeSent', {
        requestId: 'req1',
        type: 'XHR',
        request: { method: 'GET', url: 'http://localhost:3000/api/users', headers: {} },
      });
      cdpHandler(null, 'Network.responseReceived', {
        requestId: 'req1',
        response: { status: 200, headers: {} },
      });
      await cdpHandler(null, 'Network.loadingFinished', { requestId: 'req1' });

      expect(manager.getCapturedCount()).toBeGreaterThan(0);
      manager.clearCapturedData();
      expect(manager.getCapturedCount()).toBe(0);
      expect(manager.getCapturedData()).toHaveLength(0);
    });

    test('notifies mainWindow after clear', () => {
      mainWindow.webContents.send.mockClear();
      manager.clearCapturedData();
      expect(mainWindow.webContents.send).toHaveBeenCalledWith(
        'api-mock-capture-update',
        { count: 0, endpoints: [] },
      );
    });
  });

  // --- Export ---
  describe('exportToFiles', () => {
    test('creates mocks directory and writes files', async () => {
      const fs = require('fs');
      const result = await manager.exportToFiles('/output', 'v2');
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('mocks'),
        { recursive: true },
      );
      expect(fs.promises.writeFile).toHaveBeenCalled();
      expect(result.outputDir).toBe('/output');
      expect(result.handlerFile).toBe('handlers.ts');
    });

    test('returns correct export result structure', async () => {
      const result = await manager.exportToFiles('/output', 'v1');
      expect(result).toHaveProperty('outputDir');
      expect(result).toHaveProperty('jsonFiles');
      expect(result).toHaveProperty('handlerFile');
      expect(result).toHaveProperty('totalEndpoints');
    });

    test('writes handler file to output root', async () => {
      const fs = require('fs');
      await manager.exportToFiles('/output', 'v2');
      const writeFileCalls = fs.promises.writeFile.mock.calls;
      const handlerWrite = writeFileCalls.find((call: any[]) =>
        call[0].endsWith('handlers.ts'),
      );
      expect(handlerWrite).toBeDefined();
    });
  });

  // --- did-finish-load re-enables Network ---
  describe('did-finish-load re-enable', () => {
    test('re-enables Network.enable on page load when capturing', async () => {
      await manager.startCapture();
      leftView.webContents.debugger.sendCommand.mockClear();

      // Simulate did-finish-load
      const finishLoadCb = leftView.webContents.on.mock.calls.find(
        (call: any[]) => call[0] === 'did-finish-load',
      )[1];
      finishLoadCb();

      expect(leftView.webContents.debugger.sendCommand).toHaveBeenCalledWith('Network.enable');
    });

    test('does not re-enable Network when not capturing', async () => {
      await manager.startCapture();
      const finishLoadCb = leftView.webContents.on.mock.calls.find(
        (call: any[]) => call[0] === 'did-finish-load',
      )[1];
      manager.stopCapture();
      leftView.webContents.debugger.sendCommand.mockClear();
      finishLoadCb();
      expect(leftView.webContents.debugger.sendCommand).not.toHaveBeenCalledWith('Network.enable');
    });
  });

  // --- Edge cases ---
  describe('edge cases', () => {
    test('does not crash when mainWindow is destroyed', async () => {
      mainWindow.webContents.isDestroyed.mockReturnValue(true);
      await manager.startCapture();
      // notifyUpdate should not crash
      manager.clearCapturedData();
    });

    test('stopCapture handles destroyed leftView', async () => {
      await manager.startCapture();
      leftView.webContents.isDestroyed.mockReturnValue(true);
      // Should not throw
      manager.stopCapture();
      expect(manager.isCapturing()).toBe(false);
    });

    test('startCapture handles debugger attach failure gracefully', async () => {
      leftView.webContents.debugger.isAttached.mockReturnValue(false);
      leftView.webContents.debugger.attach.mockImplementation(() => {
        throw new Error('Already attached');
      });
      // Should not throw, should continue with Network.enable
      await manager.startCapture();
      expect(manager.isCapturing()).toBe(true);
    });
  });
});
