---
title: "Registry"
description: "Reference for the exported `Registry` singleton that stores Klaim declarations and builds the runtime tree."
---

Source: `src/core/Registry.ts`

Import path:

```typescript
import { Registry } from "klaim";
```

`Registry` is the internal data store that keeps every API, group, and route element and mirrors that structure onto `Klaim`. It is exported, so you can use it in tests, debugging tools, or advanced runtime extensions.

## Signatures

```typescript
class Registry {
  static get i(): Registry;

  registerElement(element: IElement): void;
  getCurrentParent(): IElement | null;
  setCurrentParent(fullPath: string): void;
  clearCurrentParent(): void;
  registerRoute(element: IElement): void;
  getElementKey(element: IElement): string;
  getFullPath(element: IElement): string;
  getRoute(apiName: string, routeName: string): IElement | undefined;
  getChildren(elementPath: string): IElement[];
  static updateElement(element: IElement): IElement;
  getApi(name: string): IElement | undefined;
  reset(): void;
}
```

## Core Methods

### `Registry.i`

The singleton instance getter.

Example:

```typescript
const registry = Registry.i;
```

### `getRoute(apiName, routeName)`

Looks up a route by its API name and route name.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `apiName` | `string` | — | API name used in the registry key. |
| `routeName` | `string` | — | Route name used in the registry key. |

Returns: `IElement | undefined`

Example:

```typescript
const route = Registry.i.getRoute("inventory", "listProducts");
```

### `getApi(name)`

Looks up an API by name. If the name is nested under groups, the method searches registry keys that end with `.${name}`.

Returns: `IElement | undefined`

### `getChildren(elementPath)`

Returns every element whose `parent` exactly matches the provided path.

Returns: `IElement[]`

### `reset()`

Clears the internal registry map and deletes every property from the exported `Klaim` object. This is mainly useful in tests.

Example:

```typescript
Registry.i.reset();
```

## Registration Methods

`registerElement()` is used for APIs and groups. `registerRoute()` is used for routes and throws if no current parent is set. These methods are usually called by `Api.create()`, `Group.create()`, and `Route.*()` for you.

Example:

```typescript
Api.create("service", "https://example.com", () => {
  Route.get("health", "/health");
});

console.log(Registry.i.getRoute("service", "health"));
```

## When to Use the Registry Directly

- Inspect declarations in tests
- Attach callbacks after registration
- Clear global state between isolated runs
- Build custom debug tooling around registered elements

Related pages: [Klaim Runtime](/docs/api-reference/klaim), [Hook](/docs/api-reference/hook), [Types](/docs/types)
