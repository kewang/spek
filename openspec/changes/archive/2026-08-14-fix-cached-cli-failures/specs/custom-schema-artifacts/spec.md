## MODIFIED Requirements

### Requirement: Schema-order authority is cached per schema

Because the authoritative artifact sequence returned by the OpenSpec authority (`actionContext.planningArtifacts` + `artifactPaths`) is a property of the change's **schema**, not of the individual change, the system SHALL cache that authoritative result keyed by schema within a repo, so that — for as long as the authority answers — opening multiple changes that share a schema consults the OpenSpec authority (spawning the `openspec` CLI) at most once per distinct schema within the cache window, rather than once per change. When spek cannot resolve a schema **name** for a change locally (neither the change nor the repo declares one), this does NOT mean no authoritative order exists — the OpenSpec authority resolves its own built-in default and still returns an order — so the system SHALL still consult the authority for such changes and SHALL cache them under a single repo-level default bucket (they all resolve to the same default, so one shared bucket is a correct share, not a collision). This caching SHALL NOT change the `schemaOrder` value delivered for any change: the per-change mapping onto that change's discovered artifact ids is applied after the cached authoritative result, so each change still reports the order correct for its own artifacts.

What is cached is the authority's **answer**. Every consultation that does not produce one — the CLI
absent, timed out, exiting non-zero, or emitting output that cannot be read — SHALL NOT be cached: the
next read consults the authority again. Two reasons, and the second is why this holds for every
unsuccessful consultation rather than only the ones a repaired environment would fix. A host that
repairs itself after the first read (resolving `PATH` at startup, installing the CLI) must serve the
authoritative order on the next one. And the cache key names a **schema** while the query names a
**change**: an outcome that may be about the change — a refusal of one slug — is not the bucket's to
keep, and remembering it denies the order to every other change sharing that schema.

An authority that runs and reports no order for a change is an answer, not a failure, and SHALL be
cached like any other; the two are indistinguishable in the delivered `schemaOrder`, so the distinction
SHALL be made where the authority was consulted rather than inferred from the result.

Not caching an unsuccessful consultation SHALL NOT cost a change its share of a spawn: reads arriving
while a consultation is in flight still join it, whether it is about to answer or fail. An outcome
decided **without** consulting the authority at all — a change whose slug the system itself refuses to
pass to it — SHALL be settled before the cache is reached, since there is no run to share and its
answer is not the bucket's either.

#### Scenario: Second change sharing a schema reuses the cached authority

- **WHEN** an active change is opened, its schema's authoritative order is fetched from the OpenSpec authority, and then a different active change declaring the **same** schema in the same repo is opened within the cache window
- **THEN** the second change's `schemaOrder` is served from the cached authoritative result without consulting the OpenSpec authority again

#### Scenario: schemaOrder is unchanged by per-schema caching

- **WHEN** two changes share a schema but have different sets of discovered artifacts, and both are ordered by schema order
- **THEN** each change's `schemaOrder` reflects only its own discovered artifact ids, identical to what per-change computation would have produced

#### Scenario: A change with no locally-resolvable schema still gets the default order

- **WHEN** an active change whose schema spek cannot resolve locally (no repo `config.yaml` and no change `.openspec.yaml` schema) is opened while the `openspec` CLI is available
- **THEN** the authority is still consulted and the change's `schemaOrder` is the authority's default-schema order (not null)

#### Scenario: Schema-less changes in a repo share one spawn

- **WHEN** two active changes in the same repo both have no locally-resolvable schema and are opened within the cache window
- **THEN** they share a single repo-level default cache bucket, so the authority is spawned only once for both

#### Scenario: A failed consultation is retried on the next read

- **WHEN** a change is opened while the `openspec` CLI cannot be reached, the CLI becomes reachable, and the same change is opened again within the cache window
- **THEN** the authority is consulted again and the change's `schemaOrder` is the authoritative order, rather than the unavailability being reported for the rest of the window

#### Scenario: One change's refusal does not deny the order to the rest of its schema

- **WHEN** the authority refuses one change — or the system declines to consult it for that change at all — and a different change sharing the same schema is opened within the cache window
- **THEN** the second change's authoritative order is obtained on its own terms, rather than being served the first change's refusal

#### Scenario: An authority reporting no order is cached like an answer

- **WHEN** the authority is consulted successfully for a schema and reports no artifact order, and another change sharing that schema is opened within the cache window
- **THEN** the second change is served from the cached result without consulting the authority again
