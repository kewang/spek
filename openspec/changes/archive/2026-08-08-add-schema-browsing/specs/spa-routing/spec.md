## MODIFIED Requirements

### Requirement: Client-side routing
The system SHALL use React Router v7 with `createBrowserRouter` to define the following routes:

| Path | Page | Layout |
|------|------|--------|
| `/` | SelectRepo | None |
| `/dashboard` | Dashboard | Layout |
| `/specs` | SpecList | Layout |
| `/specs/:topic` | SpecDetail | Layout |
| `/changes` | ChangeList | Layout |
| `/changes/:slug` | ChangeDetail | Layout |
| `/schemas` | SchemaList | Layout |
| `/schemas/:name` | SchemaDetail | Layout |

#### Scenario: Route to SelectRepo
- **WHEN** user navigates to `/`
- **THEN** the SelectRepo page is rendered without Layout wrapper

#### Scenario: Route to Dashboard with Layout
- **WHEN** user navigates to `/dashboard`
- **THEN** the Dashboard page is rendered within the shared Layout (Header + Sidebar + Main)

#### Scenario: Route to the schemas list
- **WHEN** user navigates to `/schemas`
- **THEN** the SchemaList page is rendered within the shared Layout

#### Scenario: Route to a schema detail
- **WHEN** user navigates to `/schemas/spec-driven`
- **THEN** the SchemaDetail page is rendered within the shared Layout for the schema named `spec-driven`
