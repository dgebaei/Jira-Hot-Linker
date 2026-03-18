const path = require('path');

const testResultsDir = process.env.PLAYWRIGHT_OUTPUT_DIR
  ? path.resolve(__dirname, process.env.PLAYWRIGHT_OUTPUT_DIR)
  : path.join(__dirname, 'tests/output/playwright/test-results');

module.exports = {
  testDir: path.join(__dirname, 'tests/e2e'),
  timeout: 90 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['blob', {outputDir: path.join(__dirname, 'tests/output/playwright/blob-report')}],
  ],
  outputDir: testResultsDir,
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },
  globalSetup: path.join(__dirname, 'tests/e2e/helpers/global-setup.js'),
  projects: [
    {
      name: 'extension',
      testIgnore: /(?:^|\/)public-jira\.spec\.js$|(?:^|\/)live-jira\.spec\.js$/,
    },
    {
      name: 'public-jira',
      grep: /@public/,
    },
    {
      name: 'live-jira',
      grep: /@live/,
    },
  ],
};
