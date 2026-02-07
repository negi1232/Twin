const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './__tests__/e2e',
  timeout: 60000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'always' }]],
  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },
});
