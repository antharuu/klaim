---
title: "Request Lifecycle"
description: "Follow a Klaim route call from `Klaim.api.route()` to fetch, validation, and hooks."
---

Once a route has been registered, every real request goes through the lifecycle implemented in `src/core/Klaim.ts`. Understanding that file is the key to understanding Klaim’s runtime behavior.

## What This Concept Is

The request lifecycle is the ordered pipeline that starts when you call a route function on `Klaim` and ends when data is returned or an error is thrown. In Klaim, that pipeline is centered on two functions:

- `createRouteHandler()` decides how arguments are interpreted.
- `callApi()` performs the actual request work.

This lifecycle matters because configuration in Klaim is not just metadata. It directly changes URL construction, fetch config, retries, timeout enforcement, validation, and the final returned value.

## Internal Walkthrough

The lifecycle in `callApi()` from `src/core/Klaim.ts` is:

1. Resolve the owning API by scanning the route’s parent path with `Registry.i.getApi()`.
2. Combine `api.url` and `route.url`.
3. Replace bracket parameters through `applyArgs()`.
4. Add pagination query parameters if `route.pagination` exists.
5. Build a JSON fetch config with merged API and route headers.
6. Run `applyBefore()`.
7. Execute `fetchWithRetry()`.
8. Run schema validation if `route.schema` exists.
9. Run `applyAfter()`.
10. Trigger `Hook.run()` with the route key.

```mermaid
flowchart TD
  A[Klaim.api.route(...)] --> B[createRouteHandler]
  B --> C[callApi]
  C --> D[Registry.getApi]
  D --> E[applyArgs]
  E --> F{pagination enabled?}
  F -->|yes| G[append query params]
  F -->|no| H[skip]
  G --> I[build fetch config]
  H --> I
  I --> J[route before callback]
  J --> K[fetchWithRetry]
  K --> L[schema.validate]
  L --> M[route after callback]
  M --> N[Hook.run]
  N --> O[return data]
```

The fetch config defaults are simple and predictable:

- `Content-Type: application/json` is always added first.
- API headers are merged next.
- Route headers are merged last, so route headers win on collisions.
- A body is only attached when the route method is not `GET`.

## Basic Usage

A `before` callback can mutate the URL or config before the network call:

```typescript
import { Api, Klaim, Route } from "klaim";

Api.create("users", "https://jsonplaceholder.typicode.com", () => {
  Route.get("list", "/users").before(({ config, url, route, api }) => {
    return {
      route,
      api,
      url: `${url}?active=true`,
      config: {
        ...config,
        headers: {
          ...(config.headers as Record<string, string>),
          "X-Debug": "1",
        },
      },
    };
  });
});

const activeUsers = await Klaim.users.list();
```

## Advanced Usage

An `after` callback can reshape response data before it reaches the caller:

```typescript
import { Api, Klaim, Route } from "klaim";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

Api.create("todos", "https://jsonplaceholder.typicode.com", () => {
  Route.get("list", "/todos").after(({ route, api, response, data }) => {
    const todos = data as Todo[];
    return {
      route,
      api,
      response,
      data: todos.filter((todo) => todo.completed),
    };
  });
});

const completed = await Klaim.todos.list<Todo[]>();
```

## How It Relates to Other Concepts

- [APIs and Routes](/docs/api-and-routes) explains how the callable function gets created.
- [Groups and Hierarchy](/docs/groups-and-hierarchy) explains how nested routes still resolve their API owner.
- [Resilience and Control](/docs/resilience-and-control) covers the retry, timeout, rate limit, validation, cache, and pagination steps in more detail.

<Callout type="warn">Klaim stores only one `before`, one `after`, and one `onCall` callback per element. In `src/core/Klaim.ts`, `applyBefore()` and `applyAfter()` read only `route.callbacks.before` and `route.callbacks.after`; they do not combine route and API callbacks. API-level `onCall` does run as a fallback inside `fetchWithRetry()`, but API-level `before` and `after` are not part of the request path unless a group copied them onto child routes.</Callout>

<Accordions>
<Accordion title="Why does Klaim use mutable callback return objects?">
The callback APIs accept and optionally return the same structural objects used during request execution: `route`, `api`, `url`, `config`, `response`, and `data`. That keeps the implementation in `applyBefore()` and `applyAfter()` compact because it only needs to replace whichever values the callback returned. The benefit is flexibility: one callback can rewrite headers, swap the URL, or normalize response data without extra helpers. The cost is that callback authors need to be disciplined about preserving values they do not intend to change, which is why the examples above explicitly return `route` and `api` alongside their edits.
</Accordion>
<Accordion title="Why is validation placed after fetch but before the after-callback?">
`callApi()` validates the parsed response immediately after `fetchWithRetry()` and before `applyAfter()`. That makes sense when validation is treated as a contract check for raw remote data, because you learn whether the service responded correctly before any local response shaping happens. The trade-off is that an `after` callback cannot rescue invalid data by transforming it first. If you need coercion before validation, use a schema tool whose `validate()` step performs coercion itself, as shown in the Yup tests from `tests/07.validate.test.ts`.
</Accordion>
</Accordions>

See [API Reference for `Klaim`](/docs/api-reference/klaim) for the exact callable shapes produced by `createRouteHandler()`.
