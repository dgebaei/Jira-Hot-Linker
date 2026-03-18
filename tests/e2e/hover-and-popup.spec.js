const {test, expect, configureExtension, hoverIssueKey, injectContentScript} = require('./helpers/extension-fixtures');

function baseConfig(servers, overrides = {}) {
  return {
    instanceUrl: servers.jira.origin,
    domains: [servers.allowedPage.origin],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [{fieldId: 'customfield_12345', row: 2}],
    ...overrides,
  };
}

async function openAllowedPage(extensionApp, servers, route = '/popup-actions') {
  const page = await extensionApp.context.newPage();
  await page.goto(`${servers.allowedPage.origin}${route}`);
  await injectContentScript(extensionApp, page);
  await expect.poll(async () => page.locator('._JX_container').count()).toBe(1);
  return page;
}

test('injects only on configured domains', async ({extensionApp, optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers), true);
  await expect(optionsPage.locator('.saveNotice')).toContainText('Options saved successfully.');

  const allowed = await openAllowedPage(extensionApp, servers, '/');
  const disallowed = await extensionApp.context.newPage();
  await disallowed.goto(`${servers.disallowedPage.origin}/`);

  await expect.poll(async () => allowed.locator('._JX_container').count()).toBe(1);
  await expect.poll(async () => disallowed.locator('._JX_container').count()).toBe(0);

  await allowed.close();
  await disallowed.close();
});

test('respects exact, shallow, and deep hover detection modes', async ({extensionApp, optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers, {hoverDepth: 'exact'}), true);
  let page = await openAllowedPage(extensionApp, servers, '/hover-depth');
  await hoverIssueKey(page, '#exact-target');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  await page.keyboard.press('Escape');
  await hoverIssueKey(page, '#shallow-child');
  await expect(page.locator('._JX_container')).toBeEmpty();
  await page.close();

  await optionsPage.goto(`chrome-extension://${extensionApp.extensionId}/options/options.html`);
  await configureExtension(optionsPage, baseConfig(servers, {hoverDepth: 'shallow'}), true);
  page = await openAllowedPage(extensionApp, servers, '/hover-depth');
  await hoverIssueKey(page, '#shallow-child');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  await page.keyboard.press('Escape');
  await page.close();

  await optionsPage.goto(`chrome-extension://${extensionApp.extensionId}/options/options.html`);
  await configureExtension(optionsPage, baseConfig(servers, {hoverDepth: 'deep'}), true);
  page = await openAllowedPage(extensionApp, servers, '/hover-depth');
  await hoverIssueKey(page, '#deep-child');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  await page.close();
});

test('requires the configured modifier key before opening the popup', async ({extensionApp, optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers, {hoverModifierKey: 'shift'}), true);
  const page = await openAllowedPage(extensionApp, servers, '/popup-actions');

  await hoverIssueKey(page, '#popup-key');
  await expect(page.locator('._JX_container')).toBeEmpty();

  await hoverIssueKey(page, '#popup-key', 'Shift');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  await page.close();
});

test('supports pinning and closing the popup', async ({extensionApp, optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers), true);
  const page = await openAllowedPage(extensionApp, servers, '/popup-actions');

  await hoverIssueKey(page, '#popup-key');
  const popup = page.locator('._JX_container');
  await expect(popup).toContainText('JRACLOUD-97846');

  await page.locator('._JX_pin_button').click();
  await expect(page.locator('body')).toContainText(/Pinned/i);

  await page.mouse.move(5, 5);
  await expect(popup).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(popup).toBeEmpty();
  await page.close();
});
