## MODIFIED Requirements

### Requirement: Scan OpenSpec directory structure
The scanner SHALL be a pure function in the `@spek/core` package that reads an OpenSpec directory and returns its complete structure including specs, active changes, and archived changes. It SHALL use Node.js `fs/promises` directly and have no dependency on Express or any HTTP framework.

#### Scenario: Scan repo with full OpenSpec structure
- **WHEN** scanner is given a repo path containing `openspec/specs/` and `openspec/changes/`
- **THEN** it returns a structure with `specs` (list of topic names), `activeChanges` (changes directly under `openspec/changes/` excluding `archive/`), and `archivedChanges` (changes under `openspec/changes/archive/`)

#### Scenario: Scan repo with empty OpenSpec directory
- **WHEN** scanner is given a repo path where `openspec/` exists but contains only `config.yaml`
- **THEN** it returns empty arrays for specs, activeChanges, and archivedChanges

### Requirement: Parse change artifacts
The scanner SHALL read individual change directories and extract available artifacts.

#### Scenario: Change with all artifacts
- **WHEN** scanner reads a change directory containing proposal.md, design.md, tasks.md, and specs/
- **THEN** it returns the raw Markdown content for each artifact and a list of delta spec files

#### Scenario: Change with partial artifacts
- **WHEN** scanner reads a change directory containing only proposal.md
- **THEN** it returns proposal content and null for missing artifacts

### Requirement: Read spec content
The scanner SHALL read spec files and return their Markdown content.

#### Scenario: Read existing spec
- **WHEN** scanner reads `openspec/specs/{topic}/spec.md`
- **THEN** it returns the raw Markdown content of the spec file

### Requirement: Detect related changes for a spec
The scanner SHALL identify which changes contain delta specs for a given spec topic.

#### Scenario: Spec with related changes
- **WHEN** scanner checks for changes related to spec topic "simulation-engine"
- **THEN** it returns all change slugs that have a `specs/simulation-engine/spec.md` delta file
