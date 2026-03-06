# Adaptive PR Discovery Plan

## Goal

Make pull request rendering resilient across Jira deployments, git providers, and on-prem integration setups by:

- discovering a working Jira development-data endpoint at runtime
- discovering a working `applicationType` at runtime
- caching the resolved strategy per Jira instance
- ensuring PR lookup failures never break the main hover popup

## Current Problems

1. PR fetching is effectively hardcoded to one endpoint and one `applicationType`.
2. Jira Server/Data Center development APIs are private and differ across deployments.
3. Some instances expose summary counts but not PR details on the same route.
4. When discovery logic is mixed directly into popup rendering, regressions can break the whole hover flow.

## Non-Goals

- Do not query GitHub, GitLab, or Bitbucket directly.
- Do not build provider-specific logic based on hostnames alone.
- Do not block popup rendering while running large endpoint scans on every hover.

## Desired Runtime Behavior

### Scenario A: Known working Jira instance

- Hover starts.
- Core issue data loads.
- Cached PR strategy is reused immediately.
- PR list is fetched using the cached strategy.
- If fetch fails once, mark strategy as suspect and continue without PRs.

### Scenario B: First run on a Jira instance

- Hover starts.
- Core issue data loads.
- No cached PR strategy exists.
- Run a bounded discovery sequence.
- Cache the first working strategy.
- Render PRs if found; otherwise render popup without PRs.

### Scenario C: Jira knows PR counts but details are unavailable

- Summary endpoint returns pull request count > 0.
- All detail endpoints return empty or error.
- Popup renders without PR rows.
- Debug state records that Jira exposes summary-only development data.

### Scenario D: Endpoint/applicationType changed after Jira upgrade

- Cached strategy starts failing.
- Mark strategy stale.
- Re-run discovery.
- Replace cache entry if a new working strategy is found.

## Proposed Architecture

### 1. Introduce a PR discovery layer

Add a small module-level strategy abstraction in `jira-plugin/src/content.jsx` or extract into a dedicated helper file:

```js
{
  endpointVariant: 'dev-status-1-detail',
  applicationType: 'gitlabselfmanaged',
  dataType: 'pullrequest',
  responseShape: 'detail.pullRequests',
  discoveredAt: 1772850000000,
  lastVerifiedAt: 1772850000000
}
```

This object represents the resolved Jira-specific PR fetch strategy.

### 2. Separate three concerns

Implement three distinct layers:

- `fetchCoreIssueData(issueKey)`
  - required for popup rendering
- `discoverPullRequestStrategy(issueId)`
  - optional, bounded, cached
- `fetchPullRequests(issueId, strategy)`
  - optional, normalized, failure-tolerant

Core issue rendering must never depend on discovery success.

### 3. Define endpoint candidates explicitly

Create a fixed ordered candidate list.

Initial detail candidates:

```text
/rest/dev-status/1.0/issue/detail
/rest/dev-status/latest/issue/detail
/rest/dev-status/1.0/issue/details
/rest/dev-status/latest/issue/details
```

Initial summary candidates:

```text
/rest/dev-status/1.0/issue/summary
/rest/dev-status/latest/issue/summary
```

Each endpoint candidate should define:

- path template
- required query params
- expected response roots (`detail`, `details`, `summary`)
- whether it is for `summary` or `detail`

### 4. Define application type candidates explicitly

Use a bounded ordered list:

```text
(none)
gitlabselfmanaged
gitlab
github
bitbucket
stash
```

Rules:

- Summary probes should run without `applicationType` first.
- Detail probes should test `(none)` first, then provider values.
- Stop probing after the first candidate that returns parseable PR objects.

### 5. Add response normalization

Implement a single normalization function for all development responses:

```js
normalizePullRequestPayload(response) => {
  pullRequests: [],
  summaryCount: number | null,
  source: {
    root: 'detail',
    shape: 'detail[0].pullRequests'
  }
}
```

Normalization should inspect, in order:

- `response.detail[].pullRequests`
- `response.detail[].pullrequests`
- `response.details[].pullRequests`
- `response.details[].pullrequests`
- single-object variants with `pullRequests`
- fallback empty result

This function should never throw.

### 6. Define “working” strategy criteria

A detail strategy is considered working if:

- the HTTP request succeeds, and
- the response shape is parseable, and
- either:
  - PR objects are present, or
  - the endpoint returns a valid development wrapper consistently

A summary strategy is considered useful if:

- the HTTP request succeeds, and
- a pull request count can be read from the response

Store summary and detail strategies separately if necessary.

## Caching Design

### Cache keys

Cache by Jira instance origin, not by issue:

```text
prStrategy::<jira-origin>
prSummaryStrategy::<jira-origin>
```

Example:

