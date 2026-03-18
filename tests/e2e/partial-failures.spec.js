const {test, expect, configureExtension, hoverIssueKey, injectContentScript} = require('./helpers/extension-fixtures');

function baseConfig(servers) {
  return {
    instanceUrl: servers.jira.origin,
    domains: [servers.allowedPage.origin],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [{fieldId: 'customfield_12345', row: 2}],
  };
}

async function openPopup(extensionApp, servers) {
  const page = await extensionApp.context.newPage();
  await page.goto(`${servers.allowedPage.origin}/popup-actions`);
  await injectContentScript(extensionApp, page);
  await expect.poll(async () => page.locator('._JX_container').count()).toBe(1);
  await hoverIssueKey(page, '#popup-key');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  return page;
}

test('keeps core issue rendering when pull request endpoints fail', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('pr-data-fails');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  const popup = page.locator('._JX_container');
  await expect(popup).toContainText('Pressing END removes non-command text');
  await expect(popup).not.toContainText('Fix slash command cursor behavior');
  await expect(page.locator('._JX_related_pr')).toHaveCount(0);
  await page.close();
});

test('keeps the popup usable when pull request payloads are malformed', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('pr-data-malformed');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  const popup = page.locator('._JX_container');
  await expect(popup).toContainText('Initial comment with a link');
  await expect(popup).not.toContainText('Fix slash command cursor behavior');
  await page.close();
});

test('falls back to a non-editable labels chip when label suggestions are unavailable', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('label-search-fails');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  await expect(page.locator('._JX_field_chip_edit[data-field-key="labels"]')).toHaveCount(0);
  await expect(page.locator('body')).toContainText('Labels: needs-triage, ux-bug');
  await page.close();
});

test('shows an inline editor error when issue search fails for parent selection', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('issue-search-fails');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  await page.locator('._JX_field_chip_edit[data-field-key="parentLink"]').click();
  await page.locator('._JX_edit_input[data-field-key="parentLink"]').fill('98123');
  await expect(page.locator('._JX_edit_hint')).toContainText('Searching parent');
  await expect.poll(async () => (await page.locator('._JX_edit_error').textContent()) || '', {timeout: 15000}).toMatch(/\S+/);
  await page.close();
});

test('shows a composer error when saving a comment fails', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('comment-save-fails');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  const commentInput = page.locator('._JX_comment_input');
  await commentInput.fill('This should fail to save');
  await expect(page.locator('._JX_comment_save')).toBeEnabled();
  await page.locator('._JX_comment_save').click();
  await expect.poll(async () => (await page.locator('._JX_comment_error').textContent()) || '').toContain('HTTP 500 - Internal Server Error');
  await page.close();
});

test('shows a mention lookup error when people search fails', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('mention-search-fails');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  const commentInput = page.locator('._JX_comment_input');
  await commentInput.fill('@mor');
  await expect(page.locator('._JX_comment_mentions')).toContainText('Could not load people.');
  await page.close();
});

test('discards comment drafts and clears the composer state', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('editable');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  const commentInput = page.locator('._JX_comment_input');
  await commentInput.fill('Draft comment');
  await expect(page.locator('._JX_comment_save')).toBeEnabled();
  await page.locator('._JX_comment_discard').click();
  await expect(commentInput).toHaveValue('');
  await expect(page.locator('._JX_comment_error')).toHaveText('');
  await expect(page.locator('._JX_comment_save')).toBeDisabled();
  await page.close();
});
