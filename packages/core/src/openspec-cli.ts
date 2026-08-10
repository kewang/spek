import spawn from "cross-spawn";
import { CLI_CACHE_TTL_MS, CLI_TIMEOUT_MS } from "./cli-budget.js";
import type { SchemaDegradedReason } from "./types.js";

/**
 * Talking to the `openspec` CLI, and remembering what it said.
 *
 * Both of the things here were written twice before this module existed — once in `schema-order.ts`
 * and again in `schemas.ts` — and the duplication was not free: the cache's original "remember
 * failures forever" bug had to be found once and then hand-copied as a fix into the second copy.
 * The 10s timeout, the spawn options, and the 30s/256-entry cache policy are each stated once, here.
 */

// Stryker disable all: thin integration layer over a child process. The parsing it feeds is
// unit-tested; this only spawns, times out, and classifies failure.

// Defined in cli-budget.ts so browser bundles can read them without pulling in child_process.
export { CLI_TIMEOUT_MS } from "./cli-budget.js";

/**
 * Every failure mode gets its own reason so surfaces can word them differently — "the CLI is not
 * installed" is fixable by the reader; "the CLI returned something we could not read" is not the
 * same thing at all. Callers that do not care collapse the whole `!ok` side to a single fallback.
 *
 * A failure may still carry `json`. The CLI exits non-zero for *domain* answers as well as for
 * breakage — `schema which <unknown>` prints a perfectly good `{"error": "Schema 'x' not found"}`
 * and exits 1 — so discarding stdout on a non-zero exit loses the answer and reports a working CLI
 * as broken. Parsed stdout is kept; deciding what it means belongs to the caller.
 */
export type CliResult =
  | { ok: true; json: unknown }
  | { ok: false; reason: SchemaDegradedReason; json?: unknown };

/**
 * The CLI's own error message, when a failed run still produced a structured `{ error: string }`
 * body. Non-null means the CLI **ran and answered** — the request failed, not the tool.
 */
export function cliErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const message = (json as Record<string, unknown>).error;
  return typeof message === "string" ? message : null;
}

/** Run `openspec <args>` and parse its stdout as JSON. */
function spawnOpenspecJson(args: string[], cwd: string): Promise<CliResult> {
  // argv array, not a shell string: each argument is structurally its own token, so no input can
  // become shell syntax. cross-spawn resolves openspec.cmd on Windows without a shell (avoiding
  // DEP0190 / CVE-2024-27980).
  return new Promise<CliResult>((resolve) => {
    let out = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (r: CliResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    let child;
    try {
      child = spawn("openspec", args, {
        cwd,
        // stderr ignored deliberately rather than merged: the schema commands print an
        // experimental-command notice there, and merging it would corrupt stdout's JSON.
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
    } catch {
      finish({ ok: false, reason: "cli-unavailable" });
      return;
    }
    timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, reason: "cli-timeout" });
    }, CLI_TIMEOUT_MS);
    child.stdout?.setEncoding("utf-8");
    child.stdout?.on("data", (d: string) => {
      out += d;
    });
    child.on("error", () => finish({ ok: false, reason: "cli-unavailable" })); // ENOENT
    child.on("close", (code: number | null) => {
      let json: unknown;
      let parsed = false;
      try {
        json = JSON.parse(out);
        parsed = true;
      } catch {
        // leave unparsed
      }
      if (code !== 0) {
        // stdout is still forwarded when it parsed — see the note on CliResult.
        finish(parsed ? { ok: false, reason: "cli-failed", json } : { ok: false, reason: "cli-failed" });
        return;
      }
      finish(parsed ? { ok: true, json } : { ok: false, reason: "cli-unparsable" });
    });
  });
}

/** Injectable CLI runner, so tests drive a stub instead of the real binary. */
export type OpenspecRunner = (args: string[], cwd: string) => Promise<CliResult>;

let runner: OpenspecRunner = spawnOpenspecJson;

/** Replace the CLI runner (tests only). Returns the previous one so callers can restore it. */
export function setOpenspecRunner(next: OpenspecRunner): OpenspecRunner {
  const prev = runner;
  runner = next;
  return prev;
}

/** Run the CLI through whichever runner is installed. */
export function runOpenspec(args: string[], cwd: string): Promise<CliResult> {
  return runner(args, cwd);
}

// ---------------------------------------------------------------------------
// Caching
// ---------------------------------------------------------------------------

/** TTL and its floor are stated in cli-budget.ts; the size cap is local and depends on nothing. */
export const CACHE_TTL_MS = CLI_CACHE_TTL_MS;
const CACHE_MAX = 256;

export interface CacheEntry<T> {
  at: number;
  promise: Promise<T>;
}

/**
 * Memoise `compute` under `key`, holding the **Promise** rather than the resolved value — so
 * concurrent callers arriving mid-flight share one run instead of starting a second.
 */
export function ttlCached<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at <= CACHE_TTL_MS) return hit.promise;
  if (hit) store.delete(key);

  const promise = compute();
  if (store.size >= CACHE_MAX) {
    const oldest = store.keys().next().value; // Map keeps insertion order
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { at: Date.now(), promise });
  return promise;
}

// Stryker restore all
