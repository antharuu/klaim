---
title: "Hook"
description: "Reference for the exported `Hook` event helper used to observe completed route calls."
---

Source: `src/core/Hook.ts`

Import path:

```typescript
import { Hook } from "klaim";
```

`Hook` is a simple static event registry keyed by route name. `callApi()` triggers hooks with a string shaped like ``apiName.routeName`` after a route finishes its request lifecycle.

## Signatures

```typescript
class Hook {
  static subscribe(routeName: string, callback: () => any): void;
  static run(routeName: string): void;
  static unsubscribe(routeName: string): void;
  static unsubscribeAll(): void;
}
```

## Methods

### `subscribe(routeName, callback)`

Registers or replaces a callback for a route key.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `routeName` | `string` | — | Route key such as `inventory.listProducts`. |
| `callback` | `() => any` | — | Function to run when the hook is triggered. |

Example:

```typescript
Hook.subscribe("inventory.listProducts", () => {
  console.log("products loaded");
});
```

### `run(routeName)`

Executes the stored callback for a route key if one exists.

### `unsubscribe(routeName)`

Removes one hook callback.

### `unsubscribeAll()`

Clears every hook callback.

## Example With Klaim

```typescript
Api.create("inventory", "https://dummyjson.com", () => {
  Route.get("listProducts", "/products");
});

Hook.subscribe("inventory.listProducts", () => {
  console.log("request completed");
});

await Klaim.inventory.listProducts();
```

## Operational Notes

Hooks are keyed only by one string, and `subscribe()` replaces any previous callback for the same key because `_callbacks` is a `Map<string, IHookCallback>` in `src/core/Hook.ts`. This keeps the implementation small, but it also means `Hook` is not a pub-sub fan-out bus with multiple listeners per event. If you need multiple listeners, wrap them inside one callback or build a thin adapter around `Hook`.

Also note the route key format used by `callApi()` in `src/core/Klaim.ts`: the runtime combines the API name and route name only. That means nested group names are not part of the hook key at execution time. A route such as `Klaim.store.products.list()` still emits `store.list`, not `store.products.list`, because the runtime does not include intermediate group segments in the hook identifier.

Related pages: [Request Lifecycle](/docs/request-lifecycle), [Klaim Runtime](/docs/api-reference/klaim)
