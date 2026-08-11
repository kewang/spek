## ADDED Requirements

### Requirement: TOC entries read as the content reads

Each entry in the spec detail TOC sidebar SHALL be labelled with the same display text the rendered
content shows for that heading, so that a reader looking for a requirement in the sidebar is looking for
the words they can see in the page. Where the content displays a requirement heading without its
OpenSpec format keyword, the TOC entry SHALL omit it too.

Navigation SHALL be unaffected: each entry SHALL continue to link by the slug derived from the heading's
authored text. Only the label changes, so a TOC built from the file and content rendered from the same
file continue to address the same anchors.

#### Scenario: A requirement entry drops the format keyword

- **WHEN** a spec containing `### Requirement: Foo` is viewed with the TOC sidebar visible
- **THEN** the TOC entry for that heading reads `Foo`

#### Scenario: The entry still navigates to its heading

- **WHEN** the user clicks that TOC entry
- **THEN** the main content scrolls to the heading and the URL hash is the slug of the authored text, unchanged from before the label was elided

#### Scenario: An entry with no format keyword is unchanged

- **WHEN** the spec contains `## Purpose`
- **THEN** its TOC entry reads `Purpose`
