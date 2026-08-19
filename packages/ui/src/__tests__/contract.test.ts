import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/*
 * The colour contract's two guards.
 *
 * They are here rather than in the host because they are the only colour questions this package can answer
 * on its own. It has no theme: a host maps its tokens onto the contract, so the *values* a reader sees are
 * the host's and the ratios belong to the host's own test. What belongs here is the pair of facts that hold
 * whatever the host does — that nothing is drawn from outside the contract, and that the defaults an
 * un-themed host falls back to are legible.
 */

const SRC = fileURLToPath(new URL("..", import.meta.url));
const STYLES = readFileSync(join(SRC, "styles.css"), "utf8");

// --- The contract's own declaration ------------------------------------------

/** The `:root` block, which is the one place in this file a colour literal is allowed. */
function contractBlock(): string {
  const block = /:root\s*\{([^}]*)\}/.exec(STYLES)?.[1];
  assert.ok(block, "expected a :root block declaring the contract");
  return block;
}

function contractDefaults(): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of contractBlock().matchAll(/--spek-([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out.set(m[1], m[2].toLowerCase());
  }
  return out;
}

// --- Guard 1: no colour outside the contract ---------------------------------

function sources(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__") walk(full);
      } else if (/\.(tsx?|css)$/.test(entry)) {
        out.push({ path: full.slice(SRC.length), text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(SRC);
  return out;
}

/**
 * Everything that may legitimately look like a colour and is not one the contract should own.
 *
 * `transparent` renders nothing, so it cannot be theme-wrong — it appears in four `color-mix(…,
 * transparent)` declarations and one `fill="transparent"`. The tooltip's shadow is deliberately black
 * rather than a contract colour: a shadow is the absence of light on whatever is behind it, and tinting it
 * with a theme colour is a different design decision from the one this guard is protecting.
 */
const ALLOWED = [
  /\btransparent\b/g,
  /rgb\(0 0 0 \/ 0\.3\)/g,
];

test("no colour is rendered from outside the contract", () => {
  // A literal cannot follow a theme it cannot see. This is the rule that stops the next `#22c55e`: eleven
  // of them grew beside the contract, and most were copies of a contract value that had since moved on.
  const offenders: string[] = [];
  for (const { path, text } of sources()) {
    let scannable = text;
    // The contract's own declaration is where the defaults live, and `FALLBACKS` mirrors it for d3, which
    // writes colours into SVG attributes and cannot use `var()`.
    if (path.endsWith("styles.css")) scannable = scannable.replace(/:root\s*\{[^}]*\}/, "");
    if (path.endsWith("theme.ts")) scannable = scannable.replace(/const FALLBACKS[^;]*;/s, "");
    for (const allowed of ALLOWED) scannable = scannable.replace(allowed, "");

    // Named colours are matched as whole CSS values only — `white-space: nowrap` is not a colour.
    const patterns: Array<[RegExp, string]> = [
      [/#[0-9a-fA-F]{3,8}\b/g, "hex"],
      [/\b(?:rgba?|hsla?)\([^)]*\)/g, "function"],
      [/:\s*(?:white|black|red|green|blue|gray|grey|silver|orange|purple|yellow)\s*[;"'`,)]/g, "named"],
    ];
    for (const [re, kind] of patterns) {
      for (const m of scannable.matchAll(re)) offenders.push(`${path}: ${kind} ${m[0].trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these colours cannot follow a host's theme — express them through the contract:\n${offenders.join("\n")}`
  );
});

// --- Guard 2: the defaults are legible ---------------------------------------

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

function over(fg: string, alpha: number, bg: string): string {
  const f = channels(fg);
  const b = channels(bg);
  return `#${f.map((v, i) => Math.round(alpha * v + (1 - alpha) * b[i]).toString(16).padStart(2, "0")).join("")}`;
}

const SURFACES = ["bg-primary", "bg-secondary", "bg-tertiary"] as const;

/**
 * What each default carries, and therefore which floor it answers to — **once per strength it is drawn
 * at**, not once per member.
 *
 * A member is not used one way. `text-muted` sets tooltip body text at full strength *and* strokes every
 * graph edge at 0.85 *and* fills an archived node at 0.85; `accent` fills a spec node at 0.85 *and* sets
 * the timeline's *today* label, which is text and answers to 4.5:1. Declaring one nominal strength per
 * member means the guard passes on the use it happens to name and says nothing about the others — and
 * both of the wrong entries here were wrong in the *stricter* direction, so nothing failed and nothing
 * would have, until a default was re-authored toward the surface.
 *
 * `packages/web/src/styles/contrast.test.ts`'s `SPEK_MARKS` is the same shape, and is where the alphas
 * the host draws these at are declared: the two halves of one obligation, split because the package has
 * no values to measure a themed host with and the host cannot see the alphas d3 writes at draw time.
 */
const CARRIES: Record<string, Array<{ floor: number; alpha: number; use: string }>> = {
  "text-primary": [{ floor: 4.5, alpha: 1, use: "tooltip slug, highlighted graph edges" }],
  "text-secondary": [{ floor: 4.5, alpha: 1, use: "graph node labels, timeline row labels" }],
  "text-muted": [
    { floor: 4.5, alpha: 1, use: "tooltip body, timeline empty state, section labels, axis ticks" },
    { floor: 3, alpha: 0.85, use: "graph edges (stroke-opacity), archived change node fill" },
  ],
  accent: [
    { floor: 3, alpha: 0.85, use: "spec node fill" },
    { floor: 4.5, alpha: 1, use: "the timeline's *today* label — 10px text, so the text floor" },
  ],
  "node-active": [{ floor: 3, alpha: 0.85, use: "active change node fill" }],
  "bg-primary": [],
  "bg-secondary": [],
  "bg-tertiary": [],
  // A panel hairline, and deliberately not held to 3:1 — see `timeline-view`: the marks it draws
  // (grid lines, separators) are decoration, and the dates they help read are stated by the axis labels.
  border: [],
};

test("every default is legible on the package's own surfaces, at every strength it is drawn at", () => {
  // The un-themed host is the only case this package has values for, so it is the only one it asserts.
  const defaults = contractDefaults();
  for (const [name, uses] of Object.entries(CARRIES)) {
    const fg = defaults.get(name);
    assert.ok(fg, `the contract no longer declares --spek-${name}`);
    for (const spec of uses) {
      for (const surface of SURFACES) {
        const bg = defaults.get(surface)!;
        const drawn = spec.alpha === 1 ? fg : over(fg, spec.alpha, bg);
        const ratio = contrast(drawn, bg);
        assert.ok(
          ratio >= spec.floor,
          `--spek-${name} (${fg}${spec.alpha === 1 ? "" : ` at ${spec.alpha}`}) on --spek-${surface} (${bg}) ` +
            `is ${ratio.toFixed(2)}:1, below ${spec.floor}:1 — ${spec.use}`
        );
      }
    }
  }
});

test("the un-themed path is complete", () => {
  // A host that overrides nothing takes two routes: CSS reads the `:root` declaration, and d3 — which writes
  // colours into SVG attributes and cannot use `var()` — reads FALLBACKS. A member present in one and absent
  // from the other renders in one half of the component and not the other, which is worse than either.
  const theme = readFileSync(join(SRC, "theme.ts"), "utf8");
  const declared = new Set(contractDefaults().keys());
  const names = [...theme.matchAll(/"--spek-([\w-]+)"/g)].map((m) => m[1]);
  const inFallbacks = new Set(
    [...(/const FALLBACKS[^;]*;/s.exec(theme)?.[0] ?? "").matchAll(/CSS_VARS\.(\w+)/g)].map((m) => m[1])
  );
  const varToKey = new Map(
    [...theme.matchAll(/(\w+):\s*"--spek-([\w-]+)"/g)].map((m) => [m[2], m[1]] as const)
  );
  for (const name of names) {
    assert.ok(declared.has(name), `--spek-${name} is in CSS_VARS but styles.css declares no default for it`);
    assert.ok(
      inFallbacks.has(varToKey.get(name)!),
      `--spek-${name} has no FALLBACKS entry, so d3 would resolve it to the last-resort colour`
    );
  }
  for (const name of declared) {
    assert.ok(varToKey.has(name), `styles.css declares --spek-${name} but CSS_VARS does not name it`);
  }
});

test("every declared default is classified", () => {
  // A new contract member that nobody classified would be silently unmeasured rather than failing.
  const unclassified = [...contractDefaults().keys()].filter((name) => !(name in CARRIES));
  assert.deepEqual(
    unclassified,
    [],
    `classify these in CARRIES (one entry per strength it is drawn at, or [] for a colour that carries ` +
      `nothing): ${unclassified.join(", ")}`
  );
});

test("the shipped documentation names every contract member", () => {
  // The one drift no other guard here can see, and the one that actually shipped: @spekjs/ui@1.3.0 added a
  // ninth member and went out with a README describing eight. A host overrides the names it is told about,
  // so the omitted one silently kept the package's *dark* default — reproducing, in a light theme, the very
  // bug that release fixed.
  //
  // What this can hold is membership, not description: it cannot tell that a row describes a colour the
  // components stopped drawing with it (two rows were wrong that way too). Membership is the half that is
  // mechanical, and it is the half that failed.
  const readme = readFileSync(join(SRC, "..", "README.md"), "utf8");
  const missing = [...contractDefaults().keys()].filter((name) => !readme.includes(`--spek-${name}`));
  assert.deepEqual(
    missing,
    [],
    `the README does not name these members, so a host re-theming from it would inherit the package's ` +
      `defaults for them: ${missing.join(", ")}`
  );
});
