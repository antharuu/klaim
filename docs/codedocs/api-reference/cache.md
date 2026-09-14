---
title: "Cache"
description: "Reference for the exported in-memory `Cache` singleton used by Klaim's cached fetch path."
---

Source: `src/core/Cache.ts`

Import path:

```typescript
import { Cache } from "klaim";
```

`Cache` is a singleton in-memory store with TTL expiration and LRU-style eviction. Klaim uses it through `src/tools/fetchWithCache.ts` when caching is enabled.

## Signatures

```typescript
class Cache {
  static get i(): Cache;
  set(key: string, value: unknown, ttl: number = 0): void;
  has(key: string): boolean;
  get(key: string): unknown | null;
  clear(): void;
  get size(): number;
}
```

## Methods

### `Cache.i`

Returns the singleton cache instance.

### `set(key, value, ttl?)`

Stores a value in the cache. A `ttl` of `0` means the cache entry does not expire.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `key` | `string` | — | Cache key. Klaim derives this from route path, TTL, policy, URL, and fetch config excluding signal. |
| `value` | `unknown` | — | Value to store. |
| `ttl` | `number` | `0` | Time to live in milliseconds. |

Example:

```typescript
Cache.i.set("user:1", { id: 1, name: "Ada" }, 60_000);
```

### `has(key)`

Checks whether a non-expired cache entry exists. Expired entries are removed on access.

### `get(key)`

Returns cached data or `null`. When an entry is returned, the underlying map entry is moved to the end to behave like an LRU cache.

### `clear()`

Removes every cached entry.

### `size`

Returns the current number of entries stored in memory.

## Example With Klaim

```typescript
Api.create("catalog", "https://dummyjson.com", () => {
  Route.get("listProducts", "/products");
}).withCache(60);

await Klaim.catalog.listProducts();
console.log(Cache.i.size);
```

## Implementation Notes

### Klaim durations and identity

`withCache()` means 20 **seconds**, while `Cache.i.set()` takes **milliseconds**. Requests capture `route.cache || api.cache` after `before` and before retries, without modifying either element. A falsy route value (`false`, `0`, `-0`, `NaN`) allows API fallback; two falsy values bypass the cache altogether. In particular, `withCache(0)` does not disable an API cache and does not mean the same thing as `Cache.i.set(key, value, 0)`.

Positive fractional seconds are converted once without rounding. Negative values, infinities, and multiplication overflow remain unbounded. TTL begins on insertion after decoding. An entry remains valid at `now === expiry`, expires at `now > expiry`, and reads do not refresh its TTL. Concurrent misses are not coalesced: each fetches independently, and the last successful insertion wins within a key. LRU eviction and `clear()` are unchanged.

Klaim calls `src/tools/fetchWithCache.ts` with options containing a captured route namespace (`parent + "." + route.name`), a millisecond TTL, and `route.responsePolicy ?? api.responsePolicy ?? "legacy"`. Its key is:

```typescript
hashStr(JSON.stringify([
  "klaim-cache-v2", namespace, ttlKey, policy,
  input.toString(), JSON.stringify(initSansSignal)
]));
```

`ttlKey` is the positive finite millisecond TTL, otherwise `"unbounded"`. `initSansSignal` excludes only `signal`; the original init, including signal, is still sent to fetch. All other serialization behavior is retained (including property order and the limitations of `input.toString()`/`JSON.stringify`); this is not a canonical HTTP request identity. Changing the route path, effective TTL, policy, or serialized request config produces separate entries. Different unbounded durations share the same TTL marker.

### Internal helper compatibility

The helper accepts `ttlOrOptions?: number | FetchCacheOptions`, where options have `ttl?: number`, `namespace?: string`, `policy?: "legacy" | "http"`, and reserved `assertActive?: () => void`. A numeric TTL or absent third argument keeps the historical key `hashStr(input.toString() + JSON.stringify(init))` and millisecond behavior. Options without a namespace also keep that historical key, including absent init and signal serialization. Any explicitly defined namespace (even `""`) selects v2. Policy currently partitions v2 entries only; HTTP decoding and the terminal guard are separate follow-up work, not activated by this TTL change.

Compatibility note: this correction makes route TTLs expire and fixes API durations previously treated as milliseconds. Applications that compensated for those bugs should remove their workaround. Memory keys change and URL-identical aliases stop sharing entries; nothing is persisted or migrated.

The cache is process-local and memory-backed. It is useful for reducing duplicate requests inside one runtime, but it is not a distributed cache and it is not persisted across restarts. If you need cross-process consistency, you should treat Klaim’s cache as a local optimization layer and keep the authoritative cache somewhere else.

Related pages: [Resilience and Control](/docs/resilience-and-control), [Api](/docs/api-reference/api), [Route](/docs/api-reference/route)
