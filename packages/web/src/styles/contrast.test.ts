import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The palette's contrast guard. Two halves, because "the values are right" and "the values will stay
 * right" are different claims:
 *
 * 1. Ratios — parse both themes out of `global.css` and measure a declared table.
 * 2. Mechanism — scan the source for the ways a colour can bypass the tokens entirely.
 *
 * Without the second half, today's values can be silently undone by the next `text-red-400`; without the
 * first, a colour can go through a token and still be unreadable.
 *
 * The contrast maths lives here rather than in `utils/`: nothing in the app computes contrast at runtime,
 * so a module no one imports would be dead code carrying a type-check bill.
 */

import { MARK_COLOR, MARK_OPACITY } from "../utils/schemaLayout";

/** `var(--color-text-muted)` -> `text-muted`, so a table entry follows the source it measures. */
const tokenOf = (value: string): string => value.replace(/^var\(--color-|\)$/g, "");

const CSS = readFileSync(fileURLToPath(new URL("./global.css", import.meta.url)), "utf8");
const SRC = fileURLToPath(new URL("..", import.meta.url));

// --- Parsing -----------------------------------------------------------------

/**
 * Colour declarations from one block only. Deliberately not a whole-file scan: `--color-fold-lead:
 * 1.25rem` and `--color-fold-trail: 1rem` are *lengths* wearing the colour prefix, and `--spek-*:
 * var(--color-*)` are indirections rather than values. Neither block contains a nested brace, so
 * `\{([^}]*)\}` is enough — the same idiom `MarkdownRenderer.keyword.test.ts` already uses on this file.
 */
function tokensIn(selector: string): Map<string, string> {
  const block = new RegExp(`${selector}\\s*\\{([^}]*)\\}`).exec(CSS)?.[1];
  assert.ok(block, `expected a ${selector} block in global.css`);
  const out = new Map<string, string>();
  for (const m of block.matchAll(/--color-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out.set(m[1], m[2].toLowerCase());
  }
  return out;
}

const DARK = tokensIn("@theme");
// Light overrides only part of the palette and inherits the rest — which is how the theme works, and
// why a missing override is not an error anywhere else.
const LIGHT = new Map([...DARK, ...tokensIn('\\[data-theme="light"\\]')]);
const THEMES = { dark: DARK, light: LIGHT } as const;

/**
 * `@spekjs/ui`'s colour contract, resolved through this app's tokens.
 *
 * The package holds no values of its own beyond a set of dark defaults — a host maps its tokens onto the
 * nine `--spek-*` names, so what a reader actually sees on `/graph` and `/timeline` is measurable *here*
 * and nowhere else. The package cannot do it (no values) and cannot be asked to (its own test would have to
 * know this app), so the split is: the package guards that nothing is drawn outside the contract, and this
 * file measures what the contract resolves to.
 */
function spekMapping(): Map<string, string> {
  const block = /:root\s*\{([^}]*)\}/.exec(CSS)?.[1];
  assert.ok(block, "expected the :root block mapping --spek-* onto this app's tokens");
  const out = new Map<string, string>();
  for (const m of block.matchAll(/--spek-([\w-]+):\s*var\(--color-([\w-]+)\)\s*;/g)) {
    out.set(m[1], m[2]);
  }
  return out;
}

