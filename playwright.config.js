const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './__tests__/e2e',
  timeout: 60000,
  retries: 1,
  workers: 3,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
