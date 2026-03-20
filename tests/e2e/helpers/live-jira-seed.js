const {
  getIssueEditmeta,
  getLabelSuggestions,
  getLiveIssue,
  updateIssueFields,
  uploadIssueAttachment,
} = require('./live-jira-api');

const SEED_ATTACHMENT_NAME = 'playwright-seed-preview.png';
const SEED_ATTACHMENT_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==',
  'base64'
);
const SEED_LABEL_CANDIDATES = ['playwright-seed-label', 'playwright-seed-label-2'];

async function ensurePriorityValue(issueKey, config) {
  const issue = await getLiveIssue(issueKey, config);
  if (issue?.fields?.priority?.id) {
    return issue.fields.priority;
  }

  const editmeta = await getIssueEditmeta(issueKey, config);
  const priorityOptions = editmeta?.fields?.priority?.allowedValues || [];
  const priority = priorityOptions.find(option => option?.id);
  if (!priority?.id) {
    return null;
  }

  await updateIssueFields(issueKey, {
    priority: {id: priority.id},
  }, config);

  return priority;
}

async function ensurePreviewAttachment(issueKey, config) {
  const issue = await getLiveIssue(issueKey, config);
  const attachments = issue?.fields?.attachment || [];
  const existingPreviewAttachment = attachments.find(attachment => {
    const fileName = String(attachment?.filename || '').toLowerCase();
    const mimeType = String(attachment?.mimeType || '').toLowerCase();
    return fileName === SEED_ATTACHMENT_NAME || mimeType.startsWith('image/');
  });

  if (existingPreviewAttachment) {
    return existingPreviewAttachment;
  }

  const uploaded = await uploadIssueAttachment(issueKey, SEED_ATTACHMENT_NAME, 'image/png', SEED_ATTACHMENT_BUFFER, config);
  return Array.isArray(uploaded) ? uploaded[0] : uploaded;
}

async function findReusableLabel(issueKey, query, config) {
  const issue = await getLiveIssue(issueKey, config);
  const currentLabels = new Set((issue?.fields?.labels || []).map(label => String(label || '').trim()).filter(Boolean));
  const suggestions = await getLabelSuggestions(query, config);
  const values = Array.isArray(suggestions?.results)
    ? suggestions.results.map(entry => String(entry?.value || '').trim()).filter(Boolean)
    : Array.isArray(suggestions)
      ? suggestions.map(entry => typeof entry === 'string' ? entry : String(entry?.value || entry?.label || '').trim()).filter(Boolean)
      : [];

  return values.find(value => !currentLabels.has(value)) || '';
}

async function ensureReusableLabel(issueKey, secondaryIssueKey, config) {
  const currentIssue = await getLiveIssue(issueKey, config);
  const currentIssueLabels = (currentIssue?.fields?.labels || []).map(label => String(label || '').trim()).filter(Boolean);
  const sanitizedCurrentLabels = currentIssueLabels.filter(label => !SEED_LABEL_CANDIDATES.includes(label));
  if (sanitizedCurrentLabels.length !== currentIssueLabels.length) {
    await updateIssueFields(issueKey, {
      labels: sanitizedCurrentLabels,
    }, config);
  }

  const directMatch = await findReusableLabel(issueKey, 'label', config);
  if (directMatch) {
    return directMatch;
  }

  const seedIssueKey = secondaryIssueKey && secondaryIssueKey !== issueKey ? secondaryIssueKey : issueKey;
  const seedIssue = await getLiveIssue(seedIssueKey, config);
  const seedIssueLabels = new Set((seedIssue?.fields?.labels || []).map(label => String(label || '').trim()).filter(Boolean));

  for (const label of SEED_LABEL_CANDIDATES) {
    if (!seedIssueLabels.has(label)) {
      seedIssueLabels.add(label);
      await updateIssueFields(seedIssueKey, {
        labels: [...seedIssueLabels],
      }, config);
    }

    const reusableLabel = await findReusableLabel(issueKey, label.slice(0, 12), config);
    if (reusableLabel) {
      return reusableLabel;
    }
  }

  return '';
}

module.exports = {
  ensurePreviewAttachment,
  ensurePriorityValue,
  ensureReusableLabel,
};
