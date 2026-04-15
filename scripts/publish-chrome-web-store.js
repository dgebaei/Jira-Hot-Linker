const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(repoRoot, 'jira-plugin', 'manifest.json');
const chromeWebStoreScope = 'https://www.googleapis.com/auth/chromewebstore';
const defaultExtensionId = 'oddgjhpfjkeckcppcldgjomlnablfkia';
const pollIntervalMs = 5000;
const maxPollAttempts = 12;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseArgs(argv) {
  const args = {
    uploadOnly: false,
    publishType: 'DEFAULT_PUBLISH',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    if (token === '--upload-only') {
      args.uploadOnly = true;
      continue;
    }
    if (!token.startsWith('--')) {
      fail(`Unexpected argument: ${token}`);
    }

    const [rawKey, inlineValue] = token.split('=', 2);
    const key = rawKey.slice(2);
    const nextValue = inlineValue !== undefined ? inlineValue : argv[index + 1];
    if (inlineValue === undefined) {
      index += 1;
    }
    if (nextValue === undefined) {
      fail(`Missing value for --${key}`);
    }

    switch (key) {
      case 'expected-version':
        args.expectedVersion = nextValue;
        break;
      case 'zip':
        args.zipPath = nextValue;
        break;
      case 'publisher':
        args.publisherId = nextValue;
        break;
      case 'extension':
        args.extensionId = nextValue;
        break;
      case 'service-account-file':
        args.serviceAccountFile = nextValue;
        break;
      case 'publish-type':
        args.publishType = nextValue;
        break;
      default:
        fail(`Unknown argument: --${key}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  node scripts/publish-chrome-web-store.js --expected-version 2.4.1 [options]

Required:
  --expected-version <version>       Version that must match jira-plugin/manifest.json

Options:
  --zip <path>                       ZIP to upload (default: jira-quickview-<version>-chrome-web-store.zip)
  --publisher <id>                   Chrome Web Store publisher ID
  --extension <id>                   Chrome Web Store extension ID
  --service-account-file <path>      Path to the Google service account JSON key
  --publish-type <type>              DEFAULT_PUBLISH or STAGED_PUBLISH (default: DEFAULT_PUBLISH)
  --upload-only                      Upload the ZIP but do not submit it for review

Environment fallbacks:
  CHROME_WEB_STORE_PUBLISHER_ID
  CHROME_WEB_STORE_EXTENSION_ID
  CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON
  CHROME_WEB_STORE_PUBLISH_TYPE
`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function requireValue(value, label) {
  if (String(value || '').trim()) {
    return String(value).trim();
  }
  fail(`Missing required value for ${label}.`);
}

function resolveZipPath(providedPath, version) {
  const filePath = providedPath
    ? path.resolve(repoRoot, providedPath)
    : path.join(repoRoot, `jira-quickview-${version}-chrome-web-store.zip`);
  const stats = fs.statSync(filePath, {throwIfNoEntry: false});
  if (!stats || !stats.isFile()) {
    fail(`ZIP artifact not found: ${path.relative(repoRoot, filePath)}`);
  }
  return filePath;
}

function readServiceAccount(serviceAccountFile) {
  if (serviceAccountFile) {
    return readJson(path.resolve(repoRoot, serviceAccountFile));
  }

  const rawJson = String(process.env.CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON || '').trim();
  if (!rawJson) {
    fail('Missing CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON or --service-account-file.');
  }

  try {
    return JSON.parse(rawJson);
  } catch (error) {
    fail(`CHROME_WEB_STORE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
  }
}

function validateManifestVersion(manifest, expectedVersion) {
  const displayVersion = String(manifest.version_name || manifest.version || '').trim();
  if (!displayVersion) {
    fail('jira-plugin/manifest.json must define version or version_name.');
  }
  if (displayVersion !== expectedVersion) {
    fail(`Manifest version (${displayVersion}) does not match expected version (${expectedVersion}).`);
  }
  return displayVersion;
}

function createJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = {alg: 'RS256', typ: 'JWT'};
  const claimSet = {
    iss: requireValue(serviceAccount.client_email, 'service account client_email'),
    scope: chromeWebStoreScope,
    aud: requireValue(serviceAccount.token_uri, 'service account token_uri'),
    iat: now,
    exp: now + 3600,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), serviceAccount.private_key);
  return `${signingInput}.${base64UrlEncode(signature)}`;
}

async function httpJson(url, options = {}) {
  if (typeof fetch !== 'function') {
    fail('This script requires Node.js 18 or newer because it uses the global fetch API.');
  }

  const response = await fetch(url, options);
  const rawText = await response.text();
  let payload = null;

  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (error) {
      payload = rawText;
    }
  }

  if (!response.ok) {
    const detail = typeof payload === 'string'
      ? payload
      : JSON.stringify(payload, null, 2);
    fail(`Request failed (${response.status} ${response.statusText}) for ${url}\n${detail}`);
  }

  return payload || {};
}

async function getAccessToken(serviceAccount) {
  const assertion = createJwt(serviceAccount);
  const params = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const tokenResponse = await httpJson(requireValue(serviceAccount.token_uri, 'service account token_uri'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  return requireValue(tokenResponse.access_token, 'OAuth access token');
}

async function uploadPackage({token, resourceName, zipPath}) {
  const uploadUrl = `https://chromewebstore.googleapis.com/upload/v2/${resourceName}:upload`;
  const buffer = fs.readFileSync(zipPath);

  return httpJson(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/zip',
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  });
}

async function fetchStatus({token, resourceName}) {
  const statusUrl = `https://chromewebstore.googleapis.com/v2/${resourceName}:fetchStatus`;
  return httpJson(statusUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

async function publishItem({token, resourceName, publishType}) {
  const publishUrl = `https://chromewebstore.googleapis.com/v2/${resourceName}:publish`;
  return httpJson(publishUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      publishType,
    }),
  });
}

function summarizeRevisionStatus(status) {
  if (!status) {
    return 'n/a';
  }

  const channels = Array.isArray(status.distributionChannels)
    ? status.distributionChannels.map(channel => `${channel.crxVersion || 'unknown'}@${channel.deployPercentage ?? 'n/a'}%`)
    : [];
  const suffix = channels.length ? ` (${channels.join(', ')})` : '';
  return `${status.state || 'UNKNOWN'}${suffix}`;
}

function ensureUploadDidNotFail(uploadResponse, statusResponse) {
  const directState = String(uploadResponse.uploadState || '').trim();
  const asyncState = String(statusResponse.lastAsyncUploadState || '').trim();

  if (directState === 'FAILED' || asyncState === 'FAILED') {
    fail(`Chrome Web Store upload failed. uploadState=${directState || 'n/a'} lastAsyncUploadState=${asyncState || 'n/a'}`);
  }
}

async function waitForUploadCompletion({token, resourceName, uploadResponse}) {
  if (String(uploadResponse.uploadState || '').trim() !== 'IN_PROGRESS') {
    const immediateStatus = await fetchStatus({token, resourceName});
    ensureUploadDidNotFail(uploadResponse, immediateStatus);
    return immediateStatus;
  }

  for (let attempt = 1; attempt <= maxPollAttempts; attempt += 1) {
    console.log(`Upload still processing. Polling fetchStatus (${attempt}/${maxPollAttempts})...`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    const statusResponse = await fetchStatus({token, resourceName});
    const asyncState = String(statusResponse.lastAsyncUploadState || '').trim();
    if (!asyncState || asyncState === 'SUCCEEDED' || asyncState === 'NOT_FOUND') {
      ensureUploadDidNotFail(uploadResponse, statusResponse);
      return statusResponse;
    }
    if (asyncState === 'FAILED') {
      ensureUploadDidNotFail(uploadResponse, statusResponse);
    }
  }

  fail(`Upload did not finish within ${Math.round((pollIntervalMs * maxPollAttempts) / 1000)} seconds.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const manifest = readJson(manifestPath);
  const expectedVersion = requireValue(args.expectedVersion, '--expected-version');
  const version = validateManifestVersion(manifest, expectedVersion);
  const publisherId = requireValue(args.publisherId || process.env.CHROME_WEB_STORE_PUBLISHER_ID, 'publisher ID');
  const extensionId = String(args.extensionId || process.env.CHROME_WEB_STORE_EXTENSION_ID || defaultExtensionId).trim();
  const publishType = String(args.publishType || process.env.CHROME_WEB_STORE_PUBLISH_TYPE || 'DEFAULT_PUBLISH').trim();
  if (!['DEFAULT_PUBLISH', 'STAGED_PUBLISH'].includes(publishType)) {
    fail(`Unsupported publish type: ${publishType}`);
  }

  const zipPath = resolveZipPath(args.zipPath, version);
  const serviceAccount = readServiceAccount(args.serviceAccountFile);
  requireValue(serviceAccount.private_key, 'service account private_key');
  const resourceName = `publishers/${publisherId}/items/${extensionId}`;

  console.log(`Target item: ${resourceName}`);
  console.log(`Manifest version: ${version}`);
  console.log(`ZIP: ${path.relative(repoRoot, zipPath)}`);
  console.log(args.uploadOnly ? 'Mode: upload only' : `Mode: upload and publish (${publishType})`);

  const token = await getAccessToken(serviceAccount);
  const uploadResponse = await uploadPackage({token, resourceName, zipPath});
  console.log(`Upload response: uploadState=${uploadResponse.uploadState || 'UNKNOWN'} crxVersion=${uploadResponse.crxVersion || 'pending'}`);
  if (uploadResponse.crxVersion && uploadResponse.crxVersion !== version) {
    fail(`Uploaded package version (${uploadResponse.crxVersion}) does not match expected version (${version}).`);
  }

  const statusAfterUpload = await waitForUploadCompletion({token, resourceName, uploadResponse});
  console.log(`Status after upload: submitted=${summarizeRevisionStatus(statusAfterUpload.submittedItemRevisionStatus)} published=${summarizeRevisionStatus(statusAfterUpload.publishedItemRevisionStatus)} lastAsyncUploadState=${statusAfterUpload.lastAsyncUploadState || 'n/a'}`);

  if (args.uploadOnly) {
    console.log('Upload completed without submitting the item for review.');
    return;
  }

  const publishResponse = await publishItem({token, resourceName, publishType});
  console.log(`Publish response: state=${publishResponse.state || 'UNKNOWN'} itemId=${publishResponse.itemId || extensionId}`);
  const finalStatus = await fetchStatus({token, resourceName});
  console.log(`Final status: submitted=${summarizeRevisionStatus(finalStatus.submittedItemRevisionStatus)} published=${summarizeRevisionStatus(finalStatus.publishedItemRevisionStatus)} lastAsyncUploadState=${finalStatus.lastAsyncUploadState || 'n/a'}`);
}

main().catch(error => {
  fail(error && error.message ? error.message : String(error));
});
