## ADDED Requirements

### Requirement: Spec heading display label utility

The core module SHALL export `specHeadingLabel(text: string): string` from the same browser-safe entry
point as `extractHeadings` and `slugifyHeading`. Given a heading's authored text it SHALL return the
text a host displays for that heading: the leading OpenSpec format keyword (`Requirement:` or
`Scenario:`) removed, and in every other case the input returned unchanged.

The argument SHALL be a heading's text **in full**. Every caller has the whole heading available, and
the rule's decisions — whether a keyword is present, and whether anything remains after it — are only
correct when made over the whole of it. A caller holding the heading as a sequence of pieces SHALL
assemble the text before asking.

What is removed SHALL be exactly the keyword, its colon, and the run of spaces and tabs immediately
following it — nothing else. In particular the result SHALL NOT be trimmed at its end: a heading
continues into markup the label does not carry (`Requirement: The \`foo\` flag …` leaves a text run
ending in a space, and dropping that space closes up the gap before the code span).

Matching SHALL be exact — the keyword spelled and capitalised as OpenSpec's format writes it,
immediately followed by a colon, at the start of the text. A variant OpenSpec's own parser would not
accept SHALL NOT be elided: spek renders what a file contains, and quietly normalising a heading the
tooling rejects would present a malformed document as a well-formed one. For the same reason the text
SHALL be returned unchanged when what follows the colon is empty after trimming — a heading whose entire
content is the keyword has no other name to show.

The utility SHALL NOT be applied by `extractHeadings`, and no value SHALL be derived from its result.
`Heading.text` is what the file says, `Heading.slug` is derived from `Heading.text`, and the display
label is a third value that nothing else depends on. Deriving a slug from the label would change every
requirement anchor while the rendered content's ids continued to be built from the authored text.

The rule SHALL be stated in this one place. Four surfaces across two packages display heading text, and
a copy per surface is how the sidebar and the content come to disagree about what a heading is called.

#### Scenario: A requirement heading's keyword is elided

- **WHEN** `specHeadingLabel("Requirement: Single YAML manifest as source of truth")` is called
- **THEN** it returns `"Single YAML manifest as source of truth"`

#### Scenario: A scenario heading's keyword is elided

- **WHEN** `specHeadingLabel("Scenario: manifest declares both channels")` is called
- **THEN** it returns `"manifest declares both channels"`

#### Scenario: Text carrying no format keyword is returned unchanged

- **WHEN** `specHeadingLabel("ADDED Requirements")` is called
- **THEN** it returns `"ADDED Requirements"`

#### Scenario: A heading whose name begins with inline markup is elided

- **WHEN** `specHeadingLabel("Requirement: \`@spekjs/ui\` package exports reusable components")` is called
- **THEN** it returns `"\`@spekjs/ui\` package exports reusable components"`

#### Scenario: Trailing whitespace is preserved

- **WHEN** `specHeadingLabel("Requirement: The ")` is called
- **THEN** it returns `"The "`, the trailing space intact

#### Scenario: A keyword-only heading is returned unchanged

- **WHEN** `specHeadingLabel("Requirement:")` is called
- **THEN** it returns `"Requirement:"`

#### Scenario: A keyword followed only by whitespace is returned unchanged

- **WHEN** `specHeadingLabel("Requirement:   ")` is called
- **THEN** it returns `"Requirement:   "`

#### Scenario: A case variant is returned unchanged

- **WHEN** `specHeadingLabel("requirement: lowercase keyword")` is called
- **THEN** it returns `"requirement: lowercase keyword"`

#### Scenario: A keyword that is not at the start is returned unchanged

- **WHEN** `specHeadingLabel("Optional Requirement: something")` is called
- **THEN** it returns `"Optional Requirement: something"`

#### Scenario: Heading extraction is unaffected

- **WHEN** `extractHeadings(content)` is called on content containing `### Requirement: Foo`
- **THEN** the returned entry's `text` is `"Requirement: Foo"` and its `slug` is `"requirement-foo"`
