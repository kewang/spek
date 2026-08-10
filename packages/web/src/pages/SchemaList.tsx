import { Link } from "react-router-dom";
import type { SchemaSummaryWithUsage } from "@spekjs/core";
import { useSchemas } from "../hooks/useOpenSpec";
import { SourceBadge } from "../components/SourceBadge";
import { DefaultSchemaBadge } from "../components/DefaultSchemaBadge";
import { degradedMessage, schemaCountClaims, usageLabel } from "../utils/schemaView";
import { plural } from "../utils/plural";

// Same info glyph and treatment ChangeDetail uses for its schema-order fallback notice — this is
// the app's established way to say "this view is degraded and here is why".
function IconInfo() {
  return (
    <svg className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SchemaRow({ schema }: { schema: SchemaSummaryWithUsage }) {
  return (
    <Link
      to={`/schemas/${encodeURIComponent(schema.name)}`}
      className={`bg-bg-secondary border-border hover:border-accent block rounded border p-4 transition-colors${
        schema.isDefault ? " border-l-accent border-l-4" : ""
      }`}
    >
      {/* Wraps, so the usage metadata drops to its own line on a phone instead of squeezing the
          name to nothing. Unwrapped, the right-hand column is `shrink-0` and the name is the only
          thing that can give — "superpowers-bridge" was rendering as "superp…". */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-text-primary truncate font-medium">{schema.name}</span>
          {schema.isDefault && (
            <DefaultSchemaBadge />
          )}
          <SourceBadge source={schema.source} />
        </span>
        <span className="text-text-muted shrink-0 whitespace-nowrap text-xs">
          {schema.artifactCount !== null && (
            <>
              {schema.artifactCount} {plural(schema.artifactCount, "artifact")} &middot;{" "}
            </>
          )}
          {usageLabel(schema.usage.count)}
        </span>
      </div>
      {schema.description && (
        // Clamped: a schema description is free text and can be a whole paragraph
        // (superpowers-bridge's runs to several sentences), which would make one row tower over
        // its neighbours. The full text is on the detail page. `line-clamp` is not used elsewhere
        // in the app, because no other list row renders free-form prose from an external file.
        <p className="text-text-secondary mt-1 line-clamp-2 text-sm" title={schema.description}>
          {schema.description}
        </p>
      )}
    </Link>
  );
}

export function SchemaList() {
  const { data, loading, error } = useSchemas();

  if (loading) return <p className="text-text-muted">Loading...</p>;
  if (error) return <p className="text-red-400">Error: {error}</p>;

  const schemas = data?.schemas ?? [];
  // Both "unresolved" readings below are inferred from a name's *absence* from the enumeration, so
  // neither means anything once the enumeration itself failed: every name is absent then. Saying
  // "no such schema was found" because the CLI could not be reached is the same conflation of
  // "could not look" with "does not exist" that the reasons above exist to keep apart — and it
  // would accuse a repo's own default schema of not existing while it sits on disk.
  const degraded = data?.degradedReason != null;
  const { showCount, showEmptyState } = schemaCountClaims(schemas.length, data?.degradedReason);
  const unresolvedNamed = degraded
    ? []
    : (data?.unresolved ?? []).filter((u) => u.schema !== null);
  // The repo names a schema its own toolchain could not resolve — worth saying plainly rather than
  // showing nothing.
  const activeUnresolved =
    !degraded && data?.defaultSchema && !schemas.some((s) => s.name === data.defaultSchema)
      ? data.defaultSchema
      : null;

  return (
    <div className="space-y-4">
      <div>
        {/* Header row with a count on the right, matching SpecList's "N topics". */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Schemas</h1>
          {/* Suppressed while degraded: "0 schemas" is a statement about the repo, and a failed
              enumeration has not made one. The degraded line below says the true thing. */}
          {showCount && (
            <span className="text-text-muted shrink-0 text-sm">
              {schemas.length} {plural(schemas.length, "schema")}
            </span>
          )}
        </div>
        <p className="text-text-muted mt-1 text-sm">
          {/* "artifacts" — the noun the count beside each row uses, and OpenSpec's own for what a
              schema declares. */}
          The OpenSpec workflows available to this repo — the artifacts a change produces, and what
          each one asks for.
        </p>
      </div>

      {data?.degradedReason && (
        <p className="flex items-center gap-1 text-text-muted text-[11px]">
          <IconInfo />
          {degradedMessage(data.degradedReason)}
        </p>
      )}

      {activeUnresolved && (
        <p className="text-text-muted text-sm">
          This repo declares <span className="text-text-secondary">{activeUnresolved}</span> as its
          default schema, but it could not be resolved.
        </p>
      )}

      {/* Same distinction the detail page keeps with `schemaUnavailableMessage`: "none exist" is
          only sayable when the enumeration succeeded. Degraded, the list is empty because we could
          not look, so this would contradict the line directly above it. */}
      {showEmptyState && (
        <p className="text-text-muted">No workflow schemas were found for this repo.</p>
      )}

      {schemas.length > 0 && (
        <div className="space-y-2">
          {schemas.map((schema) => (
            <SchemaRow key={schema.name} schema={schema} />
          ))}
        </div>
      )}

      {unresolvedNamed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-text-secondary text-sm font-medium">Changes with an unknown schema</h2>
          {unresolvedNamed.map((u) => (
            <p key={u.schema} className="text-text-muted text-sm">
              <span className="text-text-secondary">{u.schema}</span> — declared by{" "}
              {usageLabel(u.count).toLowerCase()}, but no such schema was found.
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
