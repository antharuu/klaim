---
title: "Api"
description: "Reference for the exported `Api` class and its chainable configuration methods."
---

Source: `src/core/Api.ts`

Import path:

```typescript
import { Api } from "klaim";
```

`Api` represents a top-level service definition. You do not instantiate it directly; the public entrypoint is the static `Api.create()` method.

## Signatures

```typescript
class Api extends Element {
  static create(
    name: string,
    url: string,
    callback: IApiCallback,
    headers: IHeaders = {}
  ): Element;
}
```

Inherited chainable methods from `Element`:

```typescript
before(callback: ICallback<ICallbackBeforeArgs>): this
after(callback: ICallback<ICallbackAfterArgs>): this
onCall(callback: ICallback<ICallbackCallArgs>): this
withCache(duration: number = 20): this
withRetry(maxRetries: number = 2): this
withPagination(config: IPaginationConfig = {}): this
withRate(config: Partial<IRateLimitConfig> = {}): this
withTimeout(duration: number = 5, message: string = "Request timed out"): this
```

## `Api.create()`

Creates, registers, and scopes an API declaration. Internally, `src/core/Api.ts` stores the current parent from `Registry`, registers the new API, sets it as the active parent while your callback runs, and restores the previous context afterward.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | API name. It is normalized to camelCase before registration. |
| `url` | `string` | — | Base URL for the API. Leading and trailing slashes are trimmed. |
| `callback` | `() => void` | — | Declaration callback used to register routes or nested groups. |
| `headers` | `Record<string, string>` | `{}` | Default headers merged into every route call under the API. |

Returns: `Element`

Example:

```typescript
import { Api, Route } from "klaim";

Api.create("billing-api", "https://api.example.com", () => {
  Route.get("listInvoices", "/invoices");
});
```

## Chainable Methods

### `withCache(duration?: number)`

Enables response caching for routes under the API. Runtime enforcement happens in `fetchWithRetry()` inside `src/core/Klaim.ts`.

Example:

```typescript
Api.create("catalog", "https://dummyjson.com", () => {
  Route.get("listProducts", "/products");
}).withCache(60);
```

### `withRetry(maxRetries?: number)`

Sets the API-level retry fallback used when a route does not define its own retry count.

Example:

```typescript
Api.create("search", "https://api.example.com", () => {
  Route.get("query", "/search");
}).withRetry(3);
```

### `withRate(config?: Partial<IRateLimitConfig>)`

Sets the API-level rate limit budget. `src/core/Klaim.ts` uses this when the route does not define its own rate config.

Example:

```typescript
Api.create("github", "https://api.github.com", () => {
  Route.get("repos", "/users/[user]/repos");
}).withRate({ limit: 10, duration: 60 });
```

### `withTimeout(duration?: number, message?: string)`

Sets the API-level timeout fallback.

Example:

```typescript
Api.create("slowService", "https://example.com", () => {
  Route.get("data", "/data");
}).withTimeout(2, "Service request timed out");
```

### `onCall(callback)`

Sets the API-level `onCall` callback. `fetchWithRetry()` uses it only when the route does not define its own `onCall`.

Example:

```typescript
Api.create("metrics", "https://example.com", () => {
  Route.get("overview", "/overview");
}).onCall(() => {
  console.log("a metrics route call started");
});
```

### `before(callback)` and `after(callback)`

These methods exist because `Api` inherits them from `Element`, but `callApi()` currently reads only route-level `before` and `after` callbacks. Use them only if you are also copying them to routes yourself or applying them through a group.

Example:

```typescript
const api = Api.create("users", "https://example.com", () => {
  Route.get("list", "/users");
});

api.before(({ route, api, url, config }) => ({ route, api, url, config }));
```

Related pages: [Route](/docs/api-reference/route), [Group](/docs/api-reference/group), [Klaim Runtime](/docs/api-reference/klaim)
