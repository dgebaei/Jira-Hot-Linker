require('./load-env-defaults');

const {spawnSync} = require('child_process');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const runWithBlobScript = path.join(repoRoot, 'scripts/playwright/run-with-blob.js');

const suites = [
  {label: 'mock-edge', args: ['--project=mock-edge']},
  {label: 'public-smoke', args: ['--project=public-smoke']},
  {label: 'live-authenticated', args: ['--project=live-authenticated']},
];

for (const suite of suites) {
  const result = spawnSync(process.execPath, [runWithBlobScript, ...suite.args], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
