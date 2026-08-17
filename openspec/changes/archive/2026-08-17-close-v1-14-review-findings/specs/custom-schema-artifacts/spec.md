## MODIFIED Requirements

### Requirement: Schema-order authority is cached per schema

Because the authoritative artifact sequence returned by the OpenSpec authority (`actionContext.planningArtifacts` + `artifactPaths`) is a property of the change's **schema**, not of the individual change, the system SHALL cache that authoritative result keyed by schema within a repo, so that — for as long as the authority answers — opening multiple changes that share a schema consults the OpenSpec authority (spawning the `openspec` CLI) at most once per distinct schema within the cache window, rather than once per change. When spek cannot resolve a schema **name** for a change locally (neither the change nor the repo declares one), this does NOT mean no authoritative order exists — the OpenSpec authority resolves its own built-in default and still returns an order — so the system SHALL still consult the authority for such changes and SHALL cache them under a single repo-level default bucket (they all resolve to the same default, so one shared bucket is a correct share, not a collision). This caching SHALL NOT change the `schemaOrder` value delivered for any change: the per-change mapping onto that change's discovered artifact ids is applied after the cached authoritative result, so each change still reports the order correct for its own artifacts.

What the per-schema bucket holds is the authority's **answer**. No consultation that fails to produce
one SHALL be held there, whatever its cause: the bucket's key names a **schema** while the query names
a **change**, so an outcome that may be about the change is not the bucket's to keep, and holding it
would deny the order to every other change sharing that schema.

Not the bucket's to keep is not the same as not worth keeping, and the two SHALL be told apart by the
same rule that decides whether any CLI failure is worth remembering. A failure the running host may
repair by itself — the CLI absent, or cut short by its own timeout — SHALL be remembered **nowhere**,
so the next read consults the authority again and a repaired environment is served the order it can now
obtain. A failure the **installed** authority produced — exiting non-zero, or emitting output that
cannot be read — SHALL be remembered **against the change the query named**, for the same bounded
lifetime as an answer. It settles nothing about the schema and is not offered to any other change, but
it SHALL spare that change a fresh consultation for the rest of the window: an installation that cannot
answer at all otherwise costs a full process start on every read of every change detail, and on every
refetch a file watcher triggers.

A remembered settlement SHALL replace a **consultation**, never an answer. Where the per-schema bucket
holds a current answer, that answer SHALL be delivered to the change whatever is remembered about it:
the authoritative sequence is a property of the schema, as this requirement opens by stating, so a
change that was once refused is still owed its schema's order once the bucket holds one — and is owed it
without a further consultation. The settlement SHALL be applied only when no such answer exists, and
SHALL NOT install, join, or disturb an entry in the bucket. Replaying it consults nothing, so there is
no run for another reader to share; reached from inside the bucket's computation, a concurrent read of a
**different** change would join it and be served a settlement that was never about it. This is the rule
already stated for an outcome decided without consulting the authority at all, and a replayed settlement
is such an outcome.

A settlement SHALL be recorded by the consultation it came from, which is the only point holding both
the outcome's cause and the change the query actually named. A reader that joined a consultation about a
**different** change SHALL NOT record one for itself: joining is required behaviour, so a settlement
attributed by the joiner would be attributed to a change the authority was never asked about.

Where a host invalidates its cached authoritative results, it SHALL invalidate remembered settlements
with them. A settlement that survives an invalidation makes a manual refresh weaker than the automatic
one beside it, for the one change it is remembered against.

An authority that runs and reports no order for a change is an answer, not a failure, and SHALL be
cached like any other; the two are indistinguishable in the delivered `schemaOrder`, so the distinction
SHALL be made where the authority was consulted rather than inferred from the result.

Not caching an unsuccessful consultation in the bucket SHALL NOT cost a change its share of a spawn:
reads arriving while a consultation is in flight still join it, whether it is about to answer or fail.
An outcome decided **without** consulting the authority at all — a change whose slug the system itself
refuses to pass to it — SHALL be settled before the cache is reached, since there is no run to share and
its answer is not the bucket's either.

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

#### Scenario: A settlement by the installed authority is not repeated on every read

