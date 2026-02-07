jest.mock('child_process', () => ({
  execFile: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
}));

const { execFile } = require('child_process');
const fs = require('fs/promises');
const { runRegCli } = require('../../src/main/reg-runner');

describe('RegRunner Module', () => {
  const mockRegOutput = {
    failedItems: ['page-top.png'],
    newItems: ['page-new.png'],
    deletedItems: [],
    passedItems: ['page-footer.png'],
    expectedItems: ['page-top.png', 'page-footer.png'],
    actualItems: ['page-top.png', 'page-new.png', 'page-footer.png'],
    diffItems: ['page-top.png'],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    fs.readFile.mockResolvedValue(JSON.stringify(mockRegOutput));

    execFile.mockImplementation((_cmd, _args, callback) => {
      callback(null, '', '');
    });
  });

  test('calls execFile with correct arguments', async () => {
    await runRegCli('/tmp/snapshots');

    expect(execFile).toHaveBeenCalledWith(
      'node',
      expect.arrayContaining([
        expect.stringContaining('actual'),
        expect.stringContaining('expected'),
        expect.stringContaining('diff'),
        '-R', expect.any(String),
        '-J', expect.any(String),
        '-I',
      ]),
      expect.any(Function)
    );
  });

  test('returns parsed summary', async () => {
    const result = await runRegCli('/tmp/snapshots');

    expect(result.summary).toEqual({
      passed: 1,
      failed: 1,
      new: 1,
      deleted: 0,
    });
  });

  test('includes reportPath and jsonPath', async () => {
    const result = await runRegCli('/tmp/snapshots');

    expect(result.reportPath).toContain('report.html');
    expect(result.jsonPath).toContain('reg.json');
  });

  test('passes matchingThreshold option', async () => {
    await runRegCli('/tmp/snapshots', { matchingThreshold: 0.05 });

    const args = execFile.mock.calls[0][1];
    const mIndex = args.indexOf('-M');
    expect(mIndex).toBeGreaterThan(-1);
    expect(args[mIndex + 1]).toBe('0.05');
  });

  test('passes thresholdRate option', async () => {
    await runRegCli('/tmp/snapshots', { thresholdRate: 0.1 });

    const args = execFile.mock.calls[0][1];
    const tIndex = args.indexOf('-T');
    expect(tIndex).toBeGreaterThan(-1);
    expect(args[tIndex + 1]).toBe('0.1');
  });

  test('rejects on JSON parse failure', async () => {
    fs.readFile.mockRejectedValue(new Error('File not found'));

    await expect(runRegCli('/tmp/snapshots')).rejects.toThrow('reg-cli output parse failed');
  });
});
