## Why

v1.14.0 shipped three fixes — the CLI cache's failure memory, the web palette, and `@spekjs/ui`'s
colour contract. A review of that release found ten defects, and the ones that matter share a shape:
**a rule was stated in one place, and a place that had to follow it did not**. The cache rule holds in
TypeScript and not in Kotlin. The colour contract gained a ninth member and the document a consumer
actually reads still describes eight. The contrast obligation gained a guard, and the guard cannot see
two of the ways a colour reaches the screen.

Two of these already left the repo. `@spekjs/ui@1.3.0` is on npm carrying re-theming instructions that
reproduce the exact bug the release fixed, and the IntelliJ host caches a broken CLI's output as though
it were an answer. Both are cheap to fix and neither is discoverable by any gate this repo runs.

## What Changes

**Schema-order cache — remember a settled failure where its cause lives.** Today every unsuccessful
consultation is dropped from the schema bucket. The reason is sound and stays: the key names a schema
while the query names a change, so one change's refusal is not the bucket's to keep. What does not
follow is dropping it entirely — a refusal about a change belongs to **that change**. A settled failure
(`cli-failed` / `cli-unparsable`) is remembered against the slug it was about; a transient one
(`cli-unavailable` / `cli-timeout`) is still forgotten. An environment where the CLI answers nothing —
an installation too old for `status --change --json` — stops paying a ~0.65–1.3s process start on every
change-detail read and every watcher-driven refetch.

**Kotlin schema-order — classify the CLI's output the way TypeScript does.** `parseOrderFromStatus`
swallows a parse failure and returns null, and the caller stores that as an answer for the full cache
window. An exit-0 run whose output cannot be read is a failure, not "this schema has no order", and the
two must be told apart where they still differ. The per-slug memory above is mirrored here too.

**`@spekjs/ui`'s colour contract — say what it now contains.** The README states eight properties and
tabulates eight rows; the contract has nine. Two more rows are stale: `--spek-border` is listed as the
graph's edge colour (edges moved to `--spek-text-muted` at 0.85) and `--spek-bg-primary` as "reserved
for host chrome" (it is now the halo behind every node label, i.e. **the surface the graph is mounted
on** — a host that mounts the graph on a secondary panel must map it accordingly, and nothing says so).
The same stale count sits in `packages/ui/src/theme.ts`, `packages/ui/src/styles.css` and the web host's
`global.css`.

**Graph labels — the halo has to survive the node drawn after it.** Each label is appended inside its
own node's `<g>`, so a later-indexed node's fill paints over an earlier node's label *and* its halo. The
halo was added precisely for that collision and delivers its guarantee in only one of the two
directions. Labels move to their own layer above the nodes.

**The two contrast guards — close what they cannot see.** `@spekjs/ui`'s default-legibility table
measures `--spek-text-muted` at full strength while the graph draws it at 0.85 (every edge, every
archived node fill), and measures `--spek-accent` only at 0.85 while the timeline draws its *today*
label from it at full strength. On the web side, the mechanism scan recognises three ways to bypass the
declared table and `border-<token>/<alpha>` is not among them; the completeness test treats every
surface token as accounted for, so a surface token used as text on a solid fill
(`bg-accent text-bg-primary`, the primary call to action) is measured by nothing.

**Comment language — fix the source, not only the instances.** New comments in `SpecGraph.tsx`,
`SchemaOrder.kt` and `schema-order.test.ts` are in Traditional Chinese, which `CLAUDE.md` forbids. They
are not an oversight: `openspec/config.yaml`'s `context` block tells every agent that reads it
"註解與文件繁體中文". That line is corrected, and the comments it produced are translated.

No breaking changes. `--spek-bg-primary`'s meaning already changed in `@spekjs/ui@1.3.0`; this states it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `custom-schema-artifacts`: "Schema-order authority is cached per schema" — an unsuccessful
  consultation is no longer simply uncached. A settled one is remembered against the change it was
  about, so it is not re-run per read, while the guarantee that it never denies the order to another
  change sharing the schema is unchanged.
- `ui-package`: the colour contract's obligations gain the two things a host cannot get from the code —
  the shipped documentation SHALL describe the contract's full membership and what each property is
  drawn as, and a member whose value is *the host's own surface* SHALL say so. Label legibility becomes
  a property of the drawn result rather than of each node's own group.
- `theme-toggle`: the mechanism scan gains `border-<token>/<alpha>`, and a surface token rendered as
  text on a solid fill is measured rather than assumed accounted for by being a surface.

## Impact

- **`@spekjs/core`** — `schema-order.ts` (per-change failure memory), a non-installing cache lookup and a
  newly exported `CACHE_MAX` in `openspec-cli.ts`; `schema-order.test.ts`. A published package: both the
  behaviour change and the added export are registry-visible, so the release notes need them.
- **`@spekjs/ui`** — `README.md`, `src/theme.ts`, `src/styles.css`, `src/SpecGraph.tsx`,
  `src/__tests__/contract.test.ts`. Also a published package; the README fix is the one that reaches
  existing consumers of 1.3.0.
- **`@spekjs/web`** — `src/styles/global.css`, `src/styles/contrast.test.ts`, and whichever call sites
  the widened scan surfaces (the jj conflict badge's `border-status-warning/40` is expected to be
  declared decoration rather than re-coloured — its text carries the meaning).
- **IntelliJ plugin** — `core/SchemaOrder.kt`, its `OpenspecCli` outcome handling, and the Kotlin tests.
- **Repo configuration** — `openspec/config.yaml`'s `context` block.
- Not in scope: version bumps and CHANGELOG entries for either package line — those belong to the
  release flow.
