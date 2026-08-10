## ADDED Requirements

### Requirement: A delta spec's topic outranks the content it contains

Where the Specs tab renders several delta specs in one view, each spec's topic header SHALL be more
prominent than every heading belonging to that spec's own content, and SHALL NOT sit at a deeper level
of the document outline than the headings it encloses.

The topic header is the only thing telling a reader which spec they are looking at once several are
stacked. Presented below the rank of a grouping label repeated inside each spec, it stops performing
that job — the reader scrolls past a boundary without registering that one occurred.

#### Scenario: Topic header outranks the content's own headings

- **WHEN** the Specs tab renders a delta spec containing a `## ADDED Requirements` heading
- **THEN** the spec's topic header is rendered more prominently than that heading

#### Scenario: Topic header is not nested below its content in the outline

- **WHEN** the Specs tab renders a delta spec
- **THEN** the topic header's heading level is no deeper than the level of any heading in that spec's content

#### Scenario: Every stacked spec is bounded the same way

- **WHEN** the Specs tab renders two or more delta specs
- **THEN** each spec is introduced by its own topic header on identical terms, so each boundary between specs is marked
