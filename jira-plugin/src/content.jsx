/*global chrome */
import size from 'lodash/size';
import debounce from 'lodash/debounce';
import Mustache from 'mustache';
import {centerPopup, waitForDocument} from 'src/utils';
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
  const clipboard = require('clipboard/dist/clipboard');

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
    maybeNormalizeIcon(issueData.fields.priority);

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
      'priority',
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

  function getRelativeHref(href) {
    const documentHref = document.location.href.split('#')[0];
    if (href.startsWith(documentHref)) {
      return href.slice(documentHref.length);
    }
    return href;
  }

  const container = $('<div class="_JX_container">');
  $(document.body).append(container);
  new draggable({
    handle: '._JX_title, ._JX_status',
  }, container);
  
  new clipboard('._JX_title_copy', {
    text: function (trigger) {
      return document.getElementById('_JX_title_link').text;
    }
  })
  .on('success', e => { snackBar('Copied!');})
  .on('error', e => { snackBar('There was an error!');});

  $(document.body).on('click', '._JX_thumb', function previewThumb(e) {
    const currentTarget = $(e.currentTarget);
    if (currentTarget.data('_JX_loading')) {
      return;
    }
    if (!currentTarget.data('mimeType').startsWith('image')) {
      return;
    }
    e.preventDefault();
    currentTarget.data('loading', true);
    const opacityElements = currentTarget.children(':not(._JX_file_loader)');
    opacityElements.css('opacity', 0.2);
    currentTarget.find('._JX_file_loader').show();
    const localCancelToken = cancelToken;
    const img = new Image();
    img.onload = function () {
      currentTarget.data('_JX_loading', false);
      currentTarget.find('._JX_file_loader').hide();
      const name = currentTarget.find('._JX_thumb_filename').text();
      opacityElements.css('opacity', 1);
      if (localCancelToken.cancel) {
        return;
      }
      centerPopup(chrome.runtime.getURL(`resources/preview.html?url=${currentTarget.data('url')}&title=${name}`), name, {
        width: this.naturalWidth,
        height: this.naturalHeight
      }).focus();
    };
    img.src = currentTarget.data('url');
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
          let comments = '';
          if (issueData.fields.comment && issueData.fields.comment.total) {
            comments = issueData.fields.comment.comments.map(
              comment => comment.author.displayName + ':\n' + comment.body
            ).join('\n\n');
          }
          const displayData = {
            urlTitle: key + ' ' + issueData.fields.summary,
            url: INSTANCE_URL + 'browse/' + key,
            prs: [],
            description: issueData.renderedFields.description,
            attachments: issueData.fields.attachment,
            issuetype: issueData.fields.issuetype,
            status: issueData.fields.status,
            priority: issueData.fields.priority,
            fixVersions: issueData.fields.fixVersions || [],
            sprints: readSprintsFromIssue(issueData),
            comment: issueData.fields.comment,
            reporter: issueData.fields.reporter,
            assignee: issueData.fields.assignee,
            comments,
            commentUrl: '',
            loaderGifUrl,
          };
          displayData.commentUrl = `${displayData.url}#comment-${displayData.comment?.comments?.[0]?.id || ''}`;
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
          const css = {
            left: e.pageX + 20,
            top: e.pageY + 25
          };
          container.html(Mustache.render(annotationTemplate, displayData));
          if (!containerPinned) {
            container.css(css);
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
