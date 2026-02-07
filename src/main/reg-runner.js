const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs/promises');

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
