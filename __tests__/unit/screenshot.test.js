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
});
