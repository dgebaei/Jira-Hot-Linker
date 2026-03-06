# Add Comment POC Plan
## Branch
poc/add-comment-from-popup
## Goal
Allow users to create a Jira comment directly from the hover popup, with save/discard controls and immediate rendering of the new comment on success.
## Scope
V1 includes:
- textarea at bottom of comments section
- Save and Discard buttons
- buttons disabled when textarea is empty
- comment POST to Jira
- success appends rendered comment locally or via refresh
- failure shows error and preserves typed content
V1 excludes:
- mentions autocomplete
- markdown toolbar
- attachments in comments
- draft persistence across popup close
## UX
Placement:
- bottom of the comments block
- if there are no comments, still show composer below the empty comments area when comments are enabled
Behavior:
- empty textarea: buttons disabled
- non-empty textarea: Save and Discard active
- Save -> loading state
- success:
  - append new comment to bottom of list
  - clear textarea
  - keep popup open
- Discard -> clear textarea and clear inline error
- failure:
  - show inline error
  - keep text intact
## Jira/API Strategy
Likely endpoint:
- POST /rest/api/2/issue/{issueKey}/comment
Payload:
`json
{ "body": "comment text" }
`
Server/DC compatibility note:
- start with plain-text body
- do not depend on Atlassian Document Format
Optional enhancement:
- after success, refetch comments from issue endpoint instead of constructing local comment object by hand
## Architecture Changes
### Background layer
Extend [background.js](/D:/Jira-HotLinker/jira-plugin/src/background.js):
- add generic authenticated JSON write request support if quick-actions branch has not already added it
### Content layer
Extend [content.jsx](/D:/Jira-HotLinker/jira-plugin/src/content.jsx):
- add local composer state:
  - text
  - saving
  - error
- add submit handler
- add discard handler
- add success rerender logic
Preferred success path:
1. POST comment
2. refetch issue data for same key
3. rebuild comments list using existing rendering path
4. rerender popup
This avoids duplicating comment formatting logic.
### Template/CSS
Update:
- [annotation.html](/D:/Jira-HotLinker/jira-plugin/resources/annotation.html)
- [content.scss](/D:/Jira-HotLinker/jira-plugin/src/content.scss)
Need:
- textarea
- save/discard buttons
- inline error/saving state
- styling consistent with current popup
## State Model
Suggested runtime state:
`js
{
  commentDraft: '',
  commentSaving: false,
  commentError: ''
}
`
## Success Criteria
- users can type and submit a comment from the popup
- failed saves do not lose text
- successful saves appear immediately in the popup
- popup remains open throughout
## Implementation Order
1. Add generic write request support in background
2. Add comment composer markup and styling
3. Add textarea/button state handling
4. POST comment to Jira
5. On success, refetch issue and rerender comments
6. Add inline error handling and polish
## Testing
- save valid comment -> appears at bottom
- save empty comment -> blocked in UI
- network/Jira error -> error shown, text preserved
- multi-line comment -> preserved correctly
- popup remains responsive after repeated saves
## Notes
This is the cleanest write POC because comment creation uses a standard Jira API and already maps naturally onto the existing popup layout.
