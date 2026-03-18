const {test, expect, configureExtension, hoverIssueKey, injectContentScript} = require('./helpers/extension-fixtures');

async function openPublicPage(extensionApp, url) {
  const page = await extensionApp.context.newPage();
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await injectContentScript(extensionApp, page);
  await expect.poll(async () => page.locator('._JX_container').count()).toBe(1);
  return page;
}

test('loads a popup on the public Atlassian issue page @public', async ({extensionApp, optionsPage}) => {
  test.skip(process.env.RUN_PUBLIC_JIRA_TESTS !== '1', 'Set RUN_PUBLIC_JIRA_TESTS=1 to run live public Jira smoke tests.');

  await configureExtension(optionsPage, {
    instanceUrl: 'https://jira.atlassian.com/',
    domains: ['https://jira.atlassian.com/'],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  }, true);

  const page = await openPublicPage(extensionApp, 'https://jira.atlassian.com/browse/JRACLOUD-97846');

  await hoverIssueKey(page, 'text=JRACLOUD-97846');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  await page.close();
});

test('loads a popup from the public Atlassian search results page @public', async ({extensionApp, optionsPage}) => {
  test.skip(process.env.RUN_PUBLIC_JIRA_TESTS !== '1', 'Set RUN_PUBLIC_JIRA_TESTS=1 to run live public Jira smoke tests.');

  await configureExtension(optionsPage, {
    instanceUrl: 'https://jira.atlassian.com/',
    domains: ['https://jira.atlassian.com/'],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  }, true);

  const page = await openPublicPage(extensionApp, 'https://jira.atlassian.com/issues/?jql=project%3DJRACLOUD%20AND%20type%3DBug%20AND%20statusCategory!%3DDone%20ORDER%20BY%20updated');
  await hoverIssueKey(page, 'text=JRACLOUD-97846');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  await page.close();
});
