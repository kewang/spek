## ADDED Requirements

### Requirement: Specs tab folds delta spec content

The Specs tab SHALL render each delta spec with its requirements and scenarios folded on the same rules
as a spec detail view, and SHALL offer the same controls to expand and collapse every section.

A change's delta specs and the specs they modify are the same kind of document, so a reader who has
learned how one reads SHALL NOT meet a different presentation in the other. The change's other
artifacts — proposal, design, tasks — are unaffected and continue to render unfolded.

#### Scenario: Delta specs render folded

- **WHEN** the user opens a change's Specs tab and the change has delta specs
- **THEN** each delta spec's requirements are shown expanded and its scenarios are shown collapsed

#### Scenario: Bulk controls on the Specs tab

- **WHEN** the user activates expand all or collapse all while on the Specs tab
- **THEN** every section across all of the tab's delta specs changes accordingly

#### Scenario: Other artifact tabs are unaffected

- **WHEN** the user switches from the Specs tab to a markdown artifact tab such as proposal or design
- **THEN** that artifact's content renders unfolded

#### Scenario: TOC navigation into folded delta spec content

- **WHEN** the user activates a TOC entry for a heading inside a collapsed section of a delta spec
- **THEN** the enclosing sections are opened and the heading is scrolled into view
