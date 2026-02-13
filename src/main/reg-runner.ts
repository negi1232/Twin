/**
 * @module main/reg-runner
 * @description reg-cli を子プロセスとして実行し、画像差分の比較結果を取得する。
 * actual / expected ディレクトリのスクリーンショットを比較し、
 * HTML レポートと JSON サマリを生成する。
 */

import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface RegCliOptions {
  matchingThreshold?: number | null;
  thresholdRate?: number | null;
}

interface RegCliRawJson {
  passedItems: string[];
  failedItems: string[];
  newItems: string[];
  deletedItems: string[];
  [key: string]: unknown;
}

/**
 * reg-cli を実行して画像比較を行い、結果を返す。
 * @param snapshotDir - actual / expected / diff を含むベースディレクトリ
 * @param options - 比較オプション
 */
function runRegCli(snapshotDir: string, options: RegCliOptions = {}): Promise<RegCliResult> {
  return new Promise((resolve, reject) => {
    const actualDir = path.join(snapshotDir, 'actual');
    const expectedDir = path.join(snapshotDir, 'expected');
    const diffDir = path.join(snapshotDir, 'diff');
    const reportPath = path.join(snapshotDir, 'report.html');
    const jsonPath = path.join(snapshotDir, 'reg.json');

    const args: string[] = [
      actualDir,
      expectedDir,
      diffDir,
      '-R',
      reportPath,
      '-J',
      jsonPath,
      '-I', // ignoreChange: don't throw on diff detection
    ];

    if (options.matchingThreshold != null) {
      args.push('-M', String(options.matchingThreshold));
    }
    if (options.thresholdRate != null) {
      args.push('-T', String(options.thresholdRate));
    }

    const regCliPath = require.resolve('reg-cli/dist/cli.js');
    execFile('node', [regCliPath, ...args], async (execError, _stdout, stderr) => {
      try {
        const json: RegCliRawJson = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
        resolve({
          summary: {
            passed: json.passedItems.length,
            failed: json.failedItems.length,
            new: json.newItems.length,
            deleted: json.deletedItems.length,
          },
          reportPath,
          jsonPath,
          raw: json,
        });
      } catch (parseError) {
        const parts = [`reg-cli output parse failed: ${(parseError as Error).message}`];
        if (execError) parts.push(`execError: ${execError.message}`);
        if (stderr) parts.push(`stderr: ${stderr}`);
        reject(new Error(parts.join('\n')));
      }
    });
  });
}

export { runRegCli };
