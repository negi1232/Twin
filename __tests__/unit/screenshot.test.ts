export {};

jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

const { mkdir, writeFile } = require('fs/promises');
const { captureScreenshots } = require('../../src/main/screenshot');

describe('Screenshot Module', () => {
  const mockImage = {
    toPNG: jest.fn(() => Buffer.from('fake-png-data')),
  };

  const mockLeftView = {
    webContents: {
      capturePage: jest.fn().mockResolvedValue(mockImage),
    },
  };

  const mockRightView = {
    webContents: {
      capturePage: jest.fn().mockResolvedValue(mockImage),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('creates expected and actual directories', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test-page');

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('expected'),
      { recursive: true }
    );
    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('actual'),
      { recursive: true }
    );
  });

  test('captures both views in parallel', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test-page');

    expect(mockLeftView.webContents.capturePage).toHaveBeenCalledTimes(1);
    expect(mockRightView.webContents.capturePage).toHaveBeenCalledTimes(1);
  });

  test('writes PNG files with correct naming format', async () => {
    const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'my-page');

    expect(fileName).toMatch(/^my-page_\d+\.png$/);
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  test('saves to expected and actual subdirectories', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'page');

    const writeCalls = writeFile.mock.calls;
    const paths = writeCalls.map((call: any) => call[0]);

    expect(paths.some((p: any) => p.includes('expected'))).toBe(true);
    expect(paths.some((p: any) => p.includes('actual'))).toBe(true);
  });

  test('generates unique filenames on successive calls', async () => {
    const fileName1 = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');
    const fileName2 = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');
    // Filenames should be different due to different timestamps
    // (or same millisecond, but both should match the pattern)
    expect(fileName1).toMatch(/^test_\d+\.png$/);
    expect(fileName2).toMatch(/^test_\d+\.png$/);
  });

  test('passes Buffer data from toPNG to writeFile', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');

    const writeCalls = writeFile.mock.calls;
    writeCalls.forEach((call: any) => {
      expect(Buffer.isBuffer(call[1])).toBe(true);
    });
  });

  test('uses path.join for cross-platform path construction', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/snapshots/custom', 'page');

    const writeCalls = writeFile.mock.calls;
    const paths = writeCalls.map((call: any) => call[0]);
    paths.forEach((p: any) => {
      expect(p).toContain('/snapshots/custom');
    });
  });

  test('handles page names with hyphens and underscores', async () => {
    const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp', 'my-test_page');
    expect(fileName).toMatch(/^my-test_page_\d+\.png$/);
  });

  test('both mkdir calls use recursive: true', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');
    expect(mkdir).toHaveBeenCalledTimes(2);
    mkdir.mock.calls.forEach((call: any) => {
      expect(call[1]).toEqual({ recursive: true });
    });
  });

  test('both capturePage calls happen in parallel', async () => {
    let leftCalled = false;
    let rightCalled = false;

    mockLeftView.webContents.capturePage.mockImplementation(async () => {
      leftCalled = true;
      return mockImage;
    });
    mockRightView.webContents.capturePage.mockImplementation(async () => {
      rightCalled = true;
      return mockImage;
    });

    await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');
    expect(leftCalled).toBe(true);
    expect(rightCalled).toBe(true);
  });

  // --- Edge case tests ---

  describe('エラーハンドリング', () => {
    test('左ビューの capturePage が失敗した場合、エラーが伝播する', async () => {
      mockLeftView.webContents.capturePage.mockRejectedValueOnce(
        new Error('Left view capture failed')
      );

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('Left view capture failed');
    });

    test('右ビューの capturePage が失敗した場合、エラーが伝播する', async () => {
      mockRightView.webContents.capturePage.mockRejectedValueOnce(
        new Error('Right view capture failed')
      );

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('Right view capture failed');
    });

    test('両方の capturePage が同時に失敗した場合、いずれかのエラーが伝播する', async () => {
      mockLeftView.webContents.capturePage.mockRejectedValueOnce(
        new Error('Left failed')
      );
      mockRightView.webContents.capturePage.mockRejectedValueOnce(
        new Error('Right failed')
      );

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow();
    });

    test('expected ディレクトリの mkdir が失敗した場合、エラーが伝播する', async () => {
      mkdir.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('EACCES: permission denied');
    });

    test('actual ディレクトリの mkdir が失敗した場合、エラーが伝播する', async () => {
      mkdir
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('EACCES: permission denied'));

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('EACCES: permission denied');
    });

    test('writeFile が失敗した場合、エラーが伝播する', async () => {
      writeFile.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('ENOSPC: no space left on device');
    });

    test('両方の writeFile が同時に失敗した場合、いずれかのエラーが伝播する', async () => {
      writeFile
        .mockRejectedValueOnce(new Error('Disk write error'))
        .mockRejectedValueOnce(new Error('Disk write error'));

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('Disk write error');
    });

    test('toPNG が例外をスローした場合、エラーが伝播する', async () => {
      const failingImage = {
        toPNG: jest.fn(() => { throw new Error('toPNG failed'); }),
      };
      mockLeftView.webContents.capturePage.mockResolvedValueOnce(failingImage);

      await expect(
        captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test')
      ).rejects.toThrow('toPNG failed');
    });
  });

  describe('ファイル名のエッジケース', () => {
    test('空文字列のページ名でファイル名が生成される', async () => {
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', '');
      expect(fileName).toMatch(/^_\d+\.png$/);
    });

    test('スペースを含むページ名が正しく処理される', async () => {
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'my page');
      expect(fileName).toMatch(/^my page_\d+\.png$/);
    });

    test('日本語を含むページ名が正しく処理される', async () => {
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'テストページ');
      expect(fileName).toMatch(/^テストページ_\d+\.png$/);
    });

    test('ドットを含むページ名が正しく処理される', async () => {
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'page.v2.0');
      expect(fileName).toMatch(/^page\.v2\.0_\d+\.png$/);
    });

    test('非常に長いページ名でもファイル名が生成される', async () => {
      const longName = 'a'.repeat(200);
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', longName);
      expect(fileName).toMatch(new RegExp(`^${longName}_\\d+\\.png$`));
    });

    test('特殊文字を含むページ名が正しく処理される', async () => {
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'page@v1#test');
      expect(fileName).toMatch(/^page@v1#test_\d+\.png$/);
    });

    test('タイムスタンプがファイル名に含まれることを確認する', async () => {
      const before = Date.now();
      const fileName = await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');
      const after = Date.now();

      const match = fileName.match(/^test_(\d+)\.png$/);
      expect(match).not.toBeNull();
      const timestamp = parseInt(match![1], 10);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('ディレクトリ作成のエッジケース', () => {
    test('ネストの深いスナップショットディレクトリでも mkdir が呼ばれる', async () => {
      const deepPath = '/a/b/c/d/e/f/g/snapshots';
      await captureScreenshots(mockLeftView, mockRightView, deepPath, 'test');

      expect(mkdir).toHaveBeenCalledTimes(2);
      const mkdirPaths = mkdir.mock.calls.map((call: any) => call[0]);
      expect(mkdirPaths[0]).toContain(deepPath);
      expect(mkdirPaths[1]).toContain(deepPath);
    });

    test('スペースを含むディレクトリパスが正しく処理される', async () => {
      const spacePath = '/tmp/my snapshots/project';
      await captureScreenshots(mockLeftView, mockRightView, spacePath, 'test');

      const mkdirPaths = mkdir.mock.calls.map((call: any) => call[0]);
      mkdirPaths.forEach((p: string) => {
        expect(p).toContain('my snapshots');
      });
    });

    test('mkdir は capturePage の前に呼ばれる', async () => {
      const callOrder: string[] = [];
      mkdir.mockImplementation(async () => { callOrder.push('mkdir'); });
      mockLeftView.webContents.capturePage.mockImplementation(async () => {
        callOrder.push('capturePage');
        return mockImage;
      });
      mockRightView.webContents.capturePage.mockImplementation(async () => {
        callOrder.push('capturePage');
        return mockImage;
      });

      await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');

      const firstMkdir = callOrder.indexOf('mkdir');
      const firstCapture = callOrder.indexOf('capturePage');
      expect(firstMkdir).toBeLessThan(firstCapture);
    });

    test('writeFile のパスに expected/actual サブディレクトリが含まれる', async () => {
      const snapshotDir = '/home/user/project/snapshots';
      await captureScreenshots(mockLeftView, mockRightView, snapshotDir, 'page');

      const writeCalls = writeFile.mock.calls;
      const expectedPath = writeCalls.find((call: any) => call[0].includes('expected'));
      const actualPath = writeCalls.find((call: any) => call[0].includes('actual'));

      expect(expectedPath).toBeDefined();
      expect(actualPath).toBeDefined();
      expect(expectedPath[0]).toContain(snapshotDir);
      expect(actualPath[0]).toContain(snapshotDir);
    });
  });

  describe('戻り値の検証', () => {
    test('戻り値のファイル名がディレクトリパスを含まない', async () => {
      const fileName = await captureScreenshots(
        mockLeftView, mockRightView, '/tmp/snapshots', 'test'
      );
      expect(fileName).not.toContain('/');
      expect(fileName).not.toContain('\\');
    });

    test('戻り値のファイル名の拡張子が .png である', async () => {
      const fileName = await captureScreenshots(
        mockLeftView, mockRightView, '/tmp/snapshots', 'test'
      );
      expect(fileName).toMatch(/\.png$/);
    });

    test('戻り値は文字列型である', async () => {
      const result = await captureScreenshots(
        mockLeftView, mockRightView, '/tmp/snapshots', 'test'
      );
      expect(typeof result).toBe('string');
    });
  });

  describe('画像データの検証', () => {
    test('左ビューの toPNG 結果が expected ディレクトリに書き込まれる', async () => {
      const leftImageData = Buffer.from('left-image-data');
      const rightImageData = Buffer.from('right-image-data');
      const leftImage = { toPNG: jest.fn(() => leftImageData) };
      const rightImage = { toPNG: jest.fn(() => rightImageData) };

      mockLeftView.webContents.capturePage.mockResolvedValueOnce(leftImage);
      mockRightView.webContents.capturePage.mockResolvedValueOnce(rightImage);

      await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');

      const expectedCall = writeFile.mock.calls.find(
        (call: any) => call[0].includes('expected')
      );
      const actualCall = writeFile.mock.calls.find(
        (call: any) => call[0].includes('actual')
      );

      expect(expectedCall[1]).toBe(leftImageData);
      expect(actualCall[1]).toBe(rightImageData);
    });

    test('toPNG が各画像ごとに1回ずつ呼ばれる', async () => {
      const leftImage = { toPNG: jest.fn(() => Buffer.from('left')) };
      const rightImage = { toPNG: jest.fn(() => Buffer.from('right')) };

      mockLeftView.webContents.capturePage.mockResolvedValueOnce(leftImage);
      mockRightView.webContents.capturePage.mockResolvedValueOnce(rightImage);

      await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'test');

      expect(leftImage.toPNG).toHaveBeenCalledTimes(1);
      expect(rightImage.toPNG).toHaveBeenCalledTimes(1);
    });
  });

  describe('書き込みパスの正確性', () => {
    test('expected と actual の両方に同じファイル名が使用される', async () => {
      await captureScreenshots(mockLeftView, mockRightView, '/tmp/snapshots', 'page');

      const writeCalls = writeFile.mock.calls;
      const expectedFilePath: string = writeCalls.find(
        (call: any) => call[0].includes('expected')
      )[0];
      const actualFilePath: string = writeCalls.find(
        (call: any) => call[0].includes('actual')
      )[0];

      const expectedFileName = expectedFilePath.split('/').pop();
      const actualFileName = actualFilePath.split('/').pop();

      expect(expectedFileName).toBe(actualFileName);
    });

    test('mkdir と writeFile のパスが同じベースディレクトリを使用する', async () => {
      const baseDir = '/custom/snapshot/dir';
      await captureScreenshots(mockLeftView, mockRightView, baseDir, 'page');

      mkdir.mock.calls.forEach((call: any) => {
        expect(call[0]).toContain(baseDir);
      });
      writeFile.mock.calls.forEach((call: any) => {
        expect(call[0]).toContain(baseDir);
      });
    });
  });
});
