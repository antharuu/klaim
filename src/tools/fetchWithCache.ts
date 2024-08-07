import { Cache } from "../core/Cache";

import hashStr from "./hashStr";

/**
 * Fetch with cache
 *
 * @param input - The input
 * @param init - The init
 * @param ttl - The time to live
 * @returns The response
 */
export default async function (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
    ttl?: number
): Promise<Response> {
    const baseString = `${input.toString()}${JSON.stringify(init)}`;
    const cacheKey = hashStr(baseString);

    if (Cache.i.has(cacheKey)) {
        return Cache.i.get(cacheKey);
    }

    const response = await fetch(input, init);
    const data = await response.json();

    Cache.i.set(cacheKey, data, ttl);
    return data;
}
