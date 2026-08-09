## MODIFIED Requirements

### Requirement: BDD keyword highlighting
The system SHALL visually highlight BDD keywords in rendered Markdown content to improve readability of spec documents.

Highlighting SHALL NOT reduce the font weight already applied by the surrounding markup.

#### Scenario: WHEN/GIVEN keyword highlighting
- **WHEN** rendered Markdown contains the word `WHEN` or `GIVEN` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a blue background label style (blue text on blue-tinted background)

#### Scenario: THEN keyword highlighting
- **WHEN** rendered Markdown contains the word `THEN` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a green background label style (green text on green-tinted background)

#### Scenario: AND keyword highlighting
- **WHEN** rendered Markdown contains the word `AND` as a standalone uppercase keyword
- **THEN** the keyword is displayed with a gray background label style (gray text on gray-tinted background)

#### Scenario: MUST/SHALL keyword highlighting
- **WHEN** rendered Markdown contains `MUST` or `SHALL` as standalone uppercase keywords
- **THEN** the keywords are displayed in red bold text

#### Scenario: ADDED/MODIFIED badge rendering
- **WHEN** rendered Markdown contains `ADDED` or `MODIFIED` as standalone uppercase keywords
- **THEN** `ADDED` is displayed as an orange badge and `MODIFIED` is displayed as a blue badge

#### Scenario: Highlighting does not weaken author emphasis
- **WHEN** a BDD keyword appears inside Markdown emphasis, such as `**SHALL**`
- **THEN** the rendered keyword is no lighter in weight than the emphasis the author applied

#### Scenario: Keywords inside code blocks are not highlighted
- **WHEN** BDD keywords appear inside inline code or fenced code blocks
- **THEN** the keywords are NOT highlighted and remain as plain code text

#### Scenario: Case-sensitive matching
- **WHEN** text contains lowercase or mixed-case variations like "when", "Then", "must"
- **THEN** the keywords are NOT highlighted (only exact uppercase matches trigger highlighting)

## ADDED Requirements

### Requirement: Rendered content is readable in every theme

Every colour the renderer applies to text — BDD keywords, badges, inline code, spec references — SHALL
be defined per theme rather than as one value shared by all themes, and SHALL meet WCAG 2 AA contrast of
at least 4.5:1 against the background it is actually rendered on, which for a keyword is its own label
background composited over the page.

This requirement exists because the capability previously stated obligations for the dark theme only.
No light-theme value was ever asserted, so none could fail, and every mark drifted to a value that is
unreadable there — `THEN` reached 1.43:1 while the specification remained satisfied.

Hue is not required to change between themes: the obligation is contrast, not appearance.

#### Scenario: Marks are readable in the light theme

- **WHEN** spec content is rendered with the light theme active
- **THEN** every BDD keyword, badge, inline code span and spec reference meets at least 4.5:1 contrast against its own background

#### Scenario: Marks are readable in the dark theme

- **WHEN** spec content is rendered with the dark theme active
- **THEN** every BDD keyword, badge, inline code span and spec reference meets at least 4.5:1 contrast against its own background

#### Scenario: Colours are theme-scoped

- **WHEN** the active theme changes
- **THEN** each mark takes that theme's own colour value rather than one value shared across themes
