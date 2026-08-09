## MODIFIED Requirements

### Requirement: Spec detail display
The system SHALL display the full content of a spec when the user navigates to its detail page. The
content SHALL be rendered as Markdown, with its requirements and scenarios folded according to the
spec section folding capability, and SHALL offer the controls to expand and collapse every section.

#### Scenario: View spec content
- **WHEN** user navigates to `/specs/:topic`
- **THEN** system displays the spec topic as title and the full spec.md content, rendered as Markdown

#### Scenario: Requirements and scenarios are folded
- **WHEN** the rendered spec contains requirement and scenario headings
- **THEN** each requirement is shown expanded and each scenario is shown collapsed, with controls available to expand or collapse all sections

#### Scenario: Spec not found
- **WHEN** user navigates to a spec topic that does not exist
- **THEN** system displays a "not found" message
