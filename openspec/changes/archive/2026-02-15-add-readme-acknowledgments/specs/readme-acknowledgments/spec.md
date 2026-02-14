## ADDED Requirements

### Requirement: README Acknowledgments section

README.md SHALL contain an `## Acknowledgments` section placed immediately before the `## License` section. The section SHALL credit the inspiration sources for the project.

#### Scenario: Acknowledgments section exists in README.md
- **WHEN** a user reads README.md
- **THEN** an `## Acknowledgments` section appears before `## License`
- **AND** it mentions 龍哥（高見龍）as the inspiration source
- **AND** it links to `https://kaochenlong.com/sdd-spec-driven-development`
- **AND** it links to `https://kaochenlong.com/spectra-with-openspec`
- **AND** it mentions that spek was created because Spectra has no Linux version

#### Scenario: README.zh-TW.md is in sync
- **WHEN** a user reads README.zh-TW.md
- **THEN** a corresponding acknowledgments section exists with the same content adapted to 繁體中文
