/**
 * How long the `openspec` CLI is allowed to take.
 *
 * Its own module, and its own export subpath, because the CLI is spawned by a host while the client
 * waiting on it is often a browser bundle with a timeout of its own — and that client cannot import
 * `openspec-cli.ts` without pulling in `child_process`.
 */

/** How long a single CLI invocation gets before it is killed. */
export const CLI_TIMEOUT_MS = 10_000;

/**
 * How long a cached CLI answer stays fresh. Must exceed `CLI_TIMEOUT_MS`, or an entry can be judged
 * stale while the call filling it is still running and a second one starts alongside it. No cached
 * operation chains CLI calls, so one timeout is the whole worst case.
 */
export const CLI_CACHE_TTL_MS = 30_000;