// --- Contrast ----------------------------------------------------------------

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Browsers composite alpha in sRGB, so this does too — not oklab. */
function over(fg: string, alpha: number, bg: string): string {
  const f = channels(fg);
  const b = channels(bg);
  const mix = f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// --- The declared table ------------------------------------------------------

const SURFACES = ["bg-primary", "bg-secondary", "bg-tertiary"] as const;

/**
 * Every colour is measured against the *worst* surface of its theme. There is no map of which text lands
 * on which surface, and a hand-written one is wrong the moment a component moves. Worst-case needs no
 * maintenance and cannot be gamed.
 *
 * `tints` are the alphas at which this token is also used as the background behind its own text. Text on
 * a tint of itself is strictly harder than the same text on the bare page — the tint moves the background
 * toward the text — so that is the real floor.
 */
const TEXT_TOKENS: Record<string, number[]> = {
  "text-primary": [],
  "text-secondary": [],
  "text-muted": [0.1], // SpecDetail's inactive status pill
  accent: [0.1, 0.15, 0.2], // sidebar / fold controls / spec tabs, timeline, search mark (ui's badge is 20% too)
  "accent-hover": [],
  "code-text": [],
  "status-error": [0.1], // spec diff removed rows
  "status-success": [0.1], // spec diff added rows, timeline active status pill
  "status-warning": [],
};

/**
 * Graphics that carry their own information (WCAG 1.4.11's 3:1), each against what it is drawn on.
 *
 * `alpha` is the strength the mark is composited at, where it has one. It lives in an SVG attribute
 * rather than in a class, so no CSS parse finds it — same as `SPEK_MARKS` below, and declared for the
 * same reason: this is the one place with the values to multiply it against.
 */
const NON_TEXT: Array<{ token: string; on: string; alpha?: number; label: string }> = [
  { token: "status-success", on: "bg-tertiary", label: "progress bar fill on its track" },
  { token: "accent", on: "bg-tertiary", label: "in-progress bar fill on its track" },
  { token: "fold-rule", on: "bg-primary", label: "fold extent mark" },
  { token: "fold-rule", on: "bg-secondary", label: "fold extent mark" },
  // The schema workflow diagram. An edge is the only thing saying one step depends on another, and a
  // dash is the only non-colour cue for derived-vs-declared and for the archive step — so these owe
  // 3:1, and the legend swatches that stand for them are the same value at a fraction of the size.
  // Taken from the source, not copied from it: re-authoring `MARK_COLOR` or `MARK_OPACITY` re-measures
  // here instead of leaving this table describing a diagram that has moved on.
  { token: tokenOf(MARK_COLOR), on: "bg-secondary", alpha: MARK_OPACITY, label: "schema edge, arrowhead, legend swatches" },
  { token: tokenOf(MARK_COLOR), on: "bg-tertiary", alpha: MARK_OPACITY, label: "schema archive node outline" },
  { token: "accent", on: "bg-secondary", label: "schema connected edge and arrowhead" },
  { token: "accent", on: "bg-tertiary", label: "schema selected outline, apply dot" },
  { token: "text-secondary", on: "bg-tertiary", label: "schema hovered node outline" },
];

/**
 * A surface token rendered as **text** on a solid fill of another token.
 *
 * Its role in the palette does not exempt it: a label on the primary call to action is text on a
 * background like any other, and a token being a surface elsewhere says nothing about this pairing.
 * `SURFACES` counting as "accounted for" in the completeness test below is what left this measured by
 * nothing — and it is exactly the pairing that moves when either colour is re-authored.
 */
const TEXT_ON_FILL: Array<{ token: string; on: string; onAlpha?: number; label: string }> = [
  { token: "bg-primary", on: "accent", label: "primary button label (SelectRepo, empty states)" },
  { token: "bg-primary", on: "accent-hover", label: "primary button label, hovered" },
  // `onAlpha` is a tint of a **different** token, which `TEXT_TOKENS.tints` cannot express — it asks
  // only about a token over a tint of itself. That gap is why the schema diagram's `generates` line sat
  // at 4.45:1 in the light theme, on a selected step, from the day the selection wash was added: the
  // wash is accent, the text was text-muted, and nothing in this file could put the two together.
  { token: "text-secondary", on: "accent", onAlpha: 0.1, label: "schema node labels on the selection wash" },
  { token: "text-primary", on: "accent", onAlpha: 0.1, label: "schema step id on the selection wash" },
];

/**
 * Border alphas that owe nothing, each with why.
 *
 * `theme-toggle` states the rule and it is unchanged — decoration owes nothing, an indicator owes 3:1 —
 * so what these entries record is the judgement that each *is* decoration. Every one frames a badge or a
 * panel whose own text states what it states; none is the sole carrier of anything. Measured worst case
 * over the three surfaces: `status-warning/40` is 1.77:1 light / 2.63:1 dark, `accent/40` 1.92:1 light /
 * 2.30:1 dark. Raising either would make a hairline compete with the text it frames.
 *
 * The next border alpha that *is* the sole carrier of its information has to be measured instead of
 * landing here — which it now cannot avoid, because the scan below surfaces it either way.
 */
const DECORATIVE_BORDERS: Record<string, string> = {
  "status-warning/40": "jj conflict badge — its text names the conflict",
  "accent/40": "default-schema badge, timeline heading, schema-flow legend — each labelled in text",
};

/**
 * Alpha literals allowed to reach an SVG element, each with what accounts for it.
 *
 * `1` is not listed: full strength composites to the token itself, so it changes no measurement.
 *
 * A **named** alpha needs no entry either — `MARK_OPACITY` is imported into `NON_TEXT` above and
 * measured at whatever it currently is, which is stronger than an entry here could be. What this
 * table catches is the other spelling: a bare number typed at an element, which is measured by
 * nothing and reads as deliberate.
 */
const SVG_ALPHAS: Record<string, string> = {
  "0.1": "schema selection wash — measured in TEXT_ON_FILL as the tint the node labels sit on",
};

/**
 * SVG colour that owes nothing, each with why.
 *
 * The same shape as `DECORATIVE_BORDERS` and for the same reason: what these record is the judgement
 * that each *is* decoration, not an exemption from the rule. A token's role does not put it here — a
 * surface token drawn as an SVG fill still has to say why, because "it is a surface" is precisely the
 * answer that once left the primary button's label measured by nothing.
 */
const DECORATIVE_SVG: Record<string, string> = {
  border:
    "schema step outline — trim, not an indicator. The label carries a declared step at better than " +
    "13:1; the archive step, whose dash *is* the sole carrier, is drawn in text-muted instead.",
  "bg-tertiary":
    "schema step fill — a surface, and 1.10:1 against the panel in both themes, so it carries nothing. " +
    "The text on it is measured by TEXT_TOKENS against the worst surface, which is this one.",
};

/**
 * Colours not measured here need a reason — the last test in this section forces a new token to pick a
 * side.
 *
 * The BDD marks sit on `bg-<family>-500/20` fills that live in Tailwind, not in `global.css`. Measuring
 * them would mean pinning framework hexes into this file and drifting silently on the next upgrade. They
 * are specified by `markdown-renderer`; measured worst case is 4.86:1 dark and 4.97:1 light.
 */
const NOT_MEASURED_HERE = new Set([
  "kw-when", "kw-then", "kw-and", "kw-normative",
  "badge-added", "badge-modified", "badge-removed", "badge-renamed",
]);

const TEXT_FLOOR = 4.5;
const GRAPHIC_FLOOR = 3;

// --- Ratios ------------------------------------------------------------------

for (const [theme, tokens] of Object.entries(THEMES)) {
  test(`${theme}: every text colour clears ${TEXT_FLOOR}:1 on every surface`, () => {
    for (const [name, tints] of Object.entries(TEXT_TOKENS)) {
      const fg = tokens.get(name);
      assert.ok(fg, `${theme} is missing --color-${name}`);
      for (const surface of SURFACES) {
        const bg = tokens.get(surface)!;
        const ratio = contrast(fg, bg);
        assert.ok(
          ratio >= TEXT_FLOOR,
          `${theme} --color-${name} (${fg}) on --color-${surface} (${bg}) is ${ratio.toFixed(2)}:1`
        );
        for (const alpha of tints) {
          const tinted = contrast(fg, over(fg, alpha, bg));
          assert.ok(
            tinted >= TEXT_FLOOR,
            `${theme} --color-${name} (${fg}) on its own ${alpha * 100}% tint over ` +
              `--color-${surface} is ${tinted.toFixed(2)}:1`
          );
        }
      }
    }
  });

  test(`${theme}: a graphic carrying its own information clears ${GRAPHIC_FLOOR}:1`, () => {
    for (const { token, on, alpha, label } of NON_TEXT) {
      const fg = tokens.get(token)!;
      const bg = tokens.get(on)!;
      // A mark drawn at alpha is composited before it is compared: what the reader has to pick out is
      // the blend, not the token.
      const mark = alpha === undefined ? fg : over(fg, alpha, bg);
      const ratio = contrast(mark, bg);
      const at = alpha === undefined ? "" : ` at ${alpha * 100}%`;
      assert.ok(
        ratio >= GRAPHIC_FLOOR,
        `${theme} ${label}: --color-${token} (${fg})${at} on --color-${on} (${bg}) is ${ratio.toFixed(2)}:1`
      );
    }
  });

  test(`${theme}: a surface token used as text on a solid fill clears ${TEXT_FLOOR}:1`, () => {
    for (const { token, on, onAlpha, label } of TEXT_ON_FILL) {
      const fg = tokens.get(token)!;
      const fill = tokens.get(on)!;
      // A tint of another token is not a fill: it composites over whatever surface it lands on, so it
      // is measured over the worst of them rather than against the token's own value.
      const backgrounds =
        onAlpha === undefined
          ? [fill]
          : SURFACES.map((surface) => over(fill, onAlpha, tokens.get(surface)!));
      for (const bg of backgrounds) {
        const ratio = contrast(fg, bg);
        const at = onAlpha === undefined ? "" : ` at ${onAlpha * 100}%`;
        assert.ok(
          ratio >= TEXT_FLOOR,
          `${theme} ${label}: --color-${token} (${fg}) on --color-${on}${at} (${bg}) is ${ratio.toFixed(2)}:1`
        );
      }
    }
  });
}

/**
 * What `@spekjs/ui` draws, and at what strength. The alphas live in SVG attributes the package writes at
 * draw time (`fill-opacity`, `stroke-opacity`), so no CSS parse can find them — they are declared here, in
 * the one place that has the values to multiply them against.
 *
 * The maths is a **fill over a background**, not text on a tint: the mark itself is composited, and the
 * question is whether what lands is distinguishable from the page. `TEXT_TOKENS`'s `tints` asks the
 * opposite question and cannot express this.
 */
const SPEK_MARKS: Array<{ spekVar: string; alpha: number; floor: number; label: string }> = [
  { spekVar: "accent", alpha: 0.85, floor: GRAPHIC_FLOOR, label: "graph spec node" },
  { spekVar: "node-active", alpha: 0.85, floor: GRAPHIC_FLOOR, label: "graph active change node" },
  { spekVar: "text-muted", alpha: 0.85, floor: GRAPHIC_FLOOR, label: "graph archived node and edges" },
  { spekVar: "accent", alpha: 1, floor: GRAPHIC_FLOOR, label: "timeline active bar and today marker" },
  { spekVar: "text-muted", alpha: 1, floor: GRAPHIC_FLOOR, label: "timeline archived bar" },
  { spekVar: "accent", alpha: 1, floor: TEXT_FLOOR, label: "timeline today label" },
];

for (const [theme, tokens] of Object.entries(THEMES)) {
  test(`${theme}: what @spekjs/ui draws clears its floor`, () => {
    const mapping = spekMapping();
    for (const { spekVar, alpha, floor, label } of SPEK_MARKS) {
      const tokenName = mapping.get(spekVar);
      assert.ok(tokenName, `--spek-${spekVar} is not mapped in :root — the package would use its own default`);
      const fg = tokens.get(tokenName);
      assert.ok(fg, `--spek-${spekVar} maps to --color-${tokenName}, which this theme does not define`);
      for (const surface of SURFACES) {
        const bg = tokens.get(surface)!;
        const drawn = alpha === 1 ? fg : over(fg, alpha, bg);
        const ratio = contrast(drawn, bg);
        assert.ok(
          ratio >= floor,
          `${theme} ${label}: --spek-${spekVar} → --color-${tokenName} (${fg}) at ${alpha} over ` +
            `--color-${surface} is ${ratio.toFixed(2)}:1, below ${floor}:1`
        );
      }
    }
  });
}

test("every contract member is mapped and measured", () => {
  // An unmapped member silently falls back to the package's dark default — the failure mode that adding a
  // member to the contract creates, and the one nothing in the package can detect.
  const mapping = spekMapping();
  const measured = new Set(SPEK_MARKS.map((m) => m.spekVar));
  // Surfaces and text colours the package uses for its own panels are measured as `--color-*` already.
  const carriedByTheAppsOwnTable = new Set([
    "bg-primary", "bg-secondary", "bg-tertiary", "border", "text-primary", "text-secondary",
  ]);
  const unaccounted = [...mapping.keys()].filter(
    (name) => !measured.has(name) && !carriedByTheAppsOwnTable.has(name)
  );
  assert.deepEqual(
    unaccounted,
    [],
    `these --spek-* members are mapped but nothing measures what they draw: ${unaccounted.join(", ")}`
  );
});

test("every colour token is either measured or explicitly excluded", () => {
  // The hand-written table's likeliest failure is not a wrong number but a new token nobody added to it:
  // that does not fail, it just quietly stops being covered.
  const accounted = new Set([
    ...Object.keys(TEXT_TOKENS),
    ...SURFACES,
    ...NON_TEXT.map((n) => n.token),
    ...TEXT_ON_FILL.flatMap((t) => [t.token, t.on]),
    ...NOT_MEASURED_HERE,
    "border",
  ]);
  const unaccounted = [...DARK.keys()].filter((name) => !accounted.has(name));
  assert.deepEqual(
    unaccounted,
    [],
    `these --color-* tokens are neither measured nor excluded: ${unaccounted.join(", ")}`
  );
});

// --- Mechanism ---------------------------------------------------------------

function sources(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push({ path: full.slice(SRC.length), text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(SRC);
  return out;
}

const PALETTE_FAMILIES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";

test("no colour is applied to text by a hard-coded palette class", () => {
  // This is the half that stops the defect class returning: the values can be correct today and undone by
  // the next `text-red-400`, because that is one literal shared by both themes and no shade in any family
  // is readable on both backgrounds.
  //
  // Matches `text-` only. The BDD pill fills (`bg-<family>-500/20`) are deliberately plain classes — an
  // alpha composites over whichever page colour is active and needs no token of its own. The text colour
  // is the half that must be per-theme.
  const offenders: string[] = [];
  const pattern = new RegExp(`\\b(?:[a-z-]+:)?text-(?:${PALETTE_FAMILIES})-(?:50|[1-9]00|950)\\b`, "g");
  for (const { path, text } of sources()) {
    for (const m of text.matchAll(pattern)) offenders.push(`${path}: ${m[0]}`);
  }
  assert.deepEqual(offenders, [], `use a --color-* token instead:\n${offenders.join("\n")}`);
});

/**
 * The mechanisms this file enumerates, and the ones it does not.
 *
 * Stated because an enumeration that is not stated reads as a complete one. A palette is reported as
 * conforming on the strength of the cases someone thought to look at, and the two gaps found so far were
 * both of that shape — a border alpha nobody scanned, and a token exempted from measurement by its role
 * rather than by its use.
 *
 * **Enumerated**: a hard-coded palette class on text (`text-<family>-<shade>`), a token tint used as a
 * background (`bg-<token>/<alpha>`), a token tint used as a border (`border-<token>/<alpha>`),
 * `opacity-*` on anything, and a `--color-*` token reaching SVG.
 *
 * That last one used to sit in the list below, on the strength of a single decorative occurrence. It
 * moved when the schema workflow diagram began stating its dependencies, its declared-vs-derived
 * distinction and its not-declared-by-this-schema mark entirely through SVG — an exclusion is a claim
 * about how the app uses a mechanism, and the app goes on being written. It is scanned by the **token**,
 * not by the attribute: the arrowhead colours live in an object literal and reach the element as
 * `fill={color}`, so an attribute-scoped pattern would have missed them while reporting the diagram as
 * covered, and matching the token needs no multi-line parse that could bridge two elements.
 *
 * The SVG scan is by token, so it forces a decision on a token nobody has classified — not on a second
 * use of one already classified. That residue is stated with the scan itself.
 *
 * **Not enumerated**, and each would need its own scan: inline `style={{ color }}`; a bare `opacity` /
 * `fill-opacity` / `stroke-opacity` SVG attribute on an element whose colour is *not* a token —
 * `currentColor` and literal fills, which is the checkmark disc's `opacity="0.2"` in `ChangeDetail` and
 * the two marks in `Layout`, all measured by hand and passing; `ring-*` / `outline-*` / gradient
 * utilities; and literal alphas of non-token colours (`bg-black/60` scrims). A mechanism the app begins
 * to use belongs here or in a scan, not in neither — and one already here belongs in a scan as soon as
 * the app starts saying something with it.
 */

test("no tint of a text token goes unmeasured", () => {
  // The table above is hand-written, and this is its weak point: an alpha nobody declared is simply not
  // measured. The pairing itself cannot be discovered — SpecDiffViewer builds its fill and its text class
  // in separate variables, so no scanner sees them on one element — but the *existence* of an unmeasured
  // alpha can be.
  //
  // Scoped to the text tokens: `bg-black/60` scrims and `bg-bg-tertiary/80` surface-on-surface alphas must
  // never be in the table, and without the scope this rule would fail on day one.
  const measured = new Set(
    Object.entries(TEXT_TOKENS).flatMap(([name, tints]) => tints.map((a) => `${name}/${a * 100}`))
  );
  const names = Object.keys(TEXT_TOKENS).join("|");
  const pattern = new RegExp(`\\bbg-(${names})/(\\d+)\\b`, "g");
  const unmeasured: string[] = [];
  for (const { path, text } of sources()) {
    for (const m of text.matchAll(pattern)) {
      if (!measured.has(`${m[1]}/${m[2]}`)) unmeasured.push(`${path}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    unmeasured,
    [],
    `add the alpha to TEXT_TOKENS so it is measured:\n${unmeasured.join("\n")}`
  );
});

test("no alpha of a token reaches the screen through a border unaccounted for", () => {
  // The third mechanism, and the one the scan above cannot see: it builds its pattern from `bg-`, so a
  // `border-<token>/<alpha>` passed either way — measured or not — without ever being surfaced. Five
  // occurrences existed when this was added, all decorative and now declared as such.
  //
  // Declared, not measured: `theme-toggle` holds that a border framing a badge whose text names the state
  // is not the indicator. What this rule forces is the *choice* — a border alpha is either in
  // DECORATIVE_BORDERS with a reason, or somebody has to measure it.
  const names = Object.keys(TEXT_TOKENS).join("|");
  const pattern = new RegExp(`\\bborder-(${names})/(\\d+)\\b`, "g");
  const unaccounted: string[] = [];
  for (const { path, text } of sources()) {
    for (const m of text.matchAll(pattern)) {
      // Keyed by the utility as written (`accent/40`), so a declaration reads as the class it exempts.
      if (!(`${m[1]}/${m[2]}` in DECORATIVE_BORDERS)) unaccounted.push(`${path}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    unaccounted,
    [],
    `measure it, or declare it in DECORATIVE_BORDERS with why it owes nothing:\n${unaccounted.join("\n")}`
  );
});

test("no --color-* token reaches SVG unaccounted for", () => {
  // The fifth mechanism. Matched by the token rather than by `stroke=` / `fill=`, because the two
  // spellings that matter are not attributes: the arrowhead colours sit in an object literal consumed as
  // `fill={color}`, and the node outline is a six-line ternary an attribute pattern would have to span.
  //
  // In this codebase a `--color-*` token reaches a .tsx file only to colour SVG — everything else goes
  // through Tailwind utilities — so the token is the mechanism. If that stops being true, an occurrence
  // arrives here needing a declaration rather than a measurement, which is a decision worth forcing.
  //
  // Its reach, stated because it is narrower than it looks: this surfaces a token **nobody has decided
  // about**, not every new use of one already decided. A token measured as a mark in NON_TEXT counts as
  // accounted for when it later appears as SVG text, where it would owe 4.5 rather than 3. Per-occurrence
  // accounting would mean carrying source positions in the tables, which rots faster than it catches;
  // what closes this instead is that the tables name where each entry applies, so a reader adding a use
  // the label does not describe can see that it is undeclared.
  const accounted = new Set([
    ...Object.keys(TEXT_TOKENS),
    ...NON_TEXT.map((m) => m.token),
    ...TEXT_ON_FILL.map((m) => m.token),
    ...Object.keys(DECORATIVE_SVG),
  ]);
  const pattern = /var\(--color-([a-z0-9-]+)\)/g;
  const unaccounted: string[] = [];
  for (const { path, text } of sources()) {
    for (const m of text.matchAll(pattern)) {
      if (!accounted.has(m[1])) unaccounted.push(`${path}: ${m[0]}`);
    }
  }
  assert.deepEqual(
    unaccounted,
    [],
    "measure it in NON_TEXT / TEXT_ON_FILL / TEXT_TOKENS, or declare it in DECORATIVE_SVG with why it " +
      `owes nothing:\n${unaccounted.join("\n")}`
  );
});

test("no alpha reaches an SVG element unaccounted for", () => {
  // The token scan above surfaces *which* colour reaches SVG and this one surfaces *at what strength*,
  // because the two are one fact: `--color-text-muted` is 5.17:1 at full strength and 1.39:1 at a quarter,
  // and only the second of those is a defect. Without this, dropping the edge to `strokeOpacity={0.25}`
  // passes every check in this file while drawing the diagram fainter than the hairline colour this
  // change replaced.
  //
  // Two spellings, because the marker colours reach the element through an object literal rather than an
  // attribute: `fillOpacity={opacity}` where `opacity: MARK_OPACITY` was set in a table above it.
  //
  // Only *numeric literals* are judged. An identifier is a pass-through — either it is a named constant
  // measured where the table imports it, or its definition is an `opacity:` property this same scan
  // reads. Chasing the binding would mean parsing, and the two ends are already covered.
  const patterns = [/(?:stroke|fill)Opacity=\{([^}]*)\}/g, /\bopacity:\s*([^,}\n]+)/g];
  const unaccounted: string[] = [];
  for (const { path, text } of sources()) {
    for (const pattern of patterns) {
      for (const m of text.matchAll(pattern)) {
        for (const literal of m[1].match(/\b\d*\.?\d+\b/g) ?? []) {
          if (literal !== "1" && !(literal in SVG_ALPHAS)) unaccounted.push(`${path}: ${m[0].trim()}`);
        }
      }
    }
  }
  assert.deepEqual(
    unaccounted,
    [],
    `name it (a constant the tables measure) or declare it in SVG_ALPHAS:\n${unaccounted.join("\n")}`
  );
});

test("contrast is not undone by opacity", () => {
  // Opacity is the one mechanism that defeats the token rule outright: it applies after the colour is
  // chosen, and to every descendant at once. The completed task row failed exactly this way — body text
  // 3.24:1 dark and 2.77:1 light, its links lower still.
  //
  // WCAG 1.4.3 exempts inactive components only, so `disabled:` is the single way out. The rule is blunt
  // on purpose: someone who genuinely needs opacity can argue with this test once, which beats an
  // allowlist nobody maintains.
  const offenders: string[] = [];
  for (const { path, text } of sources()) {
    for (const m of text.matchAll(/(?:^|[\s"'`{])((?:[a-z-]+:)?opacity-\d+)\b/g)) {
      if (!m[1].startsWith("disabled:")) offenders.push(`${path}: ${m[1]}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `de-emphasise with a --color-* token instead:\n${offenders.join("\n")}`
  );
});
