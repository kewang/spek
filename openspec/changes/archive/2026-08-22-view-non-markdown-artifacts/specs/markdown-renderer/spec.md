## ADDED Requirements

### Requirement: Syntax highlighting for fenced code blocks
The system SHALL syntax-highlight fenced code blocks in rendered Markdown. It SHALL color the tokens by the language declared on the fence. Highlight colors SHALL be per-theme color tokens. Each highlight color SHALL meet the project's color-contrast obligation in the light theme and in the dark theme. Highlight colors SHALL NOT be shipped as untokenized literals. A code block whose fence declares no language SHALL render as plain, uncolored code, and SHALL raise no error. Highlighting SHALL NOT change the behavior that keeps BDD keywords unhighlighted inside code. Highlighting SHALL NOT weaken author emphasis. A `data` artifact renders through this same pipeline as a fenced block, so the highlighting SHALL apply to it and to code fences in other Markdown documents alike.

#### Scenario: A language-tagged code block is highlighted
- **WHEN** MarkdownRenderer receives a fenced code block tagged with a language (for example ` ```json `)
- **THEN** the block's tokens are colored by that language's syntax

#### Scenario: Highlight colors meet the contrast obligation in both themes
- **WHEN** a highlighted code block renders in the light theme and in the dark theme
- **THEN** every highlight color applied to code text meets the project's contrast standard in that theme

#### Scenario: A code block with no language renders plainly
- **WHEN** MarkdownRenderer receives a fenced code block with no language hint
- **THEN** the block renders as plain, uncolored code
- **AND** no error is raised

#### Scenario: A data artifact renders as a highlighted block
- **WHEN** a `data` artifact's content renders as a fenced code block with the language from its file extension
- **THEN** the content is syntax-highlighted by the same mechanism as any other fenced code block
