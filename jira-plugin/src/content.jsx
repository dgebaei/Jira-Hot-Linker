/*global chrome */
import size from 'lodash/size';
import debounce from 'lodash/debounce';
import Mustache from 'mustache';
import {waitForDocument} from 'src/utils';
import {sendMessage, storageGet, storageSet} from 'src/chrome';
import {snackBar} from 'src/snack';
import config from 'options/config.js';

waitForDocument(() => require('src/content.scss'));

const getInstanceUrl = async () => (await storageGet({
  instanceUrl: config.instanceUrl
})).instanceUrl;

const getConfig = async () => (await storageGet(config));
let sprintFieldIdsPromise;

async function getSprintFieldIds(instanceUrl) {
  if (sprintFieldIdsPromise) {
    return sprintFieldIdsPromise;
  }
  sprintFieldIdsPromise = get(instanceUrl + 'rest/api/2/field')
    .then(fields => {
      if (!Array.isArray(fields)) {
        return [];
      }
      return fields
        .filter(field => {
          const name = (field.name || '').toLowerCase();
          const schemaCustom = ((field.schema && field.schema.custom) || '').toLowerCase();
          const schemaType = ((field.schema && field.schema.type) || '').toLowerCase();
          return name.includes('sprint') ||
            schemaCustom.includes('gh-sprint') ||
            schemaType === 'sprint';
        })
        .map(field => field.id);
    })
    .catch(() => []);
  return sprintFieldIdsPromise;
}

/**
 * Returns a function that will return an array of jira tickets for any given string
 * @param projectKeys project keys to match
 * @returns {Function}
 */
function buildJiraKeyMatcher(projectKeys) {
  const projectMatches = projectKeys.join('|');
  const jiraTicketRegex = new RegExp('(?:' + projectMatches + ')[- ]\\d+', 'ig');

  return function (text) {
    let matches;
    const result = [];

    while ((matches = jiraTicketRegex.exec(text)) !== null) {
      result.push(matches[0]);
    }
    return result;
  };
}

chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.action === 'message') {
    snackBar(msg.message);
  }
});

let ui_tips_shown_local = [];

async function showTip(tipName, tipMessage) {
  if (ui_tips_shown_local.indexOf(tipName) !== -1) {
    return;
  }
  ui_tips_shown_local.push(tipName);
  const ui_tips_shown = (await storageGet({['ui_tips_shown']: []})).ui_tips_shown;
  if (ui_tips_shown.indexOf(tipName) === -1) {
    snackBar(tipMessage);
    ui_tips_shown.push(tipName);
    storageSet({'ui_tips_shown': ui_tips_shown});
  }
}

storageGet({'ui_tips_shown': []}).then(function ({ui_tips_shown}) {
  ui_tips_shown_local = ui_tips_shown;
});

async function get(url) {
  var response = await sendMessage({action: "get", url: url});
  if (response.result) {
    return response.result;
  } else if (response.error) {
    const err = new Error(response.error);
    err.inner = response.error;
    throw err;
  }
}

async function getImageDataUrl(url) {
  const response = await sendMessage({action: 'getImageDataUrl', url});
  if (response.result) {
    return response.result;
  } else if (response.error) {
    const err = new Error(response.error);
    err.inner = response.error;
    throw err;
  }
}

