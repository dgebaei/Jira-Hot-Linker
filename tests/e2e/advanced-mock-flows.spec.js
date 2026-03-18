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

async function openPopup(extensionApp, servers, route = '/popup-actions') {
  const page = await extensionApp.context.newPage();
  await page.goto(`${servers.allowedPage.origin}${route}`);
  await injectContentScript(extensionApp, page);
  await expect.poll(async () => page.locator('._JX_container').count()).toBe(1);
  await hoverIssueKey(page, '#popup-key');
  await expect(page.locator('._JX_container')).toContainText('JRACLOUD-97846');
  return page;
}

test('shows assignee and parent search results inside their editors', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('editable');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);

  await page.locator('._JX_assignee_edit_button').click();
  await page.locator('._JX_edit_input[data-field-key="assignee"]').fill('Morgan');
  await expect(page.locator('._JX_edit_option[data-field-key="assignee"][data-option-id="user-me"]')).toBeVisible();
  await expect(page.locator('._JX_edit_option[data-field-key="assignee"][data-option-id="user-me"]')).toContainText('Morgan Agent');
  await page.locator('._JX_edit_cancel[data-field-key="assignee"]').click();

  await page.locator('._JX_field_chip_edit[data-field-key="parentLink"]').click();
  await page.locator('._JX_edit_input[data-field-key="parentLink"]').fill('98123');
  await expect(page.locator('._JX_edit_option[data-field-key="parentLink"][data-option-id="JRACLOUD-98123"]')).toBeVisible();
  await expect(page.locator('._JX_edit_option[data-field-key="parentLink"][data-option-id="JRACLOUD-98123"]')).toContainText('Improve slash command cursor stability');

  await page.close();
});

test('updates sprint and version fields through edit popovers', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('editable');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  const popup = page.locator('._JX_container');

  await page.locator('._JX_field_chip_edit[data-field-key="sprint"]').click();
  await page.locator('._JX_edit_option[data-field-key="sprint"][data-option-id="43"]').click();
  await page.locator('._JX_edit_input[data-field-key="sprint"]').press('Enter');
  await expect(popup).toContainText('Sprint set to Sprint 43 (FUTURE)');
  await expect(popup).toContainText('Sprint 43');

  await page.locator('._JX_field_chip_edit[data-field-key="versions"]').click();
  await page.locator('._JX_edit_option[data-field-key="versions"][data-option-id="302"]').click();
  await page.locator('._JX_edit_save[data-field-key="versions"]').click();
  await expect(popup).toContainText('Affects versions updated');
  await expect(popup).toContainText('2026.05');

  await page.locator('._JX_field_chip_edit[data-field-key="fixVersions"]').click();
  await page.locator('._JX_edit_option[data-field-key="fixVersions"][data-option-id="402"]').click();
  await page.locator('._JX_edit_save[data-field-key="fixVersions"]').click();
  await expect(popup).toContainText('Fix versions updated');
  await expect(popup).toContainText('2026.06');

  await page.close();
});

test('shows grouped quick actions for assignment, transition, and sprint moves', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('editable');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  await page.locator('._JX_actions_toggle').click();

  await expect(page.locator('._JX_action_item[data-action-key="assign-to-me"]')).toContainText('Assign to me');
  await expect(page.locator('._JX_action_item[data-action-key="start-progress"]')).toContainText(/Start|Move to In Progress/);
  await expect(page.locator('._JX_action_item[data-action-key="move-to-sprint-43"]')).toContainText('Move to Sprint Sprint 43 (NEXT)');
  await expect(page.locator('._JX_action_divider')).toHaveCount(1);

  await page.close();
});

test('offers an explicit unassigned option in the assignee editor', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('editable');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);

  await page.locator('._JX_assignee_edit_button').click();
  const unassignedOption = page.locator('._JX_edit_option[data-field-key="assignee"][data-option-id="__unassigned__"]');
  await expect(unassignedOption).toBeVisible();
  await expect(unassignedOption).toContainText('Clear assignee');
  await page.close();
});

test('hides quick actions when the issue is already assigned, already in progress, and has no sprint move targets', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('in-progress-no-sprint-actions');
  await configureExtension(optionsPage, baseConfig(servers), true);

  const page = await openPopup(extensionApp, servers);
  await expect(page.locator('._JX_actions_toggle')).toHaveCount(0);
  await page.close();
});

test('hides attachment and pull request sections when those display settings are disabled', async ({extensionApp, optionsPage, servers}) => {
  await servers.jira.setScenario('editable');
  await configureExtension(optionsPage, baseConfig(servers, {
    displayFields: {
      comments: false,
      attachments: false,
      pullRequests: false,
    },
  }), true);

  const page = await openPopup(extensionApp, servers);
  const popup = page.locator('._JX_container');

  await expect(popup).not.toContainText('Attachments');
  await expect(popup).not.toContainText('Pull Requests');
  await expect(popup).toContainText('📎 0');
  await expect(popup).toContainText('🔀 0');
  await page.close();
});
