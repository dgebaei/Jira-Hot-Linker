const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const targets = [
  path.join(repoRoot, 'tests/output/playwright/blob-report'),
  path.join(repoRoot, 'tests/output/playwright/report'),
  path.join(repoRoot, 'tests/output/playwright/test-results'),
];

for (const target of targets) {
  fs.rmSync(target, {recursive: true, force: true});
}

console.log('Cleared Playwright report data.');
