function optionsPageModel(page) {
  return {
    root: page.getByTestId('options-root'),
    instanceUrlInput: page.getByTestId('options-instance-url'),
    domainsInput: page.getByTestId('options-domains'),
    advancedToggle: page.getByTestId('options-advanced-toggle'),
    hoverDepthSelect: page.getByTestId('options-hover-depth'),
    hoverModifierSelect: page.getByTestId('options-hover-modifier'),
    saveButton: page.getByTestId('options-save'),
    discardButton: page.getByTestId('options-discard'),
    saveNotice: page.getByTestId('options-save-notice'),
  };
}

async function openAdvancedSettings(page) {
  const advancedToggle = page.getByTestId('options-advanced-toggle');
  const expanded = await advancedToggle.getAttribute('aria-expanded');
  if (expanded !== 'true') {
    await advancedToggle.click();
  }
}

module.exports = {
  optionsPageModel,
  openAdvancedSettings,
};
