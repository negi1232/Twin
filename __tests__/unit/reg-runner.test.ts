export {};

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

    execFile.mockImplementation((_cmd: any, _args: any, callback: any) => {
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

  test('passes both matchingThreshold and thresholdRate together', async () => {
    await runRegCli('/tmp/snapshots', { matchingThreshold: 0.02, thresholdRate: 0.05 });

    const args = execFile.mock.calls[0][1];
    const mIndex = args.indexOf('-M');
    const tIndex = args.indexOf('-T');
    expect(mIndex).toBeGreaterThan(-1);
    expect(args[mIndex + 1]).toBe('0.02');
    expect(tIndex).toBeGreaterThan(-1);
    expect(args[tIndex + 1]).toBe('0.05');
  });

  test('does not add -M when matchingThreshold is not provided', async () => {
    await runRegCli('/tmp/snapshots', { thresholdRate: 0.1 });

    const args = execFile.mock.calls[0][1];
    expect(args.indexOf('-M')).toBe(-1);
  });

  test('does not add -T when thresholdRate is not provided', async () => {
    await runRegCli('/tmp/snapshots', { matchingThreshold: 0.1 });

    const args = execFile.mock.calls[0][1];
    expect(args.indexOf('-T')).toBe(-1);
  });

  test('defaults to no options when none provided', async () => {
    await runRegCli('/tmp/snapshots');

    const args = execFile.mock.calls[0][1];
    expect(args.indexOf('-M')).toBe(-1);
    expect(args.indexOf('-T')).toBe(-1);
    expect(args).toContain('-I');
  });

  test('includes -I (ignoreChange) flag in all calls', async () => {
    await runRegCli('/tmp/snapshots');

    const args = execFile.mock.calls[0][1];
    expect(args).toContain('-I');
  });

  test('resolves even when execFile receives error (reg-cli exits non-zero on diffs)', async () => {
    execFile.mockImplementation((_cmd: any, _args: any, callback: any) => {
      callback(new Error('Process exited with code 1'), '', 'some stderr');
    });

    const result = await runRegCli('/tmp/snapshots');
    expect(result.summary).toEqual({
      passed: 1,
      failed: 1,
      new: 1,
      deleted: 0,
    });
  });

  test('rejects with stderr content in error message', async () => {
    fs.readFile.mockRejectedValue(new Error('ENOENT'));
    execFile.mockImplementation((_cmd: any, _args: any, callback: any) => {
      callback(null, '', 'warning: some stderr output');
    });

    await expect(runRegCli('/tmp/snapshots')).rejects.toThrow('warning: some stderr output');
  });

  test('returns raw JSON output in result', async () => {
    const result = await runRegCli('/tmp/snapshots');
    expect(result.raw).toBeDefined();
    expect(result.raw.failedItems).toEqual(['page-top.png']);
    expect(result.raw.passedItems).toEqual(['page-footer.png']);
    expect(result.raw.newItems).toEqual(['page-new.png']);
  });

  test('handles empty JSON arrays correctly', async () => {
    fs.readFile.mockResolvedValue(JSON.stringify({
      failedItems: [],
      newItems: [],
      deletedItems: [],
      passedItems: [],
      expectedItems: [],
      actualItems: [],
      diffItems: [],
    }));

    const result = await runRegCli('/tmp/snapshots');
    expect(result.summary).toEqual({ passed: 0, failed: 0, new: 0, deleted: 0 });
  });

  test('uses correct directory paths', async () => {
    await runRegCli('/project/snapshots');

    const args = execFile.mock.calls[0][1];
    // The first few args after reg-cli path are: actualDir, expectedDir, diffDir
    // Find them by checking path patterns
    expect(args.some((a: any) => typeof a === 'string' && a.includes('actual'))).toBe(true);
    expect(args.some((a: any) => typeof a === 'string' && a.includes('expected'))).toBe(true);
    expect(args.some((a: any) => typeof a === 'string' && a.includes('diff'))).toBe(true);
    expect(args.some((a: any) => typeof a === 'string' && a.includes('report.html'))).toBe(true);
    expect(args.some((a: any) => typeof a === 'string' && a.includes('reg.json'))).toBe(true);
  });

  test('matchingThreshold 0 is passed as string "0"', async () => {
    await runRegCli('/tmp/snapshots', { matchingThreshold: 0 });

    const args = execFile.mock.calls[0][1];
    const mIndex = args.indexOf('-M');
    expect(mIndex).toBeGreaterThan(-1);
    expect(args[mIndex + 1]).toBe('0');
  });
});
