## ADDED Requirements

### Requirement: Spec-shaped content is typeset by its own rules

The renderer SHALL accept, from its caller, a declaration that the content being rendered is
spec-shaped, and SHALL apply spec typography only under that declaration. It SHALL NOT decide this by
matching the text of the content.

In a spec-shaped document every level-2 heading is a structural separator — `## Purpose`,
`## Requirements`, `## ADDED Requirements` — whereas in a proposal or design document a level-2 heading
carries the content itself. One typography cannot serve both, and the styling suited to the second makes
the first outrank the requirements it merely groups.

Under that declaration, a level-2 heading SHALL be rendered as a subordinate label: less prominent than
the level-3 requirement headings beneath it, and less prominent than whatever names the document as a
whole. It SHALL NOT, however, be rendered less prominently than the level-4 headings nested inside those
requirements — demoting it past them would restore the same inversion one level down. Its heading
element and any `id` it carries SHALL be unchanged, because heading level determines where folded
sections end and heading ids are addressable anchors.

The declaration SHALL be independent of whether folding is requested. Folding is a view state its
reader controls and may switch off; being spec-shaped is a property of the document that no preference
alters. Deriving one from the other would let a display preference restyle the document's headings.

#### Scenario: A delta operation heading does not outrank its requirements

- **WHEN** spec-shaped content containing `## ADDED Requirements` followed by `### Requirement:` headings is rendered
- **THEN** the level-2 heading is rendered less prominently than the level-3 headings that follow it
- **AND** it is not rendered less prominently than the level-4 headings nested within them

#### Scenario: A main spec's structural headings are demoted on the same terms

- **WHEN** a spec's own detail view renders content containing `## Purpose` and `## Requirements`
- **THEN** those headings render as subordinate labels on the same terms as a delta operation heading
- **AND** the heading naming the spec as a whole remains the most prominent element on the page

#### Scenario: Non-spec documents are unaffected

- **WHEN** a change's proposal or design artifact is rendered
- **THEN** its level-2 headings render as content headings, exactly as before this capability existed

#### Scenario: Spec typography applies without folding

- **WHEN** spec-shaped content is rendered and folding is not requested
- **THEN** spec typography still applies

#### Scenario: Heading elements and ids are unchanged

- **WHEN** the same document is rendered with and without the spec-shaped declaration
- **THEN** every heading is the same element at the same level and carries the same `id` in both renderings

## MODIFIED Requirements

### Requirement: BDD keyword highlighting
The system SHALL visually highlight BDD keywords in rendered Markdown content to improve readability of spec documents.

Highlighting SHALL NOT reduce the font weight already applied by the surrounding markup.

Every delta operation OpenSpec defines SHALL be marked, not a subset of them. A marked vocabulary with
gaps in it is read as meaning that the unmarked words are ordinary prose, which is the opposite of what
an unhandled operation is.

Colour SHALL distinguish meanings rather than repeat them: an operation SHALL NOT be given the colour
already carrying normative force, so that a reader who has learned one mark does not have to unlearn it.

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

#### Scenario: Delta operation badge rendering
- **WHEN** rendered Markdown contains `ADDED`, `MODIFIED`, `REMOVED` or `RENAMED` as standalone uppercase keywords
- **THEN** `ADDED` is displayed as an orange badge and `MODIFIED` is displayed as a blue badge, as before
- **AND** `REMOVED` and `RENAMED` are each displayed as a badge in a colour distinct from those two and from each other

#### Scenario: No operation takes the normative colour
- **WHEN** the delta operation badges are compared with the `MUST`/`SHALL` styling
- **THEN** no operation badge uses the colour that marks normative keywords

#### Scenario: Highlighting does not weaken author emphasis
- **WHEN** a BDD keyword appears inside Markdown emphasis, such as `**SHALL**`
- **THEN** the rendered keyword is no lighter in weight than the emphasis the author applied

#### Scenario: Keywords inside code blocks are not highlighted
- **WHEN** BDD keywords appear inside inline code or fenced code blocks
- **THEN** the keywords are NOT highlighted and remain as plain code text

#### Scenario: Case-sensitive matching
- **WHEN** text contains lowercase or mixed-case variations like "when", "Then", "must"
- **THEN** the keywords are NOT highlighted (only exact uppercase matches trigger highlighting)
