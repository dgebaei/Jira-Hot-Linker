function popupModel(page) {
  return {
    root: page.getByTestId('jira-popup-root'),
    actionsToggle: page.getByTestId('jira-popup-actions-toggle'),
    previewOverlay: page.getByTestId('jira-popup-preview-overlay'),
    previewImage: page.getByTestId('jira-popup-preview-image'),
  };
}

module.exports = {
  popupModel,
};
