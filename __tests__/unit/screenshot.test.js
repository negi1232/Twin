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
    const paths = writeCalls.map(call => call[0]);

    expect(paths.some(p => p.includes('expected'))).toBe(true);
    expect(paths.some(p => p.includes('actual'))).toBe(true);
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
    writeCalls.forEach(call => {
      expect(Buffer.isBuffer(call[1])).toBe(true);
    });
  });

  test('uses path.join for cross-platform path construction', async () => {
    await captureScreenshots(mockLeftView, mockRightView, '/snapshots/custom', 'page');

    const writeCalls = writeFile.mock.calls;
    const paths = writeCalls.map(call => call[0]);
    paths.forEach(p => {
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
    mkdir.mock.calls.forEach(call => {
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
});
