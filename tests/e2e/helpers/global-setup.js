const fs = require('fs');
const path = require('path');
const {execFileSync} = require('child_process');

module.exports = async () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const outputDir = path.join(repoRoot, 'tests/output/playwright');
  fs.mkdirSync(outputDir, {recursive: true});
  execFileSync('npx', ['webpack', '--mode=development'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
};
