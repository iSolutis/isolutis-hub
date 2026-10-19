## MODIFIED Requirements

### Requirement: Search focus management
The search input value, focus and cursor position SHALL be preserved and restored correctly on every re-render triggered by typing.

#### Scenario: Input retains its typed value across re-renders
- **WHEN** user types any character in the search input
- **THEN** the screen re-renders the filtered tree
- **AND** the search input shows the full text typed so far, not just the last character

#### Scenario: Input retains focus during typing
- **WHEN** user types in the search input
- **THEN** the input stays focused (cursor position is maintained)
- **AND** re-rendering of filtered tree does not blur the input
