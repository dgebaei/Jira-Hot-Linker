const {test, expect, configureExtension} = require('./helpers/extension-fixtures');

function baseConfig(servers) {
  return {
    instanceUrl: servers.jira.origin,
    domains: [servers.allowedPage.origin],
    hoverDepth: 'shallow',
    hoverModifierKey: 'none',
    customFields: [],
  };
}

test('shows validation for an empty Jira instance URL', async ({optionsPage}) => {
  await optionsPage.getByLabel('Jira instance URL').fill('');
  await optionsPage.getByRole('button', {name: 'Save changes'}).click();
  await expect(optionsPage.locator('.saveNotice')).toContainText('You must provide your Jira instance URL.');
});

test('validates custom field ids and resolves their names from Jira metadata', async ({optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers), true);
  await expect(optionsPage.locator('.saveNotice')).toContainText('Options saved successfully.');
  await optionsPage.reload();

  await optionsPage.getByRole('button', {name: 'Add another field'}).click();
  const row = optionsPage.locator('.customFieldRow').first();

  await row.getByLabel('Field ID').fill('impact');
  await expect(row.getByText('Use a Jira custom field ID in the form customfield_12345.')).toBeVisible();
  await expect(optionsPage.getByRole('button', {name: 'Save changes'})).toBeDisabled();

  await row.getByLabel('Field ID').fill('customfield_12345');
  await expect(row.locator('.customFieldMeta')).toContainText(/Resolved field name:|Waiting for Jira field metadata\./);
  await expect(optionsPage.getByRole('button', {name: 'Save changes'})).toBeEnabled();
});

test('persists hover behavior and layout settings through the options page', async ({optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers), true);
  await expect(optionsPage.locator('.saveNotice')).toContainText('Options saved successfully.');
  await optionsPage.reload();

  await configureExtension(optionsPage, {
    ...baseConfig(servers),
    hoverDepth: 'deep',
    hoverModifierKey: 'shift',
    displayFields: {
      comments: false,
      pullRequests: false,
    },
    customFields: [{fieldId: 'customfield_12345', row: 2}],
  }, true);

  await expect(optionsPage.locator('.saveNotice')).toContainText('Options saved successfully.');
  await optionsPage.reload();

  await expect(optionsPage.getByLabel('Trigger depth')).toHaveValue('deep');
  await expect(optionsPage.getByLabel('Modifier key')).toHaveValue('shift');
  await expect(optionsPage.locator('#displayField_comments')).not.toBeChecked();
  await expect(optionsPage.locator('#displayField_pullRequests')).not.toBeChecked();
  await expect(optionsPage.locator('.customFieldRow').first().getByLabel('Field ID')).toHaveValue('customfield_12345');
});

test('shows an error when optional host permissions are denied', async ({optionsPage, servers}) => {
  await configureExtension(optionsPage, baseConfig(servers), false);
  await expect(optionsPage.locator('.saveNotice')).toContainText('Options not saved.');
});
