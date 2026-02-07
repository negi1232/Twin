const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './__tests__/e2e',
  timeout: 30000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
});
