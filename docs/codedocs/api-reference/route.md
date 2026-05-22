---
title: "Route"
description: "Reference for the exported `Route` class, HTTP helpers, and validation support."
---

Source: `src/core/Route.ts`

Import path:

```typescript
import { Route } from "klaim";
```

`Route` defines one endpoint inside an API or group context. It carries the HTTP method, path, header overrides, detected path arguments, and optional runtime controls such as validation, retry, and timeout.

## Signatures

```typescript
class Route extends Element {
  constructor(
    name: string,
    url: string,
    headers: IHeaders = {},
    method: RouteMethod = RouteMethod.GET
  );

  static get(name: string, url: string, headers: IHeaders = {}): Element;
  static post(name: string, url: string, headers: IHeaders = {}): Element;
  static put(name: string, url: string, headers: IHeaders = {}): Element;
  static delete(name: string, url: string, headers: IHeaders = {}): Element;
  static patch(name: string, url: string, headers: IHeaders = {}): Element;
  static options(name: string, url: string, headers: IHeaders = {}): Element;

  validate(schema: { validate: (data: unknown) => Promise<unknown> }): Element;
}
```

Inherited chainable methods:

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

## Constructor

Most users should prefer the static helpers because they register routes automatically, but the public constructor exists.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `string` | — | Route name, normalized to camelCase by `Element`. |
| `url` | `string` | — | Route path fragment, scanned for `[param]` placeholders. |
| `headers` | `Record<string, string>` | `{}` | Route-level header overrides. |
| `method` | `RouteMethod` | `GET` | HTTP method stored on the route element. |

Returns: `Route`

## Static Route Helpers

All six helpers call the same private `createRoute()` function and differ only by the HTTP method they assign.

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `Route.get(name, url, headers?)` | Register a GET route. |
| `post` | `Route.post(name, url, headers?)` | Register a POST route. |
| `put` | `Route.put(name, url, headers?)` | Register a PUT route. |
| `delete` | `Route.delete(name, url, headers?)` | Register a DELETE route. |
| `patch` | `Route.patch(name, url, headers?)` | Register a PATCH route. |
| `options` | `Route.options(name, url, headers?)` | Register an OPTIONS route. |

Example:

```typescript
Api.create("users", "https://example.com", () => {
  Route.get("list", "/users");
  Route.get("getOne", "/users/[id]");
  Route.post("create", "/users", { Authorization: "Bearer token" });
});
```

## `validate(schema)`

Adds a response validator. The schema object only needs a `validate()` method that returns a promise, which is why Yup works out of the box in the tests.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `schema` | `{ validate: (data: unknown) => Promise<unknown> }` | — | Async validation or coercion schema. |

Returns: `Element`

Example:

```typescript
import * as yup from "yup";

const schema = yup.object({
  id: yup.number().required(),
  title: yup.string().required(),
});

Api.create("posts", "https://jsonplaceholder.typicode.com", () => {
  Route.get("getOne", "/posts/[id]").validate(schema);
});
```

## Runtime Controls

### `before(callback)` and `after(callback)`

These hooks are executed directly by `applyBefore()` and `applyAfter()` in `src/core/Klaim.ts`.

Example:

```typescript
Route.get("profile", "/me").before(({ route, api, url, config }) => {
  return {
    route,
    api,
    url,
    config: {
      ...config,
      headers: {
        ...(config.headers as Record<string, string>),
        Authorization: `Bearer ${token}`,
      },
    },
  };
});
```

### `withPagination(config?)`

Marks the route as paginated. The generated route handler then expects the first argument to be the page or offset number.

Example:

```typescript
Route.get("list", "/pokemon").withPagination({
  pageParam: "offset",
  limitParam: "limit",
  limit: 20,
});
```

### `withRate(config?)`, `withRetry(maxRetries?)`, `withTimeout(duration?, message?)`, `withCache(duration?)`

These settings are enforced inside `fetchWithRetry()` and `fetchWithCache()`.

Example:

```typescript
Route.get("expensive", "/reports/[id]")
  .withRate({ limit: 2, duration: 60 })
  .withRetry(1)
  .withTimeout(5)
  .withCache(120);
```

Related pages: [Api](/docs/api-reference/api), [Klaim Runtime](/docs/api-reference/klaim), [Types](/docs/types)
