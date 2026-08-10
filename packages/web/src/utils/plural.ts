/**
 * The noun for a count: `plural(3, "stage")` → "stages", `plural(1, "entry", "entries")` → "entry".
 *
 * A function rather than a `String.prototype` extension, tempting as `"stage".plural(n)` reads:
 * `@spekjs/core` and `@spekjs/ui` are published, and a prototype patch would leak into every
 * consumer's globals.
 *
 * Returns the word alone, not "3 stages", because the count is not always adjacent to it — a stat
 * card renders the value separately, and "active change/changes" takes a qualifier in between.
 *
 * English only, deliberately: plural categories are per-locale, so `count === 1` is not a rule that
 * survives translation. `Intl.PluralRules` is the replacement if that day comes — see idea #14 in
 * `docs/feature-ideas.md`, which is deferred rather than overlooked.
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return count === 1 ? one : many;
}
