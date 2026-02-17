## MODIFIED Requirements

### Requirement: Spec history timeline UI
The system SHALL display a visual timeline on the SpecDetail page showing all changes that affected the spec. Each timeline entry MUST display the date, change description, and a link to the change detail page. Each timeline entry SHALL also include a "Compare" action that triggers diff comparison against the current spec content.

#### Scenario: Display history timeline
- **WHEN** the SpecDetail page is rendered for a spec with related changes
- **THEN** a "History" section is displayed with a vertical timeline showing each change chronologically

#### Scenario: Timeline entry links to change
- **WHEN** the user clicks on a timeline entry's title or description
- **THEN** the system navigates to the corresponding change detail page

#### Scenario: No history
- **WHEN** the SpecDetail page is rendered for a spec with no related changes
- **THEN** the "History" section displays a message indicating no changes have affected this spec

#### Scenario: Timeline entry compare action
- **WHEN** the user clicks the "Compare" action on a timeline entry
- **THEN** the system enters diff comparison mode showing the difference between that change version and the current spec content
