## MODIFIED Requirements

### Requirement: Overview statistics display
The system SHALL display overview statistics from the overview API: total specs count, active changes count, archived changes count, and task completion rate (percentage). Statistics SHALL be displayed in stat cards with large numbers (text-4xl) and a staggered fade-in-up entry animation on page load.

#### Scenario: Display statistics
- **WHEN** user navigates to the Dashboard page
- **THEN** system displays specs count, active changes count, archived changes count, and overall task completion percentage in stat cards with large accent-colored numbers

#### Scenario: Staggered entry animation
- **WHEN** the Dashboard page loads
- **THEN** the four stat cards appear with a fade-in-up animation, each card delayed by an incremental amount (e.g., 0ms, 80ms, 160ms, 240ms) creating a staggered reveal effect

#### Scenario: Reduced motion preference
- **WHEN** user has `prefers-reduced-motion: reduce` enabled
- **THEN** stat cards appear immediately without animation
