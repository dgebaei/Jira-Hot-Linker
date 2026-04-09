const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');
const readmePath = path.join(repoRoot, 'README.md');
const outputDir = path.join(repoRoot, '.site-build');
const faviconSvgPath = path.join(docsDir, 'branding', 'jira-quickview-mark.svg');
const faviconPngPath = path.join(docsDir, 'branding', 'jira-quickview-mark-128.png');

function renderReadmeHtml() {
  try {
    return execFileSync('pandoc', [readmePath, '--from=gfm', '--to=html5', '--wrap=none'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    throw new Error('pandoc is required to build the Pages site from README.md');
  }
}

function buildReadmeSite() {
  const renderedReadme = renderReadmeHtml()
    .replace(/(src|href)="docs\//g, '$1="');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Jira QuickView</title>
  <meta name="description" content="Act on Jira issues from Gmail, Outlook, GitHub, docs, and other enabled pages without opening a new Jira tab.">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="icon" href="favicon.png" type="image/png" sizes="128x128">
  <link rel="apple-touch-icon" href="favicon.png">
  <link rel="stylesheet" href="site.css">
</head>
<body>
  <main class="page page-narrow">
    <article class="readme-render">
${renderedReadme}
    </article>
  </main>
  <script src="site.js"></script>
</body>
</html>
`;

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(path.join(docsDir, 'privacy-policy.html'), path.join(outputDir, 'privacy-policy.html'));
  fs.cpSync(path.join(docsDir, 'site.css'), path.join(outputDir, 'site.css'));
  fs.cpSync(path.join(docsDir, 'site.js'), path.join(outputDir, 'site.js'));
  fs.cpSync(faviconSvgPath, path.join(outputDir, 'favicon.svg'));
  fs.cpSync(faviconPngPath, path.join(outputDir, 'favicon.png'));
  fs.cpSync(path.join(docsDir, 'screenshots'), path.join(outputDir, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), html);

  console.log(`Built Pages site in ${outputDir}`);
}

buildReadmeSite();
