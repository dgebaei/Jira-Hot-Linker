# Test Plan: Display Field Configuration

## Goal
Add E2E tests that verify the popup renders correctly under different `displayFields` and `tooltipLayout` configurations.

## Test cases needed

### Field visibility toggling
- Each display field can be individually hidden (`displayFields.X = false`) and the corresponding section disappears from the popup
- Hidden fields do not leave empty rows or broken layout
- Re-enabling a previously hidden field makes it appear again

### Row ordering
- Fields in `tooltipLayout.row1/row2/row3` render in the specified order within each row
- Moving a field from one row to another (e.g., `epicParent` from row1 to row2) correctly relocates it
- Empty rows (all fields hidden) are not rendered

### Content block ordering
- `tooltipLayout.contentBlocks` order is respected (e.g., `['comments', 'description']` shows comments before description)
- Hiding a content block via `displayFields` removes it from the rendered output without affecting other blocks

### Custom fields
- Custom fields appear in their configured row position
- Custom fields respect the layout ordering alongside built-in fields

### Edge cases
- All fields disabled except one
- Empty `tooltipLayout` falls back to defaults
- Partial `tooltipLayout` (e.g., only `row1` specified) uses defaults for missing rows

## Pre-existing flakiness
- `updates sprint and version fields through edit popovers` is intermittently failing (~33% failure rate) due to timing issues with the sprint option dropdown. This should be investigated and stabilized separately.
