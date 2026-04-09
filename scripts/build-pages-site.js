const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..');
const docsDir = path.join(repoRoot, 'docs');
const readmePath = path.join(repoRoot, 'README.md');
const userGuidePath = path.join(docsDir, 'user-guide.md');
const outputDir = path.join(repoRoot, '.site-build');
const faviconSvgPath = path.join(docsDir, 'branding', 'jira-quickview-mark.svg');
const faviconPngPath = path.join(docsDir, 'branding', 'jira-quickview-mark-128.png');

function renderMarkdownHtml(markdownPath) {
  try {
    return execFileSync('pandoc', [markdownPath, '--from=gfm', '--to=html5', '--wrap=none'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
  } catch (error) {
    throw new Error('pandoc is required to build the Pages site from Markdown files');
  }
}

function rewriteDocsLinks(html) {
  return html
    .replace(/href="docs\/user-guide\.md"/g, 'href="user-guide.html"')
    .replace(/(src|href)="docs\//g, '$1="');
}

function buildPageHtml({title, description, bodyHtml}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <link rel="icon" href="favicon.png" type="image/png" sizes="128x128">
  <link rel="apple-touch-icon" href="favicon.png">
  <link rel="stylesheet" href="site.css">
</head>
<body>
  <main class="page page-narrow">
    <article class="readme-render">
${bodyHtml}
    </article>
  </main>
  <script src="site.js"></script>
</body>
</html>
`;
}

function buildReadmeSite() {
  const renderedReadme = rewriteDocsLinks(renderMarkdownHtml(readmePath));
  const renderedUserGuide = rewriteDocsLinks(renderMarkdownHtml(userGuidePath));

  const indexHtml = buildPageHtml({
    title: 'Jira QuickView',
    description: 'Act on Jira issues from Gmail, Outlook, GitHub, docs, and other enabled pages without opening a new Jira tab.',
    bodyHtml: renderedReadme,
  });
  const userGuideHtml = buildPageHtml({
    title: 'Jira QuickView User Guide',
    description: 'Detailed setup and day-to-day usage guide for the Jira QuickView Chrome extension.',
    bodyHtml: renderedUserGuide,
  });

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.cpSync(path.join(docsDir, 'privacy-policy.html'), path.join(outputDir, 'privacy-policy.html'));
  fs.cpSync(path.join(docsDir, 'site.css'), path.join(outputDir, 'site.css'));
  fs.cpSync(path.join(docsDir, 'site.js'), path.join(outputDir, 'site.js'));
  fs.cpSync(faviconSvgPath, path.join(outputDir, 'favicon.svg'));
  fs.cpSync(faviconPngPath, path.join(outputDir, 'favicon.png'));
  fs.cpSync(path.join(docsDir, 'screenshots'), path.join(outputDir, 'screenshots'), { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml);
  fs.writeFileSync(path.join(outputDir, 'user-guide.html'), userGuideHtml);

  console.log(`Built Pages site in ${outputDir}`);
}

buildReadmeSite();
