---
title: "Group"
description: "Reference for the exported `Group` class and its propagation-based configuration helpers."
---

Source: `src/core/Group.ts`

Import path:

```typescript
import { Group } from "klaim";
```

`Group` creates a namespace layer in the registry and, for some settings, copies configuration into already-registered children.

## Signatures

```typescript
class Group extends Element {
  static create(name: string, callback: () => void): Element;

  withCache(duration = 20): this;
  withRetry(maxRetries = 2): this;
  withTimeout(duration = 5, message = "Request timed out"): this;
  before(callback: ICallback<ICallbackBeforeArgs>): this;
  after(callback: ICallback<ICallbackAfterArgs>): this;
  onCall(callback: ICallback<ICallbackCallArgs>): this;
}
```

Inherited but not overridden:

```typescript
withPagination(config: IPaginationConfig = {}): this
withRate(config: Partial<IRateLimitConfig> = {}): this
```

## `Group.create()`

Registers a group under the current parent and executes your callback inside that namespace.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Group name, normalized to camelCase. |
| `callback` | `() => void` | — | Declaration callback for nested APIs, groups, or routes. |

Returns: `Element`

Example:

```typescript
Api.create("shop", "https://dummyjson.com", () => {
  Group.create("products", () => {
    Route.get("list", "/products");
  });
});
```

## Propagating Methods

### `withCache(duration?)`

Copies cache settings to children that do not already define a cache value.

### `withRetry(maxRetries?)`

Copies retry settings to children that do not already define retry.

### `withTimeout(duration?, message?)`

Copies timeout settings to children that do not already define timeout.

### `before(callback)`, `after(callback)`, `onCall(callback)`

Copies callbacks to children that do not already define those callback slots.

Example:

```typescript
Api.create("shop", "https://dummyjson.com", () => {
  Group.create("products", () => {
    Route.get("list", "/products");
    Route.get("getOne", "/products/[id]");
  })
    .withRetry(2)
    .before(({ route, api, url, config }) => ({ route, api, url, config }));
});
```

## Inherited Methods That Need Caution

`Group` inherits `withRate()` and `withPagination()` from `Element`, but `src/core/Group.ts` does not override them and `src/core/Klaim.ts` only reads route pagination plus route or API rate limits. As a result, those inherited methods do not currently have the same practical effect as the explicitly propagated methods above.

Example:

```typescript
const group = Group.create("products", () => {
  Route.get("list", "/products");
});

group.withRate({ limit: 5, duration: 10 });
group.withPagination({ page: 1, limit: 20 });
```

The code above is valid TypeScript because the methods exist on `Element`, but the current runtime does not consume those values at the group level.

Related pages: [Groups and Hierarchy](/docs/groups-and-hierarchy), [Api](/docs/api-reference/api), [Route](/docs/api-reference/route)
