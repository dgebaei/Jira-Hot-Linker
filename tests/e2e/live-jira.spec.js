const {test, expect, configureExtension, hoverIssueKey, injectContentScript} = require('./helpers/extension-fixtures');
const {assertAllowedLiveIssue, getAllowedLiveIssueKeys, getLiveJiraConfig} = require('./helpers/live-jira');

function requireLiveConfig() {
  const config = getLiveJiraConfig();
  test.skip(!config.isConfigured, 'Set JIRA_LIVE_INSTANCE_URL, JIRA_LIVE_PROJECT_KEYS, and JIRA_LIVE_ISSUE_KEYS to enable private Jira tests.');
  return config;
}

function requireLiveAuthConfig() {
  const config = requireLiveConfig();
  test.skip(!config.hasAuth, 'Set JIRA_LIVE_STORAGE_STATE to enable authenticated private Jira tests.');
  return config;
}

async function openLiveIssuePage(extensionApp, issueUrl) {
  const page = await extensionApp.context.newPage();
  await page.goto(issueUrl, {waitUntil: 'domcontentloaded'});
  await injectContentScript(extensionApp, page);
  await expect.poll(async () => page.locator('._JX_container').count()).toBe(1);
  return page;
}

test('enforces the configured live Jira issue scope before running @live', async () => {
  const config = requireLiveConfig();
  const allowedIssueKeys = getAllowedLiveIssueKeys(config);

  expect(allowedIssueKeys.length).toBeGreaterThan(0);
  for (const issueKey of allowedIssueKeys) {
    expect(() => assertAllowedLiveIssue(issueKey, config)).not.toThrow();
  }
});

test('loads a popup only for explicitly allowed live Jira issues @live', async ({extensionApp, optionsPage}) => {
  const config = requireLiveAuthConfig();
  const allowedIssueKeys = getAllowedLiveIssueKeys(config);
  const issueKey = allowedIssueKeys[0];

  assertAllowedLiveIssue(issueKey, config);

  await configureExtension(optionsPage, {
    instanceUrl: config.instanceUrl,
    domains: [config.instanceUrl],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  }, true);

  const page = await openLiveIssuePage(extensionApp, `${config.instanceUrl.replace(/\/$/, '')}/browse/${issueKey}`);
  await hoverIssueKey(page, `text=${issueKey}`);
  await expect(page.locator('._JX_container')).toContainText(issueKey);
  await page.close();
});

test('uses authenticated storage state on an allowed live Jira issue @live', async ({extensionApp, optionsPage}) => {
  const config = requireLiveAuthConfig();
  const allowedIssueKeys = getAllowedLiveIssueKeys(config);
  const issueKey = allowedIssueKeys[0];

  assertAllowedLiveIssue(issueKey, config);

  await configureExtension(optionsPage, {
    instanceUrl: config.instanceUrl,
    domains: [config.instanceUrl],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  }, true);

  const page = await openLiveIssuePage(extensionApp, `${config.instanceUrl.replace(/\/$/, '')}/browse/${issueKey}`);
  await expect(page.locator('text=/Log in|Sign in/i')).toHaveCount(0);
  await hoverIssueKey(page, `text=${issueKey}`);
  await expect(page.locator('._JX_container')).toContainText(issueKey);
  await expect(page.locator('._JX_container')).not.toContainText('Not logged in');
  await page.close();
});