```text
prStrategy::https://jira.asseco-see.hr
```

### Cache payload

```js
{
  endpointPath: '/rest/dev-status/1.0/issue/detail',
  applicationType: 'gitlabselfmanaged',
  responseShape: 'detail.pullRequests',
  verified: true,
  discoveredAt: 1772850000000,
  lastVerifiedAt: 1772850300000,
  failureCount: 0
}
```

### Cache invalidation

- Reuse cached strategy for up to 7 days.
- If a cached strategy fails 2 consecutive times, mark it stale.
- When stale, run discovery again.
- If discovery still fails, keep popup working and suppress PRs.

## Implementation Steps

### Phase 1: Stabilize current code paths

1. Move all PR fetching behind a single safe wrapper:
   - `safeFetchPullRequests(issueData, instanceUrl)`
2. Guarantee this wrapper always resolves to:
   - `[]`
   - or a normalized PR array
3. Ensure all popup rendering uses only the normalized array.

### Phase 2: Build discovery primitives

1. Add endpoint candidate definitions.
2. Add application type candidate definitions.
3. Add request builders:
   - `buildDevStatusSummaryUrl(issueId, endpointVariant)`
   - `buildDevStatusDetailUrl(issueId, endpointVariant, applicationType)`
4. Add normalization helpers for summary and detail responses.

### Phase 3: Add strategy discovery

1. Try cached detail strategy first.
2. If missing or stale, run discovery:
   - probe summary endpoints first
   - probe detail endpoints second
3. Record:
   - which endpoint succeeded
   - which `applicationType` succeeded
   - which response shape matched

### Phase 4: Integrate with popup rendering

1. Load issue data as today.
2. Start PR fetch in optional flow after issue data.
3. If PR fetch completes before render cutoff, include PRs.
4. If not, render popup without PRs.
5. Optional enhancement:
   - patch PR rows into already-open popup when late result arrives

### Phase 5: Add diagnostics

Keep debug logging behind a single toggle:

- default off in normal builds
- enabled by:
  - local constant
  - or options flag

Log only:

- chosen strategy
- failed candidate count
- summary count if available
- normalized PR count

Avoid always logging full raw JSON in normal usage.

## Suggested Code Changes

### `jira-plugin/src/content.jsx`

Primary work:

- replace hardcoded PR URL construction
- add strategy discovery and cache lookup
- add normalized PR extraction
- make popup rendering independent from PR fetch failures

Suggested functions:

```js
getInstanceStrategyCacheKey(instanceUrl)
getSummaryStrategyCacheKey(instanceUrl)
loadCachedPullRequestStrategy(instanceUrl)
storeCachedPullRequestStrategy(instanceUrl, strategy)
buildDevStatusUrl(issueId, endpointPath, query)
normalizePullRequestPayload(response)
normalizePullRequestSummary(response)
discoverPullRequestStrategy(issueId, instanceUrl)
safeFetchPullRequests(issueId, instanceUrl)
```

### `jira-plugin/options/config.js`

Optional future enhancement:

- add `debugPullRequests: false`

This allows enabling diagnostics without shipping noisy logs by default.

### `jira-plugin/options/options.jsx`

Optional future enhancement:

- add a checkbox for `Enable PR debug logging`

This is not required for the first implementation.

## Failure Handling Rules

These rules should remain strict:

1. PR fetch failure must never prevent popup render.
2. Discovery failure must not retry endlessly on every mousemove.
3. Unknown response shapes must be logged only in debug mode.
4. Empty PR results are acceptable if Jira integration is partial.

## Testing Plan

### Manual scenarios

1. Jira instance with working GitHub integration
   - expect PRs displayed
2. Jira instance with self-managed GitLab integration
   - expect discovery to settle on correct endpoint/applicationType
3. Jira instance with no development integration
   - expect popup with no PRs and no regression
4. Jira instance where summary works but details do not
   - expect popup with no PRs, summary diagnostics only
5. Temporary Jira outage
   - expect popup failure only if core issue fetch fails
   - PR logic should not alter behavior

### Regression checks

- hover popup still appears on Outlook pages
- no console exceptions from PR logic
- issue rendering works when PR field is disabled
- strategy cache is reused between hovers

## Rollout Strategy

### Step 1

Restore robust non-breaking PR fetch behavior.

### Step 2

Implement adaptive endpoint and `applicationType` discovery behind debug logging.

### Step 3

Once validated on the target Jira instance, reduce logging noise and keep only compact strategy diagnostics.

## Expected Result

After this work, the extension should:

- continue showing the popup reliably
- adapt to different Jira dev-status endpoint variants
- adapt to different `applicationType` values
- avoid hardcoding provider assumptions where possible
- degrade gracefully when Jira exposes incomplete development data
