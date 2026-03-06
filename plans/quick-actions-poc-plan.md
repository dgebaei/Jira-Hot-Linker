# Quick Actions POC Plan
## Branch
poc/quick-actions
## Goal
Add low-friction one-click Jira actions to the hover popup, with success/error feedback and in-place state refresh.
## Recommended Initial Scope
Implement only these actions in V1:
- Assign to me
- Move to current sprint
- Start progress
Do not include workflow-heavy or ambiguous actions yet:
- resolve/close
- arbitrary transitions
- add/remove labels
## UX
Default placement:
- header-level Actions dropdown near the copy button
Behavior:
- click Actions
- open small menu listing currently available actions
- click action
- action shows loading state
- on success, refresh popup issue state and rerender
- on failure, show error and keep popup open
Future option:
- settings toggle for Menu vs Inline row
## Jira/API Strategy
### Assign to me
Likely endpoint:
- PUT /rest/api/2/issue/{issueKey}/assignee
Payload:
- Jira Server/DC may accept current username or account identifier depending on deployment
- first discover current user from Jira session API or issue/self context
### Move to current sprint
Needs:
- sprint custom field id
- current active sprint id
Likely steps:
1. resolve sprint custom field id from /rest/api/2/field
2. resolve active sprint from Agile API or configured board context
3. PUT /rest/api/2/issue/{issueKey} with sprint field update
Risk:
- current sprint is board-dependent
- may require board selection logic or fallback to the single active sprint if only one exists
### Start progress
Needs:
- transition lookup, not direct status field update
Likely steps:
1. GET /rest/api/2/issue/{issueKey}/transitions
2. find transition matching In Progress or similar configured target
3. POST /rest/api/2/issue/{issueKey}/transitions
Risk:
- workflow names differ across projects
- transition availability depends on current status and permissions
## Architecture Changes
### Background layer
Extend [background.js](/D:/Jira-HotLinker/jira-plugin/src/background.js):
- add generic authenticated request handler for POST and PUT
- support JSON body
- preserve Jira-origin restriction
Suggested message shape:
`js
{ action: 'requestJson', method: 'PUT', url, body }
`
### Content layer
Extend [content.jsx](/D:/Jira-HotLinker/jira-plugin/src/content.jsx):
- add popup-local action state
- add capability resolver for which actions are available for the current issue
- add click handlers for action execution
- add efreshIssueData(issueKey) path to refetch and rerender popup after success
### Template/CSS
Update:
- [annotation.html](/D:/Jira-HotLinker/jira-plugin/resources/annotation.html)
- [content.scss](/D:/Jira-HotLinker/jira-plugin/src/content.scss)
Need:
- header dropdown button
- actions menu
- per-action loading state
- inline error/success notice or snackbar integration
## State Model
Suggested runtime state in content script:
`js
{
  actionsOpen: false,
  actionLoadingKey: '',
  actionError: '',
  lastActionSuccess: ''
}
`
## Success Criteria
- popup stays open after action
- updated assignee/sprint/status is visible immediately after refresh
- failures do not close popup
- unavailable actions are hidden or disabled
## Implementation Order
1. Add generic write request support in background
2. Implement Assign to me
3. Add popup refresh-after-write
4. Implement Start progress
5. Implement Move to current sprint
6. Add dropdown polish and availability filtering
## Testing
### Assign to me
- issue unassigned -> becomes assigned to current user
- issue assigned to someone else -> changes correctly
- permission failure -> error shown, popup remains usable
### Start progress
- available transition exists -> status updates
- transition missing -> action hidden or disabled
- workflow blocks transition -> error shown
### Move to current sprint
- one active sprint exists -> issue added successfully
- no active sprint -> action hidden or disabled
- multiple active sprints / ambiguous board context -> action not offered in V1
## Notes
This is the best first write-action POC because it avoids inline editing complexity while proving:
- authenticated write calls
- popup state refresh
- reusable action execution framework
