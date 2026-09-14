/**
 * In-flight request coalescing (a.k.a. request deduplication).
 *
 * When several callers trigger the exact same idempotent request (same
 * route, same URL, same params) while a first call for that key is still
 * pending, the extra callers are handed the very same {@link Promise}
 * instead of firing a redundant network call. This is only ever safe for
 * side-effect-free requests: mutating methods (POST/PUT/PATCH/DELETE) must
 * never be coalesced, since replaying/sharing them could silently drop a
 * write or double-apply one from the caller's point of view.
 *
 * The tracking {@link Map} only ever holds *pending* promises: as soon as a
 * tracked promise settles (fulfilled or rejected), its entry is removed so
 * that the next call for that key performs a fresh request. This guarantees
 * a failure never sticks around and permanently blocks subsequent attempts.
 */

/** Registry of in-flight promises, keyed by a caller-provided dedup key. */
const inFlightRequests: Map<string, Promise<unknown>> = new Map();

/**
 * Coalesces concurrent calls sharing the same key into a single execution.
 *
 * If a request for `key` is already in flight, its pending promise is
 * returned as-is to the caller (no new invocation of `run`). Otherwise
 * `run` is invoked once, its promise is tracked under `key`, and the entry
 * is removed the moment it settles - whether it resolves or rejects - so a
 * failed request never leaves the key permanently stuck.
 *
 * @template T - The type of value produced by the deduplicated operation
 * @param key - Unique identifier for the logical request (route + resolved URL/params)
 * @param run - Factory invoked at most once per in-flight window to perform the actual request
 * @returns Promise resolving/rejecting exactly like the single underlying call
 * @example
 * ```typescript
 * // Two concurrent identical GETs share one network call
 * const [a, b] = await Promise.all([
 *   dedupe("api.users:/users?id=1", () => fetch("/users?id=1")),
 *   dedupe("api.users:/users?id=1", () => fetch("/users?id=1"))
 * ]);
 * ```
 */
export function dedupe<T> (key: string, run: () => Promise<T>): Promise<T> {
    const existing = inFlightRequests.get(key);
    if (existing) {
        return existing as Promise<T>;
    }

    const promise = run().finally(() => {
        // Only ever clears our own entry; a newer request may have already
        // replaced it under the same key once this one settled.
        if (inFlightRequests.get(key) === promise) {
            inFlightRequests.delete(key);
        }
    });

    inFlightRequests.set(key, promise);
    return promise;
}

/**
 * Removes all tracked in-flight entries.
 *
 * Intended for test isolation between suites; not meant to be called from
 * application code, since it would let genuinely in-flight requests be
 * re-issued by subsequent callers.
 */
export function clearInFlightRequests (): void {
    inFlightRequests.clear();
}
