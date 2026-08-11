## ADDED Requirements

### Requirement: Spec headings render without their format keyword

Under the spec-shaped declaration, and only under it, the renderer SHALL display a requirement heading
and a scenario heading without the leading OpenSpec format keyword. `### Requirement: Single YAML
manifest as source of truth` SHALL render as *Single YAML manifest as source of truth*.

The keyword is removable because position already carries it: under a delta operation heading every
level-3 heading is a requirement, and inside a requirement every level-4 heading is a scenario. Repeating
it takes the same characters off the front of every heading in the document, and takes them from the
front — where a reader scanning a column of headings looks for what distinguishes one from the next, and
where the narrowest host has the least room to give.

This SHALL NOT weaken the rule that the renderer is told its content is spec-shaped rather than deducing
it. The keyword is matched only after the caller has declared the content spec-shaped, and matching it
SHALL NOT be used to decide that a document is spec-shaped.

Whether a heading carries the keyword SHALL be decided from the heading's text **in full**, not from
whatever fragment of it happens to come first. A requirement named after a code span begins
`Requirement: ` and then leaves the markup — decide from the fragment and that heading keeps its keyword
while the table of contents, which reads the file's own line, drops it, producing on the very first real
document the disagreement between surfaces that stating the rule once exists to prevent. Where the
keyword does not lie wholly within the heading's leading run of plain text, the heading SHALL render
unchanged: eliding across markup would mean deleting part of the author's structure.

The elision SHALL apply at every heading level, not at a chosen pair of them. Level is not what makes a
heading a requirement — the keyword is — and the surfaces that display headings do not agree on which
levels they show: the rendered content shows all of them and the table of contents shows two. Gate on
level and the same heading is elided on one surface and not on the other, which is the disagreement
again by another route.

The elision SHALL be presentational only. Each heading's element, its level, and its `id` SHALL be
exactly what they would be without it. The `id` in particular is derived from the authored heading text
and is the anchor every deep link, the scrollspy, the table of contents and the VS Code sidebar resolve
against; those anchors are computed from the file's own text elsewhere, so an `id` built from the elided
text would leave every one of them pointing at nothing.

Text that does not match the format keyword SHALL render exactly as authored, which is also what happens
under a workflow schema whose format uses different keywords: no match, no elision.

#### Scenario: A requirement heading renders without its keyword

- **WHEN** spec-shaped content containing `### Requirement: Foo` is rendered
- **THEN** the heading displays as `Foo`

#### Scenario: A scenario heading renders without its keyword

- **WHEN** spec-shaped content containing `#### Scenario: bar happens` is rendered
- **THEN** the heading displays as `bar happens`

#### Scenario: A heading whose name begins with a code span is elided

- **WHEN** spec-shaped content containing ``### Requirement: `@spekjs/ui` package exports reusable components`` is rendered
- **THEN** the heading displays as `` `@spekjs/ui` package exports reusable components ``, the code span intact and the space before it preserved

#### Scenario: A heading at another level is elided on the same terms

- **WHEN** spec-shaped content containing `## Requirement: Foo` is rendered
- **THEN** the heading displays as `Foo`, matching what the table of contents shows for it

#### Scenario: The heading's id is built from the authored text

- **WHEN** spec-shaped content containing `### Requirement: Foo` is rendered
- **THEN** the rendered heading's `id` is the slug of `Requirement: Foo`, identical to the id the same content produces without the elision
- **AND** a link to that id still resolves to the heading

#### Scenario: Heading elements and levels are unchanged

- **WHEN** the same spec-shaped content is rendered with and without the elision
- **THEN** every heading is the same element at the same level in both renderings

#### Scenario: Non-spec documents are unaffected

- **WHEN** a change's proposal or design artifact is rendered without the spec-shaped declaration
- **THEN** a heading reading `Requirement: Foo` renders with its text unchanged

#### Scenario: Structural headings are unaffected

- **WHEN** spec-shaped content containing `## ADDED Requirements` and `## Purpose` is rendered
- **THEN** those headings render with their text unchanged

#### Scenario: A heading the format keyword does not match renders verbatim

- **WHEN** spec-shaped content contains a level-3 heading whose text does not begin with a format keyword
- **THEN** it renders exactly as authored
