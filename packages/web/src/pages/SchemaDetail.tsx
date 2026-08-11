import { useMemo, useState } from "react";
import { schemaArtifactCount } from "@spekjs/core/schema-flow";
import { Link, useParams } from "react-router-dom";
import { useSchema } from "../hooks/useOpenSpec";
import { SchemaFlow, SchemaStepDetail } from "../components/SchemaFlow";
import { StatCard } from "../components/StatCard";
import {
  buildFlowSteps,
  groupIntoLevels,
  schemaUnavailableMessage,
  withArchiveStep,
} from "../utils/schemaView";
import { SourceBadge } from "../components/SourceBadge";
import { DefaultSchemaBadge } from "../components/DefaultSchemaBadge";
import { plural } from "../utils/plural";

export function SchemaDetail() {
  const { name = "" } = useParams<{ name: string }>();
  // Held as a step *key*, not a declared id: a schema may declare an artifact named `apply`
  // alongside the apply phase, and an id would select whichever came first for both.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // One request: `usage` rides along on the result rather than costing a second fetch of the whole
  // catalog, which a deep link, a reload or a post-refresh cache miss would each pay in full.
  const { data, loading, error } = useSchema(name);

  // Derived here, above the early returns, because hooks cannot run after them — and memoised
  // because selecting a step re-renders this page. The workflow model depends only on the schema,
  // so without this every click rebuilt it and handed SchemaGraph a fresh `levels` identity,
  // defeating its own memo and re-running the whole layout.
  // Total rather than nullable, so the not-found branch below keeps narrowing `data` on its own
  // condition. An unreadable schema yields an empty model, which is never rendered.
  const def = data?.ok ? data.schema : null;
  const model = useMemo(() => {
    const artifacts = def?.artifacts ?? [];
    const apply = def?.apply ?? null;
    const declared = buildFlowSteps(artifacts, apply);
    const steps = withArchiveStep(declared);
    return {
      // From core, not re-derived here. It is the same number the schemas list renders per row,
      // and the point of `schemaArtifactCount` is that one rule answers it everywhere. Counting
      // `declared` locally would agree today and only by coincidence tomorrow.
      artifactCount: schemaArtifactCount(artifacts),
      steps,
      levels: groupIntoLevels(steps),
    };
  }, [def]);

  const back = (
    <Link
      to="/schemas"
      className="text-text-muted hover:text-accent text-base font-medium transition-colors"
    >
      &larr; Back to Schemas
    </Link>
  );

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  if (!data || !data.ok) {
    return (
      <div className="space-y-6">
        {back}
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-text-muted">
          {data
            ? schemaUnavailableMessage(data.reason, name)
            : `No schema named "${name}" was found.`}
        </p>
      </div>
    );
  }

  const schema = data.schema;
  const usage = data.usage;
  // Excludes the archive step: it is a stage of every OpenSpec workflow, not one this schema
  // declares, and counting it would inflate every schema by the same 1.
  const { artifactCount, steps, levels } = model;
  const selected = steps.find((s) => s.key === selectedKey) ?? null;

  return (
    // space-y-6 like SpecDetail (the other detail page); stat cards borrowed from the Dashboard,
    // because packing this much into one line of text-xs metadata made the page read denser than
    // anything else in the app.
    <div className="space-y-6">
      <div>
        {back}

        {/* Badges on the line below the title, as ChangeDetail does. Inline beside a 24px bold
            heading, an 11px pill never looks centred however the box maths works out — the
            glyphs' optical centre and the line box's centre are not the same place. */}
        <h1 className="mt-2 text-2xl font-bold">{schema.name}</h1>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {schema.isDefault && (
            <DefaultSchemaBadge />
          )}
          <SourceBadge source={schema.source} />
        </div>

        {/* Relaxed leading rather than a width cap: capping it made an isolated half-width column
            on a page where nothing else is measured, which read as broken. A schema description is
            free prose of unpredictable length — superpowers-bridge's runs six lines — so the fix
            is making it comfortable to read, not making it narrow. */}
        {schema.description && (
          <p className="text-text-secondary mt-3 leading-relaxed">{schema.description}</p>
        )}
      </div>

      {/* Only counts that mean what they appear to mean.
          - No artifact count: one declared artifact can generate a glob pattern, so the number of
            artifacts is not the number of files a change holds. It needed a caveat to be honest,
            and a statistic that needs a caveat is not a statistic. The flow marks pattern steps
            individually instead, which is where it is actually useful.
          - No version: schema.yaml's `version:` is the file FORMAT version — it reads 1 for every
            schema in existence and the CLI does not even surface it. Stated under Source instead.
            A schema's own release version, where one exists, lives in a VERSION file that is a
            local convention rather than part of the OpenSpec contract, so spek does not read it. */}
      {/* One row of facts about the schema. Source sits with the counts because it is the same
          class of thing, and "Used by" is gone: it restated the Active changes count, and the slug
          list it added is one click away on the Changes page.

          Source spans two columns and puts its label above its value, unlike StatCard's big
          numeral over a caption. A filesystem path is not a figure — leading with it would put a
          wrapped monospace line where the eye expects a number. */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={plural(artifactCount, "Artifact")} value={artifactCount} delay={0} />
        <StatCard
          label={
            usage ? (
              <Link to="/changes" className="hover:text-accent transition-colors">
                {`Active ${plural(usage.count, "change")}`}
              </Link>
            ) : (
              "Active changes"
            )
          }
          value={usage ? usage.count : "—"}
          delay={80}
        />
        {/* Spans the full row at every width. Left in a half-width column on a phone, the path
            wrapped into a narrow tower — a filesystem path needs the line, not the column. */}
        <div className="bg-bg-secondary border-border animate-fade-in-up col-span-2 rounded border p-4">
          <div className="text-text-secondary text-sm">Source</div>
          {/* Just the path. The badge beside the title already says project / user / package, so a
              sentence repeating it is the verbosity we cut everywhere else — and the path is shown
              in the frame its source means: relative to the repo, ~-prefixed, or stripped of the
              npm install prefix. The absolute path is the tooltip, for anyone who needs to go
              there. */}
          <p className="text-text-secondary mt-1 text-xs" title={schema.path}>
            <code className="bg-bg-tertiary text-accent break-all rounded px-1.5 py-0.5">
              {schema.displayPath}
            </code>
          </p>
          {/* One line per shadowed schema, not one sentence listing every source against a single
              path: a schema shadowing both a user and a package copy has two locations, and pairing
              two sources with one path presents that path as if it covered both. */}
          {schema.shadows.map((sh) => (
            <p key={sh.path} className="text-text-muted mt-1 text-xs">
              Takes precedence over the {sh.source} schema of the same name at{" "}
              <code className="bg-bg-tertiary text-accent break-all rounded px-1.5 py-0.5">{sh.path}</code>.
            </p>
          ))}
        </div>
      </div>

      {/*
        Two columns at xl, stacked below: the same breakpoint and grid form SpecDetail and
        ChangeDetail use for their aside, except theirs *hides* on narrow viewports because a TOC is
        optional, whereas this is the content the reader asked for. The diagram column sizes to its
        content and is left at its natural height — the page's own scrollbar is the only one.
      */}
      <div className="xl:grid xl:grid-cols-[minmax(0,auto)_minmax(0,1fr)] xl:items-start xl:gap-6">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Workflow</h2>
          <SchemaFlow
            steps={steps}
            levels={levels}
            selectedKey={selectedKey}
            onSelect={(key) => setSelectedKey(key === selectedKey ? null : key)}
          />
        </section>

        <section className="mt-6 xl:mt-0">
          <h2 className="mb-3 text-lg font-semibold">{selected ? "Step" : "Steps"}</h2>
          {selected ? (
            <SchemaStepDetail step={selected} onClose={() => setSelectedKey(null)} />
          ) : (
            // A detail pane waiting for a selection. Given real height so it reads as a pane rather
            // than a stray strip, but nothing is relocated here to fill it.
            <div className="bg-bg-secondary border-border flex min-h-56 items-center justify-center rounded border border-dashed p-6">
              <p className="text-text-muted text-center text-sm">
                Select a step in the diagram to read what it is for.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
