const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const {chromium} = require('playwright');

const repoRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(repoRoot, 'tests', 'e2e', 'fixtures', 'mock-assets');

async function findChromeExecutable() {
  const browsersRoot = path.join(os.homedir(), '.agent-browser', 'browsers');
  const entries = await fs.readdir(browsersRoot, {withFileTypes: true});
  const candidates = entries
    .filter(entry => entry.isDirectory() && /^chrome-\d/.test(entry.name))
    .map(entry => path.join(browsersRoot, entry.name, 'chrome'))
    .sort()
    .reverse();

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (_error) {
      // Ignore missing candidate.
    }
  }

  throw new Error('Could not find a Chrome executable under ~/.agent-browser/browsers.');
}

function buildDocument({title, width, height, styles, body}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      body {
        background: #edf2f7;
      }
      #frame {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
      }
      ${styles}
    </style>
  </head>
  <body>
    <div id="frame">${body}</div>
  </body>
</html>`;
}

function assetSpecs() {
  return [
    {
      fileName: 'evidence.png',
      width: 1440,
      height: 900,
      styles: `
        #frame {
          background:
            radial-gradient(circle at 12% 16%, rgba(14, 165, 233, 0.20), transparent 28%),
            radial-gradient(circle at 88% 82%, rgba(16, 185, 129, 0.16), transparent 22%),
            linear-gradient(160deg, #f4f8fb 0%, #edf2f7 48%, #e3ebf5 100%);
          padding: 54px;
        }
        .window {
          height: 100%;
          display: grid;
          grid-template-columns: 250px 1fr;
          border-radius: 28px;
          overflow: hidden;
          background: rgba(255,255,255,0.9);
          box-shadow: 0 32px 80px rgba(15, 23, 42, 0.18);
        }
        .sidebar {
          background: linear-gradient(180deg, #0f172a 0%, #16233b 100%);
          color: rgba(255,255,255,0.82);
          padding: 26px 22px;
        }
        .nav-pill {
          padding: 12px 14px;
          border-radius: 14px;
          margin-bottom: 10px;
          font-size: 14px;
          background: rgba(255,255,255,0.06);
        }
        .nav-pill.active {
          background: rgba(56, 189, 248, 0.18);
          color: #d7f3ff;
        }
        .content {
          padding: 28px 32px;
          display: grid;
          grid-template-rows: auto auto 1fr;
          gap: 18px;
          color: #0f172a;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .title {
          font-size: 30px;
          font-weight: 800;
          letter-spacing: -0.03em;
        }
        .badge {
          background: #dcfce7;
          color: #166534;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 700;
        }
        .issue-card {
          border: 1px solid #d9e2ec;
          border-radius: 20px;
          padding: 22px;
          background: #f8fbff;
        }
        .issue-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 18px;
        }
        .panel {
          border: 1px solid #d9e2ec;
          border-radius: 18px;
          background: white;
          padding: 18px;
        }
        .panel h3 {
          margin: 0 0 12px;
          font-size: 15px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #64748b;
        }
        .text-line {
          height: 12px;
          border-radius: 999px;
          background: linear-gradient(90deg, #dbeafe, #bfdbfe);
          margin-bottom: 10px;
        }
        .editor {
          border: 2px solid #fb7185;
          border-radius: 16px;
          background: #fff1f2;
          padding: 18px;
          box-shadow: inset 0 0 0 1px rgba(244,63,94,0.12);
        }
        .editor .row {
          height: 16px;
          border-radius: 8px;
          background: #fecdd3;
          margin-bottom: 12px;
        }
        .callout {
          margin-top: 14px;
          padding: 12px 14px;
          border-radius: 14px;
          background: #fee2e2;
          color: #991b1b;
          font-size: 14px;
          font-weight: 700;
        }
        .metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 14px;
        }
        .metric {
          background: white;
          border: 1px solid #d9e2ec;
          border-radius: 16px;
          padding: 14px;
        }
        .metric strong {
          display: block;
          font-size: 24px;
          margin-bottom: 6px;
        }
        .metric span {
          color: #64748b;
          font-size: 13px;
        }
      `,
      body: `
        <div class="window">
          <aside class="sidebar">
            <div class="nav-pill active">Issue Evidence</div>
            <div class="nav-pill">Regression Notes</div>
            <div class="nav-pill">Customer Reports</div>
            <div class="nav-pill">Release Tasks</div>
          </aside>
          <section class="content">
            <div class="topbar">
              <div class="title">JRACLOUD-97846 Evidence</div>
              <div class="badge">Ready for review</div>
            </div>
            <div class="issue-card">
              <div class="issue-grid">
                <div class="panel">
                  <h3>Reproduction</h3>
                  <div class="text-line" style="width: 92%"></div>
                  <div class="text-line" style="width: 88%"></div>
                  <div class="text-line" style="width: 76%"></div>
                  <div class="editor">
                    <div class="row" style="width: 86%"></div>
                    <div class="row" style="width: 93%"></div>
                    <div class="row" style="width: 68%"></div>
                    <div class="callout">END key deletes slash-prefixed text after multiline wrap</div>
                  </div>
                </div>
                <div class="panel">
                  <h3>Impact</h3>
                  <div class="metrics">
                    <div class="metric"><strong>3</strong><span>teams blocked</span></div>
                    <div class="metric"><strong>7</strong><span>repros logged</span></div>
                    <div class="metric"><strong>95%</strong><span>fix confidence</span></div>
                  </div>
                </div>
              </div>
            </div>
            <div class="panel">
              <h3>Validation Notes</h3>
              <div class="text-line" style="width: 98%"></div>
              <div class="text-line" style="width: 82%"></div>
              <div class="text-line" style="width: 90%"></div>
            </div>
          </section>
        </div>
      `,
    },
    {
      fileName: 'history-image-1.png',
      width: 1180,
      height: 820,
      styles: `
        #frame {
          background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
          padding: 38px;
        }
        .card {
          height: 100%;
          border-radius: 24px;
          background: white;
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.15);
          padding: 24px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 18px;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.03em;
          color: #0f172a;
        }
        .label {
          padding: 8px 12px;
          border-radius: 999px;
          background: #ede9fe;
          color: #6d28d9;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: 18px;
          height: calc(100% - 66px);
        }
        .chart {
          border: 1px solid #dbe3f0;
          border-radius: 18px;
          padding: 18px;
          background: #fbfdff;
        }
        .bars {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 10px;
          align-items: end;
          height: 290px;
          margin-top: 16px;
        }
        .bar {
          border-radius: 14px 14px 6px 6px;
          background: linear-gradient(180deg, #38bdf8, #2563eb);
        }
        .notes {
          border: 1px solid #dbe3f0;
          border-radius: 18px;
          background: #0f172a;
          color: white;
          padding: 18px;
        }
        .note {
          border-radius: 14px;
          padding: 14px;
          background: rgba(255,255,255,0.07);
          margin-bottom: 12px;
          font-size: 14px;
          line-height: 1.45;
        }
      `,
      body: `
        <div class="card">
          <div class="header">
            <h1>Internal Report Preview</h1>
            <div class="label">Email Channel</div>
          </div>
          <div class="layout">
            <div class="chart">
              <div style="display:flex;gap:14px;color:#64748b;font-size:13px;font-weight:700">
                <span>Weekly deliveries</span><span>Incident rate</span><span>Conversion</span>
              </div>
              <div class="bars">
                <div class="bar" style="height:42%"></div>
                <div class="bar" style="height:58%"></div>
                <div class="bar" style="height:63%"></div>
                <div class="bar" style="height:54%"></div>
                <div class="bar" style="height:78%"></div>
                <div class="bar" style="height:74%"></div>
                <div class="bar" style="height:88%"></div>
              </div>
            </div>
            <div class="notes">
              <div class="note">Rendered report no longer matches the Email option after export.</div>
              <div class="note">Spacing drifts on multiline content blocks and summary rows.</div>
              <div class="note">Captured before/after state for product review.</div>
            </div>
          </div>
        </div>
      `,
    },
    {
      fileName: 'history-image-2.png',
      width: 1180,
      height: 760,
      styles: `
        #frame {
          background: linear-gradient(180deg, #fff7ed 0%, #fffbf5 100%);
          padding: 34px;
        }
        .canvas {
          height: 100%;
          border-radius: 24px;
          border: 1px solid #fed7aa;
          background: white;
          box-shadow: 0 18px 42px rgba(124, 45, 18, 0.10);
          padding: 22px;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .header h1 {
          margin: 0;
          font-size: 26px;
          color: #9a3412;
          letter-spacing: -0.03em;
        }
        .pill {
          padding: 8px 12px;
          border-radius: 999px;
          background: #ffedd5;
          color: #c2410c;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
        }
        .layout {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 18px;
          height: calc(100% - 58px);
        }
        .panel {
          border-radius: 18px;
          border: 1px solid #fdba74;
          background: #fffaf5;
          padding: 18px;
        }
        .panel h2 {
          margin: 0 0 12px;
          font-size: 15px;
          color: #9a3412;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .line {
          height: 10px;
          border-radius: 999px;
          background: linear-gradient(90deg, #fdba74, #fb923c);
          margin-bottom: 9px;
        }
        .mail {
          display: grid;
          grid-template-columns: 190px 1fr;
          gap: 14px;
          margin-top: 14px;
        }
        .sidebar {
          border-radius: 14px;
          background: #fff;
          border: 1px solid #fed7aa;
          padding: 12px;
        }
        .mail-main {
          border-radius: 14px;
          background: #fff;
          border: 1px solid #fed7aa;
          padding: 14px;
        }
        .screen-line {
          height: 8px;
          border-radius: 999px;
          background: #1f2937;
          opacity: 0.18;
          margin-bottom: 8px;
        }
        .highlight {
          margin-top: 18px;
          border-radius: 16px;
          background: #fff;
          border: 1px solid #fdba74;
          padding: 16px;
        }
        .metric-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 14px;
        }
        .metric {
          border-radius: 14px;
          background: #fff7ed;
          border: 1px solid #fed7aa;
          padding: 12px;
        }
        .metric strong {
          display: block;
          color: #9a3412;
          font-size: 22px;
          margin-bottom: 6px;
        }
        .metric span {
          color: #7c2d12;
          font-size: 12px;
        }
      `,
      body: `
        <div class="canvas">
          <div class="header">
            <h1>Export Layout Comparison</h1>
            <div class="pill">Expected Match</div>
          </div>
          <div class="layout">
            <div class="panel">
              <h2>Email Preview</h2>
              <div class="line" style="width:82%"></div>
              <div class="line" style="width:70%"></div>
              <div class="mail">
                <div class="sidebar">
                  <div class="line" style="width:88%"></div>
                  <div class="line" style="width:76%"></div>
                  <div class="line" style="width:64%"></div>
                </div>
                <div class="mail-main">
                  <div class="screen-line" style="width:95%"></div>
                  <div class="screen-line" style="width:84%"></div>
                  <div class="screen-line" style="width:72%"></div>
                  <div class="screen-line" style="width:91%"></div>
                  <div class="screen-line" style="width:68%"></div>
                </div>
              </div>
            </div>
            <div>
              <div class="panel">
                <h2>Report Check</h2>
                <div class="line" style="width:90%"></div>
                <div class="line" style="width:76%"></div>
                <div class="line" style="width:84%"></div>
                <div class="highlight">
                  <div class="line" style="width:94%"></div>
                  <div class="line" style="width:82%"></div>
                  <div class="line" style="width:68%"></div>
                </div>
              </div>
              <div class="metric-grid">
                <div class="metric"><strong>3</strong><span>views checked</span></div>
                <div class="metric"><strong>0</strong><span>spacing regressions</span></div>
                <div class="metric"><strong>1</strong><span>approved export</span></div>
              </div>
            </div>
          </div>
        </div>
      `,
    },
    {
      fileName: 'standalone-graph.png',
      width: 1280,
      height: 820,
      styles: `
        #frame {
          background: linear-gradient(180deg, #ecfeff 0%, #f8fafc 100%);
          padding: 42px;
        }
        .chart-card {
          height: 100%;
          border-radius: 28px;
          background: white;
          box-shadow: 0 28px 70px rgba(15, 23, 42, 0.14);
          padding: 26px 28px 22px;
          color: #0f172a;
        }
        .eyebrow {
          color: #0f766e;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }
        h1 {
          margin: 8px 0 14px;
          font-size: 34px;
          letter-spacing: -0.04em;
        }
        .sub {
          color: #64748b;
          font-size: 15px;
          margin-bottom: 20px;
        }
        .graph {
          position: relative;
          height: 540px;
          border-radius: 20px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
            linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          background-size: 100% 90px, 120px 100%, 100% 100%;
          border: 1px solid #d9e2ec;
          overflow: hidden;
        }
        svg {
          position: absolute;
          inset: 0;
        }
        .legend {
          display: flex;
          gap: 18px;
          margin-top: 16px;
          color: #475569;
          font-size: 14px;
        }
        .legend span::before {
          content: "";
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-right: 8px;
          vertical-align: middle;
        }
        .legend .line1::before { background: #0ea5e9; }
        .legend .line2::before { background: #14b8a6; }
      `,
      body: `
        <div class="chart-card">
          <div class="eyebrow">Release Analytics</div>
          <h1>Regression Volume vs. Fix Confidence</h1>
          <div class="sub">Final QA pass before publishing the Jira QuickView update.</div>
          <div class="graph">
            <svg viewBox="0 0 1200 540" preserveAspectRatio="none">
              <defs>
                <linearGradient id="fillA" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.02" />
                </linearGradient>
                <linearGradient id="fillB" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.22" />
                  <stop offset="100%" stop-color="#14b8a6" stop-opacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M40 430 C140 410, 180 350, 260 332 S430 250, 520 280 S700 190, 780 165 S960 115, 1160 92 L1160 540 L40 540 Z" fill="url(#fillA)"></path>
              <path d="M40 472 C130 448, 200 392, 280 378 S430 290, 540 255 S700 228, 820 198 S980 150, 1160 126 L1160 540 L40 540 Z" fill="url(#fillB)"></path>
              <path d="M40 430 C140 410, 180 350, 260 332 S430 250, 520 280 S700 190, 780 165 S960 115, 1160 92" fill="none" stroke="#0ea5e9" stroke-width="6" stroke-linecap="round"></path>
              <path d="M40 472 C130 448, 200 392, 280 378 S430 290, 540 255 S700 228, 820 198 S980 150, 1160 126" fill="none" stroke="#14b8a6" stroke-width="6" stroke-linecap="round"></path>
              <circle cx="780" cy="165" r="10" fill="#0ea5e9"></circle>
              <circle cx="820" cy="198" r="10" fill="#14b8a6"></circle>
            </svg>
          </div>
          <div class="legend">
            <span class="line1">Issue volume</span>
            <span class="line2">Fix confidence</span>
          </div>
        </div>
      `,
    },
  ];
}

async function renderAsset(page, spec) {
  await page.setViewportSize({width: spec.width, height: spec.height});
  await page.setContent(buildDocument(spec), {waitUntil: 'load'});
  await page.locator('#frame').screenshot({
    path: path.join(outputDir, spec.fileName),
    type: 'png',
  });
}

async function main() {
  await fs.mkdir(outputDir, {recursive: true});
  const executablePath = await findChromeExecutable();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--force-device-scale-factor=2',
      '--high-dpi-support=2',
    ],
  });

  try {
    const page = await browser.newPage({deviceScaleFactor: 2});
    for (const spec of assetSpecs()) {
      await renderAsset(page, spec);
    }
  } finally {
    await browser.close();
  }

  const files = (await fs.readdir(outputDir)).filter(name => name.endsWith('.png')).sort();
  console.log(JSON.stringify({outputDir, files}, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
