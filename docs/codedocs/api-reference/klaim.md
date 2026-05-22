---
title: "Klaim Runtime"
description: "Reference for the exported `Klaim` runtime object and the dynamic route call shapes it exposes."
---

Source: `src/core/Klaim.ts`

Import path:

```typescript
import { Klaim } from "klaim";
```

`Klaim` is the exported runtime object that receives APIs, groups, and route functions as you register them.

## Signature

```typescript
export const Klaim: IApiReference = {};
```

Supporting exported types from the same source file:

```typescript
export type IArgs = Record<string, unknown>;
export type IBody = Record<string, unknown>;
```

Internally, route handlers are created with these shapes:

```typescript
type RouteFunction<T = any> = {
  (offset?: number, args?: IArgs, body?: IBody): Promise<T>;
};
```

That `RouteFunction` type is not exported from the package root, but it explains how generated route functions behave.

## How Calls Work

For non-paginated routes:

```typescript
await Klaim.api.route<T>(args?, body?);
```

For paginated routes:

```typescript
await Klaim.api.route<T>(offset?, args?, body?);
```

`createRouteHandler()` decides which call form to use by checking `element.pagination`.

## Common Patterns

### Basic route call

```typescript
Api.create("todos", "https://jsonplaceholder.typicode.com", () => {
  Route.get("getOne", "/todos/[id]");
});

const todo = await Klaim.todos.getOne({ id: 1 });
```

### Route call with body

```typescript
Api.create("posts", "https://jsonplaceholder.typicode.com", () => {
  Route.post("create", "/posts");
});

const created = await Klaim.posts.create(
  {},
  { title: "Hello", body: "From Klaim", userId: 1 }
);
```

### Paginated route call

```typescript
Api.create("pokemon", "https://pokeapi.co/api/v2", () => {
  Route.get("list", "/pokemon").withPagination({
    pageParam: "offset",
    limitParam: "limit",
    limit: 5,
  });
});

const firstPage = await Klaim.pokemon.list(0);
const secondPage = await Klaim.pokemon.list(5);
```

## Notes on Dynamic Structure

`Klaim` starts as an empty object. `Registry.registerElement()` adds nested objects for APIs and groups, and `Registry.addToKlaimRoute()` writes route functions into the correct nested location.

That means:

- The object shape is determined entirely by registration order and names.
- `Registry.reset()` can clear the object back to empty.
- Property names are normalized to camelCase during registration.

Related pages: [Registry](/docs/api-reference/registry), [Request Lifecycle](/docs/request-lifecycle), [Api](/docs/api-reference/api)