- **WHEN** the authority is consulted for a change and the installed CLI settles against it — exiting non-zero, or emitting output that cannot be read — and the same change is opened again within the cache window
- **THEN** the authority is not consulted again for that change and its `schemaOrder` is null, rather than a fresh consultation being spawned on every read

#### Scenario: One change's refusal does not deny the order to the rest of its schema

- **WHEN** the authority refuses one change — or the system declines to consult it for that change at all — and a different change sharing the same schema is opened within the cache window
- **THEN** the second change's authoritative order is obtained on its own terms, rather than being served the first change's refusal

#### Scenario: A remembered settlement is not shared with a concurrent read of another change

- **WHEN** a change whose settlement is remembered is read at the same moment as a different change sharing its schema, with no cached answer for that schema
- **THEN** the second change's consultation happens on its own terms, rather than joining and inheriting the first change's settlement

#### Scenario: A settled change is still served its schema's cached answer

- **WHEN** the authority settles against one change, another change sharing its schema is then consulted successfully, and the first change is opened again within the cache window
- **THEN** it is served the schema's cached authoritative order mapped onto its own artifacts, without a further consultation and without its settlement being replayed

#### Scenario: A settlement is not recorded by a reader that joined another change's consultation

- **WHEN** a read for one change joins an in-flight consultation the authority was given a different change's name for, and that consultation settles
- **THEN** no settlement is remembered for the joining change, so its next read consults the authority on its own terms

#### Scenario: Invalidating cached results invalidates remembered settlements

- **WHEN** a host that invalidates its cached authoritative results does so — through a resync, a watched-file event, or any other seam it invalidates on — and a change with a remembered settlement is read afterwards
- **THEN** the authority is consulted again for that change, rather than the settlement standing for the rest of the window

#### Scenario: An authority reporting no order is cached like an answer

- **WHEN** the authority is consulted successfully for a schema and reports no artifact order, and another change sharing that schema is opened within the cache window
- **THEN** the second change is served from the cached result without consulting the authority again

## ADDED Requirements

### Requirement: An unreadable authority response is a failure, not an absent order

Every host that reads the authoritative order SHALL distinguish an authority that **ran and reported no
order** from one whose output **could not be read**, and SHALL do so where the two still differ — at the
point the response is turned into an order, before the result reaches any cache.

The distinction is invisible afterwards: both deliver a null `schemaOrder`, so a reader that decides
from the delivered value alone cannot recover it, and the cheapest wrong answer is to treat an
unreadable response as the schema's answer and hold it for the full window. A host that reads the CLI's
raw output SHALL therefore separate parsing that output from extracting the order out of it, rather than
letting one step report both failures as the same absent value.

**Readable means the response parsed, not that it was shaped as expected.** A response that parses to
something the extractor can find no order in — a value that is not an object, an object without the
fields the order is read from — is a readable response reporting no order, and SHALL be classified as an
answer. Drawing the line anywhere later makes a host's own expectations part of the boundary, and two
hosts' expectations are exactly what this requirement exists to keep from diverging.

This applies to every host that consults the authority — the shared TypeScript core and the Kotlin
implementation alike — since each maintains its own reader and its own cache.

#### Scenario: Output that cannot be read is not cached as the schema's answer

- **WHEN** the authority exits successfully but emits output the host cannot parse, and a change sharing that schema is opened within the cache window
- **THEN** the response is treated as a failure of the installed authority rather than as "this schema has no order", so the schema's bucket holds no answer

#### Scenario: A readable response with no order is an answer

- **WHEN** the authority exits successfully and its output is readable but names no artifact order
- **THEN** that is cached as the schema's answer, and another change sharing the schema is served it without a further consultation

#### Scenario: A response that parses but names no order is an answer, not an unreadable one

- **WHEN** the authority exits successfully and its output parses to a value the extractor can find no artifact order in
- **THEN** it is classified as an answer reporting no order, rather than as an unreadable response

#### Scenario: Each host asserts the classification for the same documented responses

- **WHEN** each host's own suite is run
- **THEN** it asserts, for the same documented set of authority responses, the same classification into answer or failure as the other host's suite asserts for them