async function mainAsyncLocal() {
  const $ = require('jquery');
  const draggable = require('jquery-ui/ui/widgets/draggable');

  const config = await getConfig();
  const INSTANCE_URL = config.instanceUrl;
  const jiraProjects = await get(await getInstanceUrl() + 'rest/api/2/project');

  if (!size(jiraProjects)) {
    console.log('Couldn\'t find any jira projects...');
    return;
  }
  const getJiraKeys = buildJiraKeyMatcher(jiraProjects.map(function (project) {
    return project.key;
  }));
  const annotationTemplate = await get(chrome.runtime.getURL('resources/annotation.html'));
  const loaderGifUrl = chrome.runtime.getURL('resources/ajax-loader.gif');
  const imageProxyCache = {};

  function toAbsoluteJiraUrl(url) {
    if (!url) {
      return url;
    }
    try {
      return new URL(url, INSTANCE_URL).toString();
    } catch (ex) {
      return url;
    }
  }

  async function getDisplayImageUrl(url) {
    const absoluteUrl = toAbsoluteJiraUrl(url);
    if (!absoluteUrl || !absoluteUrl.startsWith(INSTANCE_URL)) {
      return absoluteUrl;
    }
    if (imageProxyCache[absoluteUrl]) {
      return imageProxyCache[absoluteUrl];
    }
    try {
      const dataUrl = await getImageDataUrl(absoluteUrl);
      imageProxyCache[absoluteUrl] = dataUrl;
      return dataUrl;
    } catch (ex) {
      return absoluteUrl;
    }
  }

  async function normalizeIssueImages(issueData) {
    const imageLoads = [];

    const maybeNormalizeAvatar = field => {
      const avatarUrl = field && field.avatarUrls && field.avatarUrls['48x48'];
      if (avatarUrl) {
        imageLoads.push(
          getDisplayImageUrl(avatarUrl).then(src => {
            field.avatarUrls['48x48'] = src;
          })
        );
      }
    };

    const maybeNormalizeIcon = field => {
      if (field && field.iconUrl) {
        imageLoads.push(
          getDisplayImageUrl(field.iconUrl).then(src => {
            field.iconUrl = src;
          })
        );
      }
    };

    maybeNormalizeAvatar(issueData.fields.reporter);
    maybeNormalizeAvatar(issueData.fields.assignee);
    maybeNormalizeIcon(issueData.fields.issuetype);
    maybeNormalizeIcon(issueData.fields.status);

    (issueData.fields.attachment || []).forEach(attachment => {
      attachment.content = toAbsoluteJiraUrl(attachment.content);
      attachment.thumbnail = toAbsoluteJiraUrl(attachment.thumbnail) || attachment.content;
      if (attachment.thumbnail) {
        imageLoads.push(
          getDisplayImageUrl(attachment.thumbnail).then(src => {
            attachment.thumbnail = src;
          })
        );
      }
    });

    await Promise.all(imageLoads);
  }

  function escapeHtml(input) {
    const node = document.createElement('div');
    node.textContent = input || '';
    return node.innerHTML;
  }

  function textToLinkedHtml(input) {
    const escaped = escapeHtml(input || '');
    const withLinks = escaped.replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
    return withLinks.replace(/\n/g, '<br/>');
  }

  function formatRelativeDate(created) {
    const createdAt = new Date(created);
    if (Number.isNaN(createdAt.getTime())) {
      return '--';
    }
    const diffMs = Date.now() - createdAt.getTime();
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    if (diffMs >= 0 && diffMs < twoDaysMs) {
      const minuteMs = 60 * 1000;
      const hourMs = 60 * minuteMs;
      const dayMs = 24 * hourMs;
      if (diffMs < hourMs) {
        const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
        return `${minutes}m ago`;
      }
      if (diffMs < dayMs) {
        const hours = Math.max(1, Math.floor(diffMs / hourMs));
        return `${hours}h ago`;
      }
      const days = Math.max(1, Math.floor(diffMs / dayMs));
      return `${days}d ago`;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(createdAt);
  }

  async function normalizeRichHtml(html, options = {}) {
    if (!html) {
      return '';
    }
    const {imageMaxHeight} = options;
    const temp = document.createElement('div');
    temp.innerHTML = html;

    const imageNodes = Array.from(temp.querySelectorAll('img[src]'));
    await Promise.all(imageNodes.map(async img => {
      const src = img.getAttribute('src');
      const absoluteSrc = toAbsoluteJiraUrl(src);
      const displaySrc = await getDisplayImageUrl(absoluteSrc);
      const resolvedSrc = displaySrc || absoluteSrc || src;
      if (resolvedSrc) {
        img.setAttribute('src', resolvedSrc);
        img.setAttribute('data-jx-preview-src', resolvedSrc);
        img.classList.add('_JX_previewable');
      }
      if (imageMaxHeight) {
        img.style.maxHeight = `${imageMaxHeight}px`;
      }
    }));

    const anchorNodes = Array.from(temp.querySelectorAll('a[href]'));
    anchorNodes.forEach(anchor => {
      const href = anchor.getAttribute('href');
      const absoluteHref = toAbsoluteJiraUrl(href);
      if (absoluteHref) {
        anchor.setAttribute('href', absoluteHref);
      }
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener noreferrer');
    });

    return temp.innerHTML;
  }

  async function buildCommentsForDisplay(issueData) {
    const comments = [...(issueData.fields.comment?.comments || [])].sort((a, b) => {
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    });
    const renderedById = {};
    ((issueData.renderedFields?.comment?.comments) || []).forEach(comment => {
      if (comment && comment.id) {
        renderedById[comment.id] = comment.body;
      }
    });

    const result = [];
    for (const comment of comments) {
      const rendered = renderedById[comment.id];
      const baseHtml = rendered || textToLinkedHtml(comment.body || '');
      const bodyHtml = await normalizeRichHtml(baseHtml, {imageMaxHeight: 100});
      result.push({
        author: comment.author?.displayName || 'Unknown',
        created: formatRelativeDate(comment.created),
        bodyHtml
      });
    }
    return result;
  }

  /***
   * Retrieve only the text that is directly owned by the node
   * @param node
   */
  function getShallowText(node) {
    const TEXT_NODE = 3;
    return $(node).contents().filter(function (i, n) {
      //TODO, not specific enough, need to evaluate getBoundingClientRect
      return n.nodeType === TEXT_NODE;
    }).text();
  }

  function getPullRequestData(issueId, applicationType) {
    return get(INSTANCE_URL + 'rest/dev-status/1.0/issue/details?issueId=' + issueId + '&applicationType=' + applicationType + '&dataType=pullrequest');
  }

  async function getIssueMetaData(issueKey) {
    const sprintFieldIds = await getSprintFieldIds(INSTANCE_URL);
    const fields = [
      'description',
      'id',
      'reporter',
      'assignee',
      'summary',
      'attachment',
      'comment',
      'issuetype',
      'status',
      'fixVersions',
      ...sprintFieldIds
    ];
    return get(INSTANCE_URL + 'rest/api/2/issue/' + issueKey + '?fields=' + fields.join(',') + '&expand=renderedFields,names');
  }

  function readSprintsFromIssue(issueData) {
    const names = issueData.names || {};
    const fields = issueData.fields || {};
    const sprintFieldIds = Object.keys(names).filter(fieldId => {
      return typeof names[fieldId] === 'string' && names[fieldId].toLowerCase().includes('sprint');
    });
    const sprintValues = sprintFieldIds
      .map(fieldId => fields[fieldId])
      .filter(value => value !== undefined && value !== null);
    const seen = {};
    const sprints = [];

    const pushSprint = (name, state) => {
      if (!name) {
        return;
      }
      const key = `${name}__${state || ''}`;
      if (seen[key]) {
        return;
      }
      seen[key] = true;
      sprints.push({name, state: state || ''});
    };

    sprintValues.forEach(value => {
      const entries = Array.isArray(value) ? value : [value];
      entries.forEach(entry => {
        if (!entry) {
          return;
        }
        if (typeof entry === 'string') {
          const nameMatch = entry.match(/name=([^,\]]+)/i);
          const stateMatch = entry.match(/state=([^,\]]+)/i);
          pushSprint(nameMatch && nameMatch[1] ? nameMatch[1] : entry, stateMatch && stateMatch[1]);
          return;
        }
        pushSprint(entry.name || entry.goal || entry.id, entry.state);
      });
    });
    return sprints;
  }

  function formatFixVersionText(fixVersions) {
    return (fixVersions || [])
      .map(version => version.name)
      .filter(Boolean)
      .join(', ');
  }

  function formatSprintText(sprints) {
    return (sprints || [])
      .map(sprint => sprint.state ? `${sprint.name} (${sprint.state})` : sprint.name)
      .filter(Boolean)
      .join(', ');
  }

  function buildAttachmentChips(attachments) {
    const totals = {
      image: 0,
      pdf: 0,
      doc: 0,
      other: 0
    };

    (attachments || []).forEach(attachment => {
      const mimeType = (attachment.mimeType || '').toLowerCase();
      if (mimeType.startsWith('image/')) {
        totals.image += 1;
      } else if (mimeType === 'application/pdf') {
        totals.pdf += 1;
      } else if (
        mimeType.includes('word') ||
        mimeType.includes('excel') ||
        mimeType.includes('powerpoint') ||
        mimeType.includes('officedocument') ||
        mimeType.includes('msword') ||
        mimeType.includes('opendocument') ||
        mimeType.includes('rtf') ||
        mimeType.startsWith('text/')
      ) {
        totals.doc += 1;
      } else {
        totals.other += 1;
      }
    });

    const chips = [];
    if (totals.image) chips.push({icon: '🖼️', count: totals.image});
    if (totals.pdf) chips.push({icon: '📕', count: totals.pdf});
    if (totals.doc) chips.push({icon: '📝', count: totals.doc});
    if (totals.other) chips.push({icon: '📎', count: totals.other});
    return chips;
  }

  function buildPreviewAttachments(attachments) {
    return (attachments || []).filter(attachment => {
      return !!attachment &&
        typeof attachment.mimeType === 'string' &&
        attachment.mimeType.toLowerCase().startsWith('image') &&
        !!attachment.thumbnail;
    });
  }

  function getRelativeHref(href) {
    const documentHref = document.location.href.split('#')[0];
    if (href.startsWith(documentHref)) {
      return href.slice(documentHref.length);
    }
    return href;
  }

  function computeVisibleContainerPosition(pointerX, pointerY) {
    const margin = 8;
    const preferredLeft = pointerX + 20;
    const preferredTop = pointerY + 25;
    const width = container.outerWidth();
    const height = container.outerHeight();
    const viewportLeft = window.scrollX + margin;
    const viewportTop = window.scrollY + margin;
    const viewportRight = window.scrollX + window.innerWidth - margin;
    const viewportBottom = window.scrollY + window.innerHeight - margin;

    let left = preferredLeft;
    let top = preferredTop;

    if (left + width > viewportRight) {
      left = pointerX - width - 15;
    }
    if (left < viewportLeft) {
      left = viewportLeft;
    }

    if (top + height > viewportBottom) {
      top = pointerY - height - 15;
    }
    if (top < viewportTop) {
      top = viewportTop;
    }

    return {left, top};
  }

  const container = $('<div class="_JX_container">');
  const previewOverlay = $(`
    <div class="_JX_preview_overlay">
      <img class="_JX_preview_image" />
    </div>
  `);
  $(document.body).append(container);
  $(document.body).append(previewOverlay);
  new draggable({
    handle: '._JX_title, ._JX_status',
  }, container);
  
  function buildPrettyLinkPayload() {
    const titleLink = document.getElementById('_JX_title_link');
    const url = titleLink?.getAttribute('href') || '';
    const ticket = titleLink?.getAttribute('data-ticket') || '';
    const title = titleLink?.getAttribute('data-title') || '';
    const label = `[${ticket}] ${title}`.trim();
    const link = document.createElement('a');
    link.href = url;
    link.textContent = label;
    return {
      html: link.outerHTML,
      text: url
    };
  }

  function copyPrettyLinkFallback(html, text) {
    return new Promise((resolve, reject) => {
      const onCopy = event => {
        event.preventDefault();
        event.clipboardData.setData('text/html', html);
        event.clipboardData.setData('text/plain', text);
      };
      document.addEventListener('copy', onCopy, {once: true});
      const success = document.execCommand('copy');
      if (!success) {
        reject(new Error('Copy command failed'));
        return;
      }
      resolve();
    });
  }

  async function copyPrettyLink() {
    const {html, text} = buildPrettyLinkPayload();
    try {
      if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], {type: 'text/html'}),
            'text/plain': new Blob([text], {type: 'text/plain'})
          })
        ]);
        snackBar('Copied!');
        return;
      }
    } catch (ex) {
      // fall through to fallback copy path
    }

    try {
      await copyPrettyLinkFallback(html, text);
      snackBar('Copied!');
    } catch (ex) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        snackBar('Copied as text');
      } else {
        snackBar('There was an error!');
      }
    }
  }

  $(document.body).on('click', '._JX_title_copy', function (e) {
    e.preventDefault();
    copyPrettyLink().catch(() => snackBar('There was an error!'));
  });

  function closePreviewOverlay() {
    previewOverlay.removeClass('is-open');
    previewOverlay.find('img').attr('src', '');
  }

  async function openPreviewOverlay(imageUrl) {
    if (!imageUrl) {
      return;
    }
    const displaySrc = await getDisplayImageUrl(imageUrl);
    previewOverlay.find('img').attr('src', displaySrc || imageUrl);
    previewOverlay.addClass('is-open');
  }

  previewOverlay.on('click', function (e) {
    if (e.target === previewOverlay[0]) {
      closePreviewOverlay();
    }
  });

  $(document.body).on('click', '._JX_previewable', function (e) {
    e.preventDefault();
    e.stopPropagation();
    const source = e.currentTarget.getAttribute('data-jx-preview-src') || e.currentTarget.getAttribute('src');
    openPreviewOverlay(source).catch(() => {});
  });

  $(document.body).on('click', '._JX_thumb', function (e) {
    if ($(e.target).closest('img._JX_previewable').length) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const source = e.currentTarget.getAttribute('data-preview-src') || e.currentTarget.getAttribute('data-url');
    openPreviewOverlay(source).catch(() => {});
  });

  function hideContainer() {
    containerPinned = false;
    container.css({
      left: -5000,
      top: -5000,
      position: 'absolute',
    }).removeClass('container-pinned');

    passiveCancel(0);
  }

  $(document.body).on('keydown', function (e) {
    // TODO: escape not captured in google docs
    const ESCAPE_KEY_CODE = 27;
    if (e.keyCode === ESCAPE_KEY_CODE) {
      if (previewOverlay.hasClass('is-open')) {
        closePreviewOverlay();
        return;
      }
      hideContainer();
      passiveCancel(200);
    }
  });

  let cancelToken = {};

  function passiveCancel(cooldown) {
    // does not actually cancel xhr calls
    cancelToken.cancel = true;
    setTimeout(function () {
      cancelToken = {};
    }, cooldown);
  }

  let hideTimeOut;
  let containerPinned = false;
  container.on('dragstop', () => {
    if (!containerPinned) {
      snackBar('Ticket Pinned! Hit esc to close !');
      container.addClass('container-pinned');
      const position = container.position();
      container.css({
        left: position.left - document.scrollingElement.scrollLeft,
        top: position.top - document.scrollingElement.scrollTop,
      });
      containerPinned = true;
      clearTimeout(hideTimeOut);
    }
  });
  $(document.body).on('mousemove', debounce(function (e) {
    if (cancelToken.cancel) {
      return;
    }
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (element === container[0] || $.contains(container[0], element)) {
      showTip('tooltip_drag', 'Tip: You can pin the tooltip by dragging the title !');
      // cancel when hovering over the container it self
      return;
    }
    if (element) {
      let keys = getJiraKeys(getShallowText(element));
      if (!size(keys) && element.href) {
        keys = getJiraKeys(getRelativeHref(element.href));
      }
      if (!size(keys) && element.parentElement.href) {
        keys = getJiraKeys(getRelativeHref(element.parentElement.href));
      }

      if (size(keys)) {
        clearTimeout(hideTimeOut);
        const key = keys[0].replace(" ", "-");
        const pointerX = e.pageX;
        const pointerY = e.pageY;
        (async function (cancelToken) {
          const issueData = await getIssueMetaData(key);
          await normalizeIssueImages(issueData);
          let pullRequests = [];
          try {
            const githubPrs = await getPullRequestData(issueData.id, 'github');
            pullRequests = githubPrs.detail[0].pullRequests;
          } catch (ex) {
            // probably no access
          }

          if (cancelToken.cancel) {
            return;
          }
          const normalizedDescription = await normalizeRichHtml(issueData.renderedFields.description, {
            imageMaxHeight: 180
          });
          const commentsForDisplay = await buildCommentsForDisplay(issueData);
          const fixVersions = issueData.fields.fixVersions || [];
          const sprints = readSprintsFromIssue(issueData);
          const commentsTotal = commentsForDisplay.length;
          const attachments = issueData.fields.attachment || [];
          const previewAttachments = buildPreviewAttachments(attachments);
          const displayData = {
            urlTitle: `[${key}] ${issueData.fields.summary}`,
            ticketKey: key,
            ticketTitle: issueData.fields.summary,
            url: INSTANCE_URL + 'browse/' + key,
            prs: [],
            description: normalizedDescription,
            hasBodyContent: !!normalizedDescription || previewAttachments.length > 0 || commentsForDisplay.length > 0,
            attachments,
            previewAttachments,
            commentsForDisplay,
            issuetype: issueData.fields.issuetype,
            status: issueData.fields.status,
            issueTypeText: issueData.fields.issuetype?.name || 'No type',
            statusText: issueData.fields.status?.name || 'No status',
            hasComments: commentsTotal > 0,
            commentsTotal,
            fixVersionText: formatFixVersionText(fixVersions) || 'No fix version',
            sprintText: formatSprintText(sprints) || 'No sprint',
            attachmentChips: buildAttachmentChips(attachments),
            reporter: issueData.fields.reporter,
            assignee: issueData.fields.assignee,
            commentUrl: INSTANCE_URL + 'browse/' + key,
            loaderGifUrl,
          };
          if (issueData.fields.comment?.comments?.[0]?.id) {
            displayData.commentUrl = `${displayData.url}#comment-${issueData.fields.comment.comments[0].id}`;
          }
          if (size(pullRequests)) {
            displayData.prs = pullRequests.filter(function (pr) {
              return pr.url !== location.href;
            }).map(function (pr) {
              return {
                id: pr.id,
                url: pr.url,
                name: pr.name,
                status: pr.status,
                author: pr.author
              };
            });
          }
          // TODO: fix scrolling in google docs
          container.html(Mustache.render(annotationTemplate, displayData));
          if (!containerPinned) {
            container.css(computeVisibleContainerPosition(pointerX, pointerY));
          }
        })(cancelToken);
      } else if (!containerPinned) {
        hideTimeOut = setTimeout(hideContainer, 250);
      }
    }
  }, 100));
}

if (!window.__JX__script_injected__) {
  waitForDocument(mainAsyncLocal);
}

window.__JX__script_injected__ = true;
