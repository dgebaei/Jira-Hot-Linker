# Jira HotLinker

> Turn plain Jira issue keys into instant, rich previews and in-place actions across the tools your team already lives in.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-1f6feb?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-0f766e?style=for-the-badge)
![MIT License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)

## See it in action

Hover a Jira key and the extension brings the issue into view with context, actions, and linked development details right where you are already working.

## The pitch

Jira keys are everywhere, but the context usually is not. You see `PROJ-1842` in a pull request, an email, a doc, or a comment thread, and then the tab-hopping begins.

Jira HotLinker brings that context to you instantly. Hover an issue key and get the title, status, priority, description, comments, attachments, related pull requests, and more - without leaving the page.

And it does not stop at reading. The extension also lets you update issues directly from the hover card, using Jira's own available values, transitions, and rules so your edits stay aligned with the validation already configured in Jira.

It is the kind of extension that feels small until you use it for a day - then you do not want to work without it.

Another important detail: Jira HotLinker does not ask you to hand over Jira credentials to a separate service. It works through your existing browser session, sending requests from the browser with the Jira access you already have.

## Why it feels great

- Instant context exactly where the Jira key appears
- Fewer tabs, fewer context switches, less waiting
- Fast issue updates without losing your place
- Works across the real tools teams use all day
- Honors Jira workflows instead of fighting them
- Does not rely on storing your Jira username or password in the extension

## Why people install it

- Stay in the conversation instead of bouncing between browser tabs
- Understand a ticket before opening Jira
- Make quick Jira updates in place instead of breaking focus to open the full issue page
- Review code and product discussions with live Jira context nearby
- Make Git providers, mail, docs, Jira, and Confluence all feel connected
- Give your team fast access to the fields that actually matter

## Without it / With it

**Without Jira HotLinker**

- You spot `PROJ-1842` in a PR, email, or doc
- You open Jira in another tab
- You wait for the issue to load
- You hunt for status, priority, comments, and related work
- You jump back to where you started and repeat the cycle again

**With Jira HotLinker**

- You hover `PROJ-1842`
- The ticket comes to you instantly
- You see the important context right on the page
- You keep reading, reviewing, replying, or shipping
- You stay in flow

## Where it shines

- Reviewing pull requests across GitHub, GitLab, Bitbucket, and other Git providers
- Checking ticket status and priority during code review
- Looking up descriptions, comments, and attachments without leaving the page you are on
- Reading Jira references inside Gmail, Outlook, Google Docs, Jira, or Confluence
- Following linked pull requests and related development activity faster
- Surfacing custom Jira fields that matter to your team

## Built for the messy real world

- Git platforms: GitHub, GitLab, Bitbucket, and similar review or repo tools
- Email and communication: Gmail, Outlook, and any web app where Jira keys appear in text
- Documents and knowledge tools: Google Docs, Jira, Confluence, and other configurable pages
- Team-specific workflows: any internal tool or custom domain you choose to enable

## What it can do

- Detect Jira issue keys on the pages you use most and turn them into rich hover cards
- Work across Git providers, email tools, docs, and collaboration apps through configurable domain matching
- Display ticket title, type, status, priority, labels, sprint, versions, epic/parent, reporter, and assignee
- Render the issue description, comments, and attachment previews
- Show related pull requests and development signals
- Edit supported issue fields directly from the popup and trigger Jira-backed actions like assign-to-me, sprint updates, and workflow transitions
- Respect Jira-side options, workflows, and validation behavior instead of inventing its own rules
- Let you drag and pin the ticket card while you work
- Copy the issue key and title to the clipboard
- Configure which domains are scanned and which Jira fields are visible
- Add Jira custom fields to the top summary rows

## Feature tour

Imagine the moment a Jira key appears on screen:

