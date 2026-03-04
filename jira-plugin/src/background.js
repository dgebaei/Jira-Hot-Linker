/*global chrome */
import defaultConfig from 'options/config.js';
import {storageGet, storageSet, permissionsRequest, promisifyChrome} from 'src/chrome';
import {contentScript, resetDeclarativeMapping} from 'options/declarative';

const executeScript = promisifyChrome(chrome.scripting, 'executeScript');
const sendMessage = promisifyChrome(chrome.tabs, 'sendMessage');

var SEND_RESPONSE_IS_ASYNC = true;

async function fetchWithCredentials(url) {
  const response = await fetch(url, {credentials: 'include'});
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} - ${response.statusText}`);
  }
  return response;
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request.action === 'get') {
    fetchWithCredentials(request.url)
      .then(async response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} – ${response.statusText}`);
        }

        const contentType = response.headers.get('Content-Type') || '';
        const isJson = contentType.includes('application/json');

        const result = isJson
          ? await response.json()
          : await response.text();
        sendResponse({ result });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return SEND_RESPONSE_IS_ASYNC;
  }

  if (request.action === 'getImageDataUrl') {
    fetchWithCredentials(request.url)
      .then(async response => {
        const contentType = response.headers.get('Content-Type') || '';
        if (!contentType.startsWith('image/')) {
          throw new Error(`Expected image content but got: ${contentType || 'unknown'}`);
        }
        const dataUrl = await blobToDataUrl(await response.blob());
        sendResponse({ result: dataUrl });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return SEND_RESPONSE_IS_ASYNC;
  }
});

async function browserOnClicked (tab) {
  const config = await storageGet(defaultConfig);
  if (!config.instanceUrl || !config.v15upgrade) {
    chrome.runtime.openOptionsPage();
    return;
  }
  const origin = new URL(tab.url).origin + '/';
  const granted = await permissionsRequest({origins: [origin]});
  if (granted) {
    const config = await storageGet(defaultConfig);
    if (config.domains.indexOf(origin) !== -1) {
      try {
        await sendMessage(tab.id, {
          action: 'message',
          message: origin + ' is already added.'
        });
      } catch (ex) {
        // extension was just installed and not injected on this tab yet
        await executeScript({
          target: {tabId: tab.id},
          files: [contentScript]
        });
        await sendMessage(tab.id, {
          action: 'message',
          message: 'Jira HotLinker enabled successfully !'
        });
      }
      return;
    }
    config.domains.push(origin);
    await storageSet(config);
    await resetDeclarativeMapping();
    await executeScript({
      target: {tabId: null},
      files: [contentScript]
    });
    await sendMessage(tab.id, {
      action: 'message',
      message: origin + ' added successfully !'
    });
  }
}

(function () {
  chrome.runtime.onInstalled.addListener(async () => {
    const config = await storageGet(defaultConfig);
    if (!config.instanceUrl || !config.v15upgrade) {
      chrome.runtime.openOptionsPage();
      return;
    }
    resetDeclarativeMapping();
  });

  chrome.action.onClicked.addListener(tab => {
    browserOnClicked(tab).catch( (err) => {
      console.log('Error: ', err)
    });
  });
})();
