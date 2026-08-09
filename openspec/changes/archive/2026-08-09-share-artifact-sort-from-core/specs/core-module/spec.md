## ADDED Requirements

### Requirement: Artifact sort utility

The core module SHALL export `sortArtifacts(artifacts, mode, schemaOrder?)`, the `ArtifactSortMode` type
it takes, and `ARTIFACT_SORT_MODES` — the runtime list of every valid mode — from the
`@spekjs/core/artifact-order` subpath, beside the `DEFAULT_ORDER` narrative order the function is built
on. Every surface that renders change detail offers the same three ordering modes (see
`custom-schema-artifacts`), so the rule deciding them SHALL live in one place rather than once per
surface.

`ArtifactSortMode` SHALL be **derived from** `ARTIFACT_SORT_MODES` rather than declared separately.
Consumers that persist a user's choice must validate what they read back, which needs the modes at
runtime; a hand-maintained second list satisfies the type even when it is missing an entry, so the
mode it omits becomes silently unrestorable.

The three modes SHALL behave as follows:

- **`modified`** — the input order, unchanged.
- **`alpha`** — by display title, compared with `String.prototype.localeCompare` under the host's
  default collation, with the artifact id as a tiebreak so that two artifacts humanizing to the same
  title still order deterministically. The comparison is **named rather than described as "A–Z"**
  because it is locale- and ICU-dependent: the same two titles may order differently on two hosts, and
  a consumer needing a host-independent order must impose one itself.
- **`schema`** — by the authoritative sequence in `schemaOrder`. Artifacts absent from that sequence
  SHALL follow the ones present, ordered among themselves by the narrative order. When `schemaOrder` is
  absent or empty, the whole list SHALL take the narrative order — **not** the input order, whose
  recency basis puts the artifact written last at the front.

The narrative order is `DEFAULT_ORDER` with ids outside it ordered after it, among themselves by id.

Sorting SHALL change only the order, never the set: the returned list SHALL contain exactly the
artifacts it was given.

`alpha` and `schema` SHALL return a new array and SHALL NOT mutate the input. `modified` **MAY** return
the input array itself rather than a copy. Callers **SHALL NOT** mutate a returned list — under
`modified` it may alias the caller's own array, so sorting it in place would reorder the data the
caller passed in.

It SHALL be reachable without loading any Node-only module, so that a browser bundle or a host's main
process can import it — see the subpath scenarios under "Published to the public npm registry".

#### Scenario: Schema order applied

- **WHEN** `sortArtifacts` is called in `schema` mode with `schemaOrder` listing every artifact
- **THEN** the artifacts follow that sequence, whatever order they arrived in

#### Scenario: Schema order covering only some artifacts

- **WHEN** `sortArtifacts` is called in `schema` mode with a `schemaOrder` that names only some of the
  artifacts
- **THEN** the named ones lead in that sequence, and the rest follow in narrative order

#### Scenario: Schema order unavailable falls back to narrative order

- **WHEN** `sortArtifacts` is called in `schema` mode with no `schemaOrder`, and the artifacts arrive in
  recency order with `tasks` first and `proposal` last
- **THEN** the result is ordered `proposal`, `design`, `specs`, `tasks` — the delivered order is not
  preserved

#### Scenario: Artifacts outside the narrative order

- **WHEN** the artifacts include ids that are not part of `DEFAULT_ORDER`
- **THEN** those ids follow the ones that are, ordered alphabetically among themselves

#### Scenario: Last-modified mode preserves the input order

- **WHEN** `sortArtifacts` is called in `modified` mode
- **THEN** the artifacts come back in the order they were given, and the input array is unmodified

#### Scenario: Alphabetical mode orders by title

- **WHEN** `sortArtifacts` is called in `alpha` mode
- **THEN** the artifacts are ordered by display title under the host's collation

#### Scenario: Two artifacts sharing a display title

- **WHEN** two artifacts humanize to the same display title
- **THEN** they are ordered by artifact id, so that the result does not depend on the order they arrived in

#### Scenario: The mode list matches the type

- **WHEN** a consumer validates a persisted preference against `ARTIFACT_SORT_MODES`
- **THEN** the list contains every value `ArtifactSortMode` admits, because the type is derived from it

#### Scenario: The set of artifacts is never changed

- **WHEN** the same artifacts are sorted in each of the three modes
- **THEN** every result contains exactly the artifacts given, and the input array is unmodified except
  where it is returned as-is
