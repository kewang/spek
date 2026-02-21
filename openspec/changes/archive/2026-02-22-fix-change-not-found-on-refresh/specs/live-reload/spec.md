## MODIFIED Requirements

### Requirement: Debounced re-fetch in useAsyncData
The `useAsyncData` hook SHALL support automatic re-fetch triggered by `refreshKey` changes with debounce to avoid excessive requests.

#### Scenario: Re-fetch on refreshKey change
- **WHEN** `refreshKey` changes in the `RefreshContext`
- **THEN** `useAsyncData` triggers a new fetch after a 300ms debounce delay

#### Scenario: Debounce coalesces rapid changes
- **WHEN** `refreshKey` changes multiple times within 300ms
- **THEN** only one re-fetch is triggered after the last change

#### Scenario: Existing data preserved during re-fetch
- **WHEN** a re-fetch is triggered by `refreshKey` change
- **THEN** the existing `data` SHALL remain visible (no loading flash) until the new data arrives

#### Scenario: Refresh failure with existing data
- **WHEN** a re-fetch triggered by `refreshKey` change fails with an error
- **AND** the hook already has existing data from a previous successful fetch
- **THEN** the existing `data` SHALL be preserved
- **AND** the `error` state SHALL NOT be set (remains null)

#### Scenario: Refresh failure without existing data
- **WHEN** a re-fetch triggered by `refreshKey` change fails with an error
- **AND** the hook has no existing data (data is null)
- **THEN** the `error` state SHALL be set to the error message
