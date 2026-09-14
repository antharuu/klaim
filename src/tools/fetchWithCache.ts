import { Cache } from "../core/Cache";

import hashStr from "./hashStr";

/** Options for cached fetches. Durations are in milliseconds. */
export interface FetchCacheOptions {
    ttl?: number;
    namespace?: string;
    /** Cache identity only; HTTP decoding is implemented separately. */
    policy?: "legacy" | "http";
    /** Throws the runner's memorized terminal error; absent is a no-op. */
    assertActive?: () => void;
    /** Invoked synchronously when the response is served from cache instead of fetched. */
    onHit?: () => void;
}

/**
 * Fetch with cache
 *
 * @param input - The input
 * @param init - The init
 * @param ttlOrOptions - TTL in milliseconds or options; an explicit namespace selects v2 keys
 * @returns The parsed response data
 */
export default async function (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
    ttlOrOptions?: number | FetchCacheOptions
): Promise<unknown> {
    const options = typeof ttlOrOptions === "object" ? ttlOrOptions : undefined;
    const assertActive = options?.assertActive;
    assertActive?.();
    const ttl = typeof ttlOrOptions === "number" ? ttlOrOptions : options?.ttl;
    let baseString: string;
    if (options?.namespace !== undefined) {
        const initSansSignal = init === undefined ? undefined : { ...init };
        if (initSansSignal) delete initSansSignal.signal;
        const ttlKey = ttl !== undefined && ttl > 0 && Number.isFinite(ttl) ? ttl : "unbounded";
        baseString = JSON.stringify([
            "klaim-cache-v2",
            options.namespace,
            ttlKey,
            options.policy ?? "legacy",
            input.toString(),
            JSON.stringify(initSansSignal)
        ]);
    } else {
        // Preserve the historical key, including absent init and any signal.
        baseString = `${input.toString()}${JSON.stringify(init)}`;
    }
    const cacheKey = hashStr(baseString);

    if (Cache.i.has(cacheKey)) {
        assertActive?.();
        options?.onHit?.();
        return Cache.i.get(cacheKey);
    }

    assertActive?.();
    const response = await fetch(input, init);
    assertActive?.();
    const data: unknown = await response.json();

    assertActive?.();
    Cache.i.set(cacheKey, data, ttl);
    return data;
}