1. You hover the issue key.
2. A polished preview opens with the ticket title and triage details.
3. Status, priority, labels, sprint, versions, and ownership are immediately visible.
4. Description, comments, and attachments are right there when you need deeper context.
5. When action is needed, you can update supported fields directly from the popup and use quick issue actions without losing your place.
6. Those edits follow Jira's available options and workflow validation, so the extension fits the process your team already uses.
7. Related pull requests and development signals help you connect discussion to delivery.
8. If the ticket matters, you can pin the card, keep it nearby, and continue working.

## Install in minutes

### Install from the Chrome Web Store

If the idea already clicks, install it here:

https://chrome.google.com/webstore/detail/jira-hotlinker/lbifpcpomdegljfpfhgfcjdabbeallhk

Install it, point it at your Jira instance, and you can start hovering issue keys almost immediately.

After installing:

1. Open the extension options page.
2. Enter your Jira instance URL, for example `https://your-company.atlassian.net/`.
3. Save the configuration and grant the requested permissions.
4. Visit any allowed page that contains Jira issue keys.

By default, GitHub is enabled, but that is only the starting point. You can add other Git providers and everyday tools such as Gmail, Outlook, Google Docs, Jira, and Confluence from the options page or directly from the extension action.

## Privacy and authentication

Jira HotLinker uses your existing Jira login session in the browser. In plain terms, if you are already signed in to Jira in your browser, the extension can request issue data with that same authenticated session.

- No separate Jira password is stored by the extension
- No extra credential vault or external account link is required
- Requests are made from your browser to your Jira instance using the access you already have
- What you can view or update still depends on your Jira permissions, workflow rules, and field validation

### Local development setup

```bash
npm install
npx webpack-cli
```

Then load the unpacked extension from `jira-plugin/` in Chrome.

For active development:

```bash
npm run dev
```

Useful commands:

- `npm run dev` - rebuilds on file changes
- `npx webpack-cli` - creates a production build in `jira-plugin/`
- `make build` - builds and creates a zip archive

## Configuration highlights

- `Jira instance URL` points the extension at the Jira site used for issue metadata
- `Allowed pages` controls where ticket detection is active
- `Tooltip Layout` lets you choose which built-in fields appear in the hover card
- `Custom Fields` lets you add Jira field IDs such as `customfield_12345` and place them in summary rows

## Finding custom field IDs

Want to surface a Jira custom field in the hover card? You will need the field ID, which usually looks like `customfield_12345`.

Here are the easiest ways to find it in your Jira instance:

- Use Jira issue search: when you search for a custom field in JQL, Jira often shows the field ID alongside the field name, which makes it easy to spot values like `customfield_12345`
- Open a Jira issue, inspect the page or network requests, and look for field keys named like `customfield_12345`
- Visit your Jira field metadata endpoint while signed in: `https://your-jira/rest/api/2/field`
- Search the returned list for the field name you care about, then copy its `id`
- Paste that value into the extension options page under `Custom Fields`

If the field ID is valid, the options page will try to resolve and display the field name for you.

## Direct issue editing

Jira HotLinker is not just a viewer. It can help you act on issues right from the preview.

- Update supported fields such as sprint and versions from inline controls
- Run quick actions like assigning the issue to yourself or moving it into progress when Jira allows it
- Use Jira-provided values and transitions instead of hardcoded shortcuts
- Stay aligned with workflow restrictions, field constraints, and validation behavior already defined in Jira

## In one sentence

Jira HotLinker makes every Jira key on the web feel alive, actionable, and useful.

## For developers

- `jira-plugin/src/` - content script, background logic, and UI behavior
- `jira-plugin/options/` - options page UI and configuration flow
- `jira-plugin/manifest.json` - Chrome extension manifest
- `webpack.config.js` - build pipeline for the extension bundles

## Thank you

Special thanks to the original extension author, Willem D'Haeseleer, for creating Jira HotLinker and laying the foundation for this project.

## License

This project is released under the MIT License. See `LICENSE.md`.
