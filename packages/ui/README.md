# @spekjs/ui

Reusable OpenSpec visualizations: a force-directed **spec ↔ change graph** and a Gantt-style
**change timeline**.

These are the same two views that [spek](https://github.com/spekhq/spek)'s web app ships — extracted
so that other hosts can render them too. They are **presentational**: they take data through props
and report the user's choices through callbacks. They have no router, no data layer, and no CSS
framework.

```bash
npm install @spekjs/ui
```

Peer dependencies: `react` >= 19, `react-dom` >= 19, `@spekjs/core` >= 1.3.

## A host does three things

```tsx
import "@spekjs/ui/styles.css";                               // 1. the stylesheet
import { SpecGraph, ChangeTimeline, buildLanes } from "@spekjs/ui";

function Graph({ data }) {
  return (
    // the graph fills its parent — give it a height, and `position: relative` for the legend
    <div style={{ position: "relative", height: "70vh" }}>
      <SpecGraph
        data={data}                                           // 2. feed it data
        onSelectSpec={(topic) => openSpec(topic)}             //    take the callbacks
        onSelectChange={(slug) => openChange(slug)}
      />
    </div>
  );
}

function Timeline({ changes, graph }) {
  const { lanes, unknownCreated } = buildLanes(changes, graph, groupByTopic);
  return (
    <ChangeTimeline
      lanes={lanes}
      groupByTopic={groupByTopic}
      onSelectChange={(change) => openChange(change.slug)}
    />
  );
}
```

Data comes from [`@spekjs/core`](https://www.npmjs.com/package/@spekjs/core): `buildGraphData()`
gives you `GraphData` for the graph, and `scanOpenSpec()` gives you the `ChangeInfo[]` the timeline
wants. **How** you get that data to the browser is your business — spek's web app serves it over
HTTP, and the Electron workspace passes it over IPC.

## Colours (3.)

Every colour the package draws with comes from one of nine CSS custom properties. `styles.css`
declares dark defaults for all of them; **to re-theme, override every one of them in your own
`:root`** — a property you leave out keeps the package's *dark* default, which in a light theme is
the one failure this list exists to prevent:

| Variable | Used for |
| --- | --- |
| `--spek-bg-primary` | the surface the graph is mounted on — drawn as the halo behind node labels, so a label stays readable when the layout drifts a node under it. Map it to whatever your graph container's background actually is |
| `--spek-bg-secondary` | timeline surface, tooltip background |
| `--spek-bg-tertiary` | timeline row hover, tooltip topic chips |
| `--spek-border` | timeline grid lines and borders |
| `--spek-text-primary` | highlighted graph edges, tooltip slug |
| `--spek-text-secondary` | graph node labels, timeline row labels |
| `--spek-text-muted` | graph edges, archived change nodes, axis labels, archived bars, tooltip body |
| `--spek-accent` | spec nodes, active bars, the *today* line |
| `--spek-node-active` | active change nodes in the graph |

```css
:root {
  --spek-accent: var(--my-brand-colour);
  --spek-border: #1e242c;
  /* … */
}
```

The package deliberately owns these names rather than reading yours. A host whose tokens are named
differently would otherwise get a graph with **no colours at all** — which is exactly what happened
before this package existed.

The graph's node shapes are the visualization's own vocabulary — a spec is a circle, a change is a
rounded box — but their **colours** are contract properties like everything else: a spec node is
`--spek-accent`, an active change `--spek-node-active`, an archived one `--spek-text-muted`. Nothing
the package draws is a fixed colour.

### Theme switching

The graph writes its colours into SVG attributes (d3 is imperative — it cannot use `var()`), so it
has to redraw when the theme changes. It will not guess when that happened: pass a `themeKey` and
change it.

```tsx
<SpecGraph data={data} themeKey={theme} />
```

Hosts with a single theme can omit it.

## Components

### `<SpecGraph>`

| Prop | Type | |
| --- | --- | --- |
| `data` | `GraphData` | required |
| `onSelectSpec` | `(topic: string) => void` | |
| `onSelectChange` | `(slug: string, worktreeKey?: string) => void` | `worktreeKey` is only set for aggregated scans |
| `themeKey` | `string \| number` | change it to force a redraw |
| `legend` | `boolean` | default `true` |

Zoom, pan, node dragging, neighbour highlighting on hover, and fit-to-viewport once the simulation
settles — all included.

### `<ChangeTimeline>`

| Prop | Type | |
| --- | --- | --- |
| `lanes` | `Lane[]` | from `buildLanes()` |
| `groupByTopic` | `boolean` | required |
| `onSelectChange` | `(change: ChangeInfo) => void` | fired by a bar or a row label |
| `renderBadge` | `(change: ChangeInfo) => ReactNode` | optional per-row adornment |
| `metrics` | `Partial<TimelineMetrics>` | see below |

Bars run from `createdDate` to `archivedDate`; an active change runs to today and ends in an arrow.
There is a dashed *today* line, and a tooltip on hover.

**`metrics` and width.** `labelColWidth + minChartAreaWidth` (200 + 720 by default) is the chart's
minimum usable width — below it a horizontal scrollbar appears, and the label column stays frozen.
That is not a defect but the nature of a Gantt: squeeze the axis far enough and every bar collapses
to a line. You may shrink the constants for a narrower container, but consider whether a Gantt is the
right thing to put there at all.

`buildLanes()` also returns `unknownCreated` — changes with no `createdDate`, which cannot be placed
on a date axis. Render them however suits your host; the timeline ignores them.

## Helpers

`buildLanes()` and `changeTopicsMap()` derive the timeline's lanes; `dateRange()`, `padDomain()`,
`scaleTime()`, `generateTicks()` and `formatTickLabel()` are the axis rules. All pure, all exported.

**`changeNodeSlug(node)`** turns a graph change node back into its slug. Worth knowing about if you
touch `GraphData` yourself: an aggregated scan namespaces change ids by worktree
(`change:<worktreeKey>:<slug>`), a plain scan does not (`change:<slug>`), and the id alone cannot tell
you which you have — the node's `source` can. Use this rather than parsing ids, so your host and the
components agree on what a node means.

It is owned by `@spekjs/core`, which produces the format, and re-exported here for convenience. If your
host needs it outside the browser — normalising ids in an Electron main process, say — import
`@spekjs/core/graph-node-id` instead: that entry point carries neither React nor d3 nor `node:fs`.

## License

MIT
