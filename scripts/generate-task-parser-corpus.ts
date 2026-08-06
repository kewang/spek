import fs from "node:fs";
import path from "node:path";
import { parseTasks } from "../packages/core/dist/index.js";

// Generates throwaway fixtures to *discover* divergences between the two task parsers, as opposed to
// the committed corpus in test-fixtures/task-parser/, which *records* the ones someone already found.
//
// The corpus alone does not close the hole issue #41 describes: every fixture asserts against an
// authored constant, so the two implementations are never compared to each other, and a person still
// has to think of the input. This closes that — and it needs almost nothing new, because the corpus
// format is already a cross-runtime marshalling format and both loaders already accept a substituted
// directory.
//
//   npx tsx scripts/generate-task-parser-corpus.ts --count 500 --seed 7
//   SPEK_TASK_CORPUS_DIR=<dir> npm test -w @spekjs/core            # sanity: expectations came from here
//   cd packages/intellij && ./gradlew test -Dspek.taskParserCorpus=<dir>   # the actual differential run
//
// `expected` comes from the TypeScript implementation. That is NOT a claim that TypeScript is right —
// it is a disagreement detector. A Kotlin failure is a finding for a person to adjudicate against the
// reference renderer, after which the minimised input is added to the committed corpus as an ordinary
// authored fixture. Generated runs are never part of a gate: a random-input gate is a flaky gate, and
// a disagreement is not by itself a verdict on either side.

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 && idx + 1 < process.argv.length ? process.argv[idx + 1] : undefined;
}

const COUNT = Number(getArg("--count") ?? 200);
const SEED = Number(getArg("--seed") ?? 1);
const OUT_DIR = path.resolve(getArg("--out") ?? ".task-parser-scratch");

// U+0085 is an accepted divergence, recorded in the committed corpus with a per-implementation
// expectation. A generated fixture has no way to say that, so leaving it in the alphabet makes every
// batch report the same known difference — roughly 3% of a 500-input run, drowning the signal the
// generator exists for. Excluded by default so that ANY failure is something new; include it when
// probing that neighbourhood deliberately.
const INCLUDE_KNOWN = process.argv.includes("--include-known-divergences");

// A seeded LCG rather than Math.random: a run that finds something has to be reproducible from the
// seed printed below, or the finding cannot be minimised.
function makeRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = makeRandom(SEED);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

// Drawn from the constructs the parser's rules actually branch on, not uniform random text — which
// would spend its whole budget on inputs no rule distinguishes. Every group below corresponds to a
// rule in tasks.ts: the line-ending normalisation, the content-offset dedent, the blank-line
// boundary, BLOCK_OPENER_RE, the column-0 checkbox anchor, and the two runtimes' whitespace tables.
const NL = String.fromCharCode(0x85);
const NBSP = String.fromCharCode(0xa0);
const FS = String.fromCharCode(0x1c);

const LINE_ENDINGS = ["\n", "\r\n", "\r"] as const;
const INDENTS = ["", " ", "  ", "   ", "    ", "      ", "\t", "\t ", " \t"] as const;
const CHECKBOXES = ["- [ ] ", "- [x] ", "- [X] "] as const;
const CONTENTS: readonly string[] = [
  "task",
  "task  ", // two-space hard break
  "task\\", // backslash hard break
  `a${NBSP}b`,
  "text with `code`",
  "===", // setext underline: absorbed as paragraph text by the reference
  ...(INCLUDE_KNOWN ? [`a${NL}b`] : []),
];
const BLOCK_OPENERS = [
  "- bullet",
  "* bullet",
  "+ bullet",
  "1. ordered",
  "2) ordered",
  "> quoted",
  "# h1",
  "### h3",
  "#hashtag", // not a heading: no space after the marker
  "```",
  "~~~~",
  "---",
  "***",
  "_ _ _",
] as const;
const BLANKISH: readonly string[] = ["", " ", "  ", "\t", " \t ", NBSP, FS, ...(INCLUDE_KNOWN ? [NL] : [])];
const HEADINGS: readonly string[] = [
  "## Phase",
  "## Phase  ",
  `## P${NBSP}`,
  "##",
  "## ",
  ...(INCLUDE_KNOWN ? [`## P${NL}Q`] : []),
];

function line(): string {
  const roll = random();
  if (roll < 0.4) return pick(INDENTS) + pick(CHECKBOXES) + pick(CONTENTS);
  if (roll < 0.6) return pick(INDENTS) + pick(BLOCK_OPENERS);
  if (roll < 0.75) return pick(BLANKISH);
  if (roll < 0.85) return pick(HEADINGS);
  return pick(INDENTS) + pick(CONTENTS);
}

function input(): string {
  const count = 1 + Math.floor(random() * 7);
  let out = "";
  for (let i = 0; i < count; i++) {
    out += line();
    if (i < count - 1 || random() < 0.5) out += pick(LINE_ENDINGS);
  }
  return out;
}

// JSON.stringify escapes control characters but leaves every other non-ASCII character literal, and
// a literal U+0085 or U+00A0 in a fixture is exactly what the corpus format forbids — both loaders
// reject the file on its bytes. Escaping here keeps generated fixtures loadable by the same loaders
// as committed ones, which is the whole point of reusing the format.
const NON_ASCII_RE = new RegExp("[\\u007f-\\uffff]", "g");

function toAsciiJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(NON_ASCII_RE, (ch) => {
    return `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`;
  });
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const width = String(COUNT).length;
for (let i = 0; i < COUNT; i++) {
  const name = `generated-${String(i).padStart(width, "0")}`;
  const content = input();
  const fixture = {
    name,
    note: `Generated by scripts/generate-task-parser-corpus.ts --seed ${SEED}. Expectation is the TypeScript implementation's output, used as a disagreement detector and not as an oracle.`,
    input: content,
    expected: parseTasks(content),
  };
  fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), `${toAsciiJson(fixture)}\n`, "ascii");
}

console.log(
  `Wrote ${COUNT} generated fixtures to ${OUT_DIR} (seed ${SEED}` +
    `${INCLUDE_KNOWN ? ", including known divergences" : ""})`,
);
console.log("");
console.log("Differential run — the Kotlin side against the TypeScript side's output:");
console.log(`  cd packages/intellij && ./gradlew test -Dspek.taskParserCorpus=${OUT_DIR}`);
console.log("");
console.log("A failure is a disagreement to adjudicate, not a verdict. Minimise it, decide which side");
console.log("is right against the reference renderer, then add it to test-fixtures/task-parser/ as an");
console.log("authored fixture. Reproduce this exact batch with --seed " + SEED + ".");
