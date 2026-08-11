## MODIFIED Requirements

### Requirement: Specs tab heading slug prefix
When the Specs tab renders multiple delta specs in a single change, each spec's heading ids SHALL be prefixed with the spec topic using the format `<topic>--<slug>` to prevent id collisions across specs. The slug SHALL continue to be derived from the heading's authored text, including any OpenSpec format keyword it carries, so that prefixing is the only difference between these ids and the spec detail page's.

The TOC entries SHALL display each heading as the Specs tab's content displays it — without the topic prefix, and without the OpenSpec format keyword where the content elides it — while the anchor links SHALL use the prefixed form. The elision SHALL apply to the Specs tab only: the TOC over a change's proposal or design artifact SHALL show heading text exactly as authored, because those artifacts are not spec-shaped and the tab a TOC is built from is what decides this, never the text of a heading.

#### Scenario: Distinct slugs across specs with duplicate heading
- **WHEN** a change's Specs tab contains two delta specs each with a `### Requirement: Foo`
- **THEN** the two resulting heading elements have distinct ids of the form `<topic-a>--requirement-foo` and `<topic-b>--requirement-foo`
- **AND** both appear in the TOC with label "Foo"

#### Scenario: TOC anchor uses prefixed slug
- **WHEN** user clicks a TOC entry for a heading in the Specs tab
- **THEN** the URL hash is set to the prefixed form `<topic>--<slug>` and the matching element scrolls into view

#### Scenario: A prose artifact's TOC is not elided
- **WHEN** user views the Proposal tab of a change whose proposal contains a heading reading `Requirement: Foo`
- **THEN** that TOC entry reads `Requirement: Foo`

#### Scenario: SpecDetail page slugs remain unprefixed
- **WHEN** user views a spec at `/specs/:topic`
- **THEN** the heading ids remain the original unprefixed slugs (behavior unchanged from the existing spec detail TOC)
