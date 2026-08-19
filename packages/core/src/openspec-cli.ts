import spawn from "cross-spawn";
import { CLI_CACHE_TTL_MS, CLI_TIMEOUT_MS } from "./cli-budget.js";
import type { SchemaDegradedReason } from "./types.js";

/**
 * Talking to the `openspec` CLI, and remembering what it said.
 *
 * Both of the things here were written twice before this module existed — once in `schema-order.ts`
 * and again in `schemas.ts` — and the duplication was not free: the cache's original "remember
 * failures forever" bug had to be found once and then hand-copied as a fix into the second copy.
 * The 10s timeout, the spawn options, the 30s/256-entry cache policy, and which failures are worth
 * remembering at all are each stated once, here.
 */

// Stryker disable all: thin integration layer over a child process. The parsing it feeds is
// unit-tested; this only spawns, times out, and classifies failure. The cache below is the
// exception — it holds policy, and `openspec-cli.test.ts` covers it.

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
 * Reasons a second read could plausibly come out differently — the ones a running host repairs by
 * itself. `cli-unavailable` is a binary not on `PATH` *yet* (a desktop app resolving the user's
 * shell `PATH` at startup is the reported case, issue #46); `cli-timeout` is load easing.
 *
 * The other two are not: a non-zero exit with no body, or output that cannot be parsed, is the
 * *installed CLI* answering — a version too old for a command it still marks experimental, a wrapper
 * printing a banner — and a read a second later finds it identical. Retrying those on every read
 * buys nothing and costs a full process start each time (~0.65-1.3s here, against ~5ms for a missing
 * binary), on views that re-read whenever the watched tree changes.
 *
 * One rule rather than a list per caller, and it reads `SchemaDegradedReason`, so a reason added
 * later has to be placed on one side of it.
 */
export function isTransient(reason: SchemaDegradedReason): boolean {
  return reason === "cli-unavailable" || reason === "cli-timeout";
}

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

/**
 * TTL and its floor are stated in cli-budget.ts; the size cap depends on nothing and is stated here.
 *
 * Both are exported because a caller may need a second, differently-keyed store beside the one it
 * memoises through — `schema-order.ts` keeps one — and such a store has to age and be bounded on the
 * same terms. A second copy of either number is a second thing to keep in step, which is the whole
 * reason this module exists.
 */
export const CACHE_TTL_MS = CLI_CACHE_TTL_MS;
export const CACHE_MAX = 256;

export interface CacheEntry<T> {
  at: number;
  promise: Promise<T>;
}

/**
 * A result, plus whether it is worth remembering.
 *
 * The cache cannot work this out from the value, because the value has usually already lost it: a
 * null schema order means both "the CLI answered and there is no order" and "the CLI could not be
 * reached", and a definition read reports "no such schema" both for a name the CLI refused and for a
 * `schema.yaml` it could not open. So whoever still holds the two apart says which this is, and says
 * it *there* — a predicate taking the value could only re-derive a judgement that has already been
 * thrown away.
 */
export interface CliOutcome<T> {
  value: T;
  remember: boolean;
}

/** An answer: cached for the bounded lifetime, like any successful read. */
export function answered<T>(value: T): CliOutcome<T> {
  return { value, remember: true };
}

/** A failure the next read could find gone: returned to the caller, but not remembered. */
export function failed<T>(value: T): CliOutcome<T> {
  return { value, remember: false };
}

/**
 * Memoise `compute` under `key`, holding the **Promise** rather than the resolved value — so
 * concurrent callers arriving mid-flight share one run instead of starting a second.
 *
 * `compute` must classify its own result. There is deliberately no default: every call site that
 * existed when this was added had got it wrong (a failure was remembered exactly as long as an
 * answer, so one unreachable CLI meant half a minute of stale "unavailable" — issue #46), and a
 * default is how the next one would get it wrong without saying anything.
 *
 * A failure is dropped **after** it resolves, not skipped: while it is in flight it is a run like
 * any other, and joiners must share it. Not remembering a failure must not become not deduping one,
 * or a host with no `openspec` on `PATH` spawns a process per concurrent reader.
 */
/**
 * What `key` currently holds, or `undefined` — **without installing anything**.
 *
 * `ttlCached` cannot answer this: asking it is asking it to compute. A caller that has something
 * cheaper than a CLI call to do when there is no current entry needs to find that out without
 * creating one, and creating one is exactly what would make the cheaper path wrong (see
 * `schema-order.ts`, which replays a settled failure only when the bucket has no answer to serve).
 *
 * An expired entry reads as absent and is left in place: dropping it is `ttlCached`'s to do, on the
 * call that replaces it, and a peek that deleted could race a run installed since.
 */
export function peekCached<T>(store: Map<string, CacheEntry<T>>, key: string): Promise<T> | undefined {
  const hit = store.get(key);
  if (!hit || Date.now() - hit.at > CACHE_TTL_MS) return undefined;
  return hit.promise;
}

export function ttlCached<T>(
  store: Map<string, CacheEntry<T>>,
  key: string,
  compute: () => Promise<CliOutcome<T>>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at <= CACHE_TTL_MS) return hit.promise;
  if (hit) store.delete(key);

  const outcome = compute();
  const promise = outcome.then((o) => o.value);
  if (store.size >= CACHE_MAX) {
    const oldest = store.keys().next().value; // Map keeps insertion order
    if (oldest !== undefined) store.delete(oldest);
  }
  const entry: CacheEntry<T> = { at: Date.now(), promise };
  store.set(key, entry);

  // Identity-checked, so an entry installed since — by a caller that arrived after this one was
  // dropped, or after the TTL — is not deleted by this run's late verdict.
  const forget = (): void => {
    if (store.get(key) === entry) store.delete(key);
  };
  // A rejection is forgotten too. A thrown error held for the full lifetime hands every caller in
  // the window the same failure, which is this bug with an exception in place of a value.
  outcome.then((o) => {
    if (!o.remember) forget();
  }, forget);
  return promise;
}

// Stryker restore all
