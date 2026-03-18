const {test, expect, configureExtension, hoverIssueKey, injectContentScript} = require('./helpers/extension-fixtures');

function unreachableConfig(servers) {
  return {
    instanceUrl: 'http://127.0.0.1:9/',
    domains: [servers.allowedPage.origin],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  };
}

function reachableConfig(servers) {
  return {
    instanceUrl: servers.jira.origin,
    domains: [servers.allowedPage.origin],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  };
}

async function openAllowedPage(extensionApp, servers) {
  const page = await extensionApp.context.newPage();
  await page.goto(`${servers.allowedPage.origin}/popup-actions`);
  await injectContentScript(extensionApp, page);
  await expect.poll(async () => page.locator('._JX_container').count()).toBe(1);
  return page;
}

test('surfaces a connection error when Jira is unreachable', async ({extensionApp, optionsPage, servers}) => {
  await configureExtension(optionsPage, unreachableConfig(servers), true);
  const page = await openAllowedPage(extensionApp, servers);

  await hoverIssueKey(page, '#popup-key');
  await expect(page.locator('body')).toContainText('Could not reach Jira');
  await page.close();
});

test('does not render a popup when the user is not logged in and Jira returns 401', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('unauthorized');
  await configureExtension(optionsPage, reachableConfig(servers), true);
  const page = await openAllowedPage(extensionApp, servers);

  await hoverIssueKey(page, '#popup-key');
  await expect(page.locator('._JX_container')).toBeEmpty();
  await page.close();
});

test('falls back to a read-only popup when Jira is viewable anonymously', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('anonymous-readonly');
  await configureExtension(optionsPage, reachableConfig(servers), true);
  const page = await openAllowedPage(extensionApp, servers);

  await hoverIssueKey(page, '#popup-key');
  const popup = page.locator('._JX_container');
  await expect(popup).toContainText('JRACLOUD-97846');
  await expect(page.locator('._JX_actions_toggle')).toHaveCount(0);
  await expect(page.locator('button[data-field-key="priority"]')).toHaveCount(0);
  await page.close();
});
