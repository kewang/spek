## Purpose

定義前端 SPA 路由（dashboard / specs / changes / graph 等），並適配 Web 與 Webview 環境。

## Requirements
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

### Requirement: RepoContext state management
The system SHALL provide a React Context (`RepoContext`) that stores the current repo path. All API hooks SHALL read the repo path from this context.

#### Scenario: Set repo path
- **WHEN** user selects a repo on the SelectRepo page
- **THEN** `RepoContext.repoPath` is updated and available to all child components

#### Scenario: Redirect when no repo selected
- **WHEN** user navigates to any page other than `/` without a repo path in context
- **THEN** system redirects to `/`

### Requirement: API hooks
The system SHALL provide custom React hooks in `useOpenSpec.ts` that encapsulate API calls. Each hook SHALL return `{ data, loading, error }` and automatically include the `dir` query parameter from RepoContext.

#### Scenario: Hook returns loading state
- **WHEN** an API hook is called and the request is in flight
- **THEN** hook returns `{ data: null, loading: true, error: null }`

#### Scenario: Hook returns data
- **WHEN** the API request succeeds
- **THEN** hook returns `{ data: <response>, loading: false, error: null }`

#### Scenario: Hook returns error
- **WHEN** the API request fails
- **THEN** hook returns `{ data: null, loading: false, error: <error message> }`
