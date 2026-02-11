/**
 * @module main/reg-runner
 * @description reg-cli を子プロセスとして実行し、画像差分の比較結果を取得する。
 * actual / expected ディレクトリのスクリーンショットを比較し、
 * HTML レポートと JSON サマリを生成する。
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');

/**
 * reg-cli を実行して画像比較を行い、結果を返す。
 * @param {string} snapshotDir - actual / expected / diff を含むベースディレクトリ
 * @param {Object} [options={}] - 比較オプション
 * @param {number} [options.matchingThreshold] - ピクセル差分の感度 (0〜1)
 * @param {number} [options.thresholdRate] - 変更検知率のしきい値 (0〜1)
 * @returns {Promise<{summary: {passed: number, failed: number, new: number, deleted: number}, reportPath: string, jsonPath: string, raw: Object}>}
 */
function runRegCli(snapshotDir, options = {}) {
  return new Promise((resolve, reject) => {
    const actualDir = path.join(snapshotDir, 'actual');
    const expectedDir = path.join(snapshotDir, 'expected');
    const diffDir = path.join(snapshotDir, 'diff');
    const reportPath = path.join(snapshotDir, 'report.html');
    const jsonPath = path.join(snapshotDir, 'reg.json');

    const args = [
      actualDir,
      expectedDir,
      diffDir,
      '-R', reportPath,
      '-J', jsonPath,
      '-I', // ignoreChange: don't throw on diff detection
    ];

    if (options.matchingThreshold != null) {
      args.push('-M', String(options.matchingThreshold));
    }
    if (options.thresholdRate != null) {
      args.push('-T', String(options.thresholdRate));
    }

    const regCliPath = require.resolve('reg-cli/dist/cli.js');
    execFile('node', [regCliPath, ...args], async (error, _stdout, stderr) => {
      try {
        const json = JSON.parse(await fs.readFile(jsonPath, 'utf-8'));
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
        reject(new Error(
          `reg-cli output parse failed: ${parseError.message}\nstderr: ${stderr}`
        ));
      }
    });
  });
}

module.exports = { runRegCli };
