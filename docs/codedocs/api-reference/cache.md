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
| `key` | `string` | — | Cache key. Klaim derives this from URL plus fetch config. |
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

`src/tools/fetchWithCache.ts` computes a cache key by hashing `input.toString()` plus `JSON.stringify(init)` with the helper from `src/tools/hashStr.ts`. That means two otherwise identical requests with different headers or bodies will get different cache entries, which is usually the right behavior for HTTP client caching inside an application process.

The cache is process-local and memory-backed. It is useful for reducing duplicate requests inside one runtime, but it is not a distributed cache and it is not persisted across restarts. If you need cross-process consistency, you should treat Klaim’s cache as a local optimization layer and keep the authoritative cache somewhere else.

Related pages: [Resilience and Control](/docs/resilience-and-control), [Api](/docs/api-reference/api), [Route](/docs/api-reference/route)
