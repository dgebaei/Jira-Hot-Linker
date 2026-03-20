const {spawnSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const blobDir = path.join(repoRoot, 'tests/output/playwright/blob-report');
const reportDir = path.join(repoRoot, 'tests/output/playwright/report');
const reportIndexPath = path.join(reportDir, 'index.html');

if (!fs.existsSync(blobDir)) {
  console.log(`Merged report not available yet: ${reportIndexPath}`);
  process.exit(0);
}

const blobFiles = fs.readdirSync(blobDir).filter(fileName => fileName.endsWith('.zip'));
if (!blobFiles.length) {
  console.log(`Merged report not available yet: ${reportIndexPath}`);
  process.exit(0);
}

const env = {
  ...process.env,
  PLAYWRIGHT_HTML_OUTPUT_DIR: reportDir,
  PLAYWRIGHT_HTML_OPEN: 'never',
};

const suiteMeta = {
  'advanced-mock-flows.spec.js': 'Editing, Assignment, and Workflow Actions',
  'error-states.spec.js': 'Connection and Access States',
  'hover-and-popup.spec.js': 'Popup Trigger Behavior',
  'live-jira.spec.js': 'Authenticated Jira Mutations',
  'mock-jira-flows.spec.js': 'Issue Content and Comment Workflows',
  'options.spec.js': 'Extension Settings and Validation',
  'partial-failures.spec.js': 'Partial Failure Recovery',
  'public-jira.spec.js': 'Public Jira Smoke Coverage',
};

if (result.status === 0) {
  console.log(`Merged Playwright report: ${reportIndexPath}`);
}

process.exit(result.status || 0);
