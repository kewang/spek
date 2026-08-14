## MODIFIED Requirements

### Requirement: Schema reads stay off the scan hot path

Reading schemas SHALL happen only when schema information is requested, and SHALL NOT be performed
while scanning changes, building the overview, aggregating worktrees, or reading a change detail.
No directory scan SHALL gain a subprocess spawn as a result of this capability.

Schema enumeration and schema definitions SHALL be cached per repo with a bounded lifetime and a
bounded cache size, so that repeatedly opening the schema views does not spawn the CLI on every
request once a read has produced something worth keeping, and so that installing the CLI (or editing a
schema) is picked up without restarting the server.

A read that could not reach the CLI at all, or whose call was cut short by the CLI's own timeout, SHALL
NOT be cached: it is a statement about the environment at one moment, and the environment is exactly
what a bounded lifetime was never able to observe changing, so the next request reads again. Every
other outcome SHALL be cached, including the degraded ones. A CLI that ran and exited non-zero, or
emitted output that cannot be read, is reporting the installed CLI rather than the moment — a request
a second later finds it identical, and re-asking costs a process start each time on views that refetch
whenever the watched tree changes. A refusal is likewise an answer: a name the CLI reports no schema
for is a fact about the repo.

A definition read SHALL be judged where the distinction survives. Reporting that a schema was not found
is the same value whether the CLI refused the name or the resolved `schema.yaml` could not be read, and
only the second is about the environment — so the read itself SHALL decide, rather than the cache
inferring it from a result that no longer says. What is reported to the caller is unchanged.

The cache SHALL hold the in-flight computation, not only its finished value, so that a caller
arriving while a read is running joins it rather than starting a second one. Two callers racing on
a cold entry compute the same answer either way, so the duplication is invisible in the result and
paid in subprocesses — which is what the cache exists to avoid. This SHALL hold for a read that is about
to fail as well: not remembering a failure must not become not sharing one, or a host without the CLI
pays a spawn per concurrent reader. Sharing bounds only simultaneous readers, though — sequential ones
each pay a read — which is why the rule above turns on whether a second read could differ rather than on
how often the views read. The bounded lifetime SHALL exceed the CLI's own timeout, or an entry
can be judged stale while the call filling it is still running.

#### Scenario: Concurrent cold requests share one CLI run

- **WHEN** two requests for the same uncached schema information arrive while the first is still running
- **THEN** the CLI is spawned once and both requests are answered from that single run

Because a cache can outlive the thing it describes, it SHALL be discarded both when the host
observes a change under the watched `openspec/` tree and when the user requests a refresh. Only one
of the three schema directories is watched — the repo's own — so an edit to a machine-global schema,
or a schema promoted from the repo to that directory, produces no event at all; refresh is the
authoritative way to pick those up, and without invalidation it would report success while serving
the superseded copy.

Watch-driven invalidation SHALL be scoped in two ways, neither of which may delay it past the
refetch it precedes. It SHALL apply only to events that can have changed what a schema read
returns — a file under a schema's own directory, or the repo's `openspec/config.yaml`, which names
the default and so decides which entry is marked default. A watcher admits every `.md` and `.yaml`
under `openspec/`, nearly all of which is change and spec content that no schema read consults, and
invalidating on those re-pays the enumeration for edits that cannot have altered a single field.
It SHALL also apply only to the repo the watcher observes: the caches are process-wide, shared by
every repo a host has open, so an unscoped discard makes an edit in one repo cost another an
enumeration.

Every host that observes file changes SHALL perform this invalidation, not only those whose refresh
command does. A host that notifies its client to refetch without discarding first will serve the
pre-edit copy from a still-live cache entry while reporting the refresh as successful.

#### Scenario: An unrelated edit does not discard the catalog

- **WHEN** a change's `tasks.md` under the watched tree is saved while a client is watching
- **THEN** the cached schema reads are retained, and the refetch that follows spawns no `openspec` process

#### Scenario: One repo's edit does not discard another's cache

- **WHEN** a schema is edited in one watched repo while a second repo's catalog is cached in the same host
- **THEN** only the edited repo's cached reads are discarded, and the second repo's are still served from cache

#### Scenario: Scanning spawns nothing new

- **WHEN** the changes list, the overview, or an aggregated scan runs
- **THEN** no schema enumeration is performed and no `openspec` process is spawned on that path

#### Scenario: Repeated schema requests reuse the cache

- **WHEN** the Schemas page is opened twice within the cache lifetime for the same repo, and the CLI was reached on the first read
- **THEN** the second request is served from cache without spawning the `openspec` CLI again

#### Scenario: A schema edited in the repo is picked up by live reload

- **WHEN** a schema under the repo's `openspec/schemas/` is edited while a client is watching
- **THEN** the cached read is discarded as part of the same notification, so the refetch the client performs returns the edited schema rather than the cached copy

#### Scenario: A schema moved or edited outside the repo is picked up on refresh

- **WHEN** a schema is promoted from the repo to the machine-global directory, or edited there, producing no filesystem event the host observes
- **THEN** a manual refresh discards the cached reads, so the schema's new source and content are shown without waiting for the cache lifetime to elapse

#### Scenario: A later install is picked up by the next read

- **WHEN** the schemas are first read with the `openspec` CLI absent, the CLI is then installed, and the schemas are read again within the cache lifetime
- **THEN** the second read enumerates package schemas rather than serving the degraded result for the rest of the lifetime

#### Scenario: A CLI that answers unusably is not re-asked every request

- **WHEN** the schemas are read while the installed CLI exits non-zero or emits output that cannot be read, and the schemas are read again within the cache lifetime
- **THEN** the second read is served the same degraded enumeration from cache, spawning no further process

#### Scenario: An unknown schema name stays cached

- **WHEN** a definition is requested for a name the CLI reports no schema for, and the same definition is requested again within the cache lifetime
- **THEN** the second request is served from cache without spawning the CLI again, because the CLI answered

#### Scenario: A definition whose file could not be read is re-read

- **WHEN** a definition request resolves a schema but its `schema.yaml` cannot be read, and the same definition is requested again within the cache lifetime
- **THEN** the schema is read again rather than the failure being served for the rest of the lifetime, even though both are reported as the schema not being found
