const { mkdir, writeFile } = require('fs/promises');
const path = require('path');

async function captureScreenshots(leftView, rightView, snapshotDir, pageName) {
  const timestamp = Date.now();
  const fileName = `${pageName}_${timestamp}.png`;

  await mkdir(path.join(snapshotDir, 'expected'), { recursive: true });
  await mkdir(path.join(snapshotDir, 'actual'), { recursive: true });

  const [leftImage, rightImage] = await Promise.all([
    leftView.webContents.capturePage(),
    rightView.webContents.capturePage(),
  ]);

  await Promise.all([
    writeFile(path.join(snapshotDir, 'expected', fileName), leftImage.toPNG()),
    writeFile(path.join(snapshotDir, 'actual', fileName), rightImage.toPNG()),
  ]);

  return fileName;
}

module.exports = { captureScreenshots };
