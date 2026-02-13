## ADDED Requirements

### Requirement: Capability ID linking in proposal
The system SHALL render inline code elements in proposal markdown as navigable links when the code text matches an existing spec topic name.

#### Scenario: Capability ID matches existing spec
- **WHEN** a proposal markdown contains an inline code element (e.g., `` `responsive-layout` ``)
- **AND** a spec with the topic name `responsive-layout` exists
- **THEN** the inline code SHALL be rendered as a clickable link navigating to `/specs/responsive-layout`

#### Scenario: Inline code does not match any spec
- **WHEN** a proposal markdown contains an inline code element that does not match any existing spec topic
- **THEN** the inline code SHALL be rendered as a normal styled code element without a link

#### Scenario: MarkdownRenderer receives spec topics list
- **WHEN** MarkdownRenderer is used with a `specTopics` prop containing the list of available spec topic names
- **THEN** inline code matching any topic in the list SHALL be rendered as navigable links
