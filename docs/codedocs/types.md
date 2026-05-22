---
title: "Types"
description: "Reference for the TypeScript types and interfaces exported by Klaim."
---

Import path:

```typescript
import type {
  IArgs,
  IBody,
  ICallbackAfterArgs,
  ICallbackBeforeArgs,
  ICallbackCallArgs,
  IElement,
  IHeaders,
  IPaginationConfig,
  IRateLimitConfig,
  ITimeoutConfig,
} from "klaim";
```

Klaim exports a small but important set of types. Most of them come from `src/core/Element.ts`, plus request argument types from `src/core/Klaim.ts` and runtime control types from `src/tools`.

## `IHeaders`

Source: `src/core/Element.ts`

```typescript
export type IHeaders = Record<string, string>;
```

Use this for API-level or route-level header maps.

## `IPaginationConfig`

Source: `src/core/Element.ts`

```typescript
export interface IPaginationConfig {
  page?: number;
  pageParam?: string;
  limit?: number;
  limitParam?: string;
}
```

Field meanings:

- `page`: default starting page number stored on the route configuration
- `pageParam`: query parameter name used for the page or offset value
- `limit`: page size appended by `callApi()`
- `limitParam`: query parameter name used for the page size

## `ICallbackBeforeArgs`

Source: `src/core/Element.ts`

```typescript
export interface ICallbackBeforeArgs {
  route: IElement;
  api: IElement;
  url: string;
  config: Record<string, unknown>;
}
```

This is the argument object passed to route-level `before()` callbacks.

## `ICallbackAfterArgs`

Source: `src/core/Element.ts`

```typescript
export interface ICallbackAfterArgs {
  route: IElement;
  api: IElement;
  response: unknown;
  data: unknown;
}
```

This is the argument object passed to route-level `after()` callbacks.

## `ICallbackCallArgs`

Source: `src/core/Element.ts`

```typescript
export type ICallbackCallArgs = object;
```

This is the argument type for `onCall()`. In the current implementation, `fetchWithRetry()` invokes it with an empty object.

## `IElement`

Source: `src/core/Element.ts`

```typescript
export interface IElement {
  type: "api" | "route" | "group";
  name: string;
  url: string;
  headers: IHeaders;
  callbacks: {
    before: ((args: ICallbackBeforeArgs) => Partial<ICallbackBeforeArgs> | void) | null;
    after: ((args: ICallbackAfterArgs) => Partial<ICallbackAfterArgs> | void) | null;
    call: ((args: ICallbackCallArgs) => Partial<ICallbackCallArgs> | void) | null;
  };
  cache: false | number;
  retry: false | number;
  rate: false | IRateLimitConfig;
  timeout: false | ITimeoutConfig;
  parent?: string;
  method?: string;
  arguments: Set<string>;
  schema?: { validate: (data: unknown) => Promise<unknown> };
  pagination?: IPaginationConfig;

  before(callback: (args: ICallbackBeforeArgs) => Partial<ICallbackBeforeArgs> | void): this;
  after(callback: (args: ICallbackAfterArgs) => Partial<ICallbackAfterArgs> | void): this;
  onCall(callback: (args: ICallbackCallArgs) => Partial<ICallbackCallArgs> | void): this;
  withCache(duration?: number): this;
  withRetry(maxRetries?: number): this;
  withPagination(config?: IPaginationConfig): this;
  withRate(config?: Partial<IRateLimitConfig>): this;
  withTimeout(duration?: number, message?: string): this;
}
```

`IElement` is the shared model for APIs, routes, and groups. It is most useful when you work directly with `Registry`.

## `IArgs` and `IBody`

Source: `src/core/Klaim.ts`

```typescript
export type IArgs = Record<string, unknown>;
export type IBody = Record<string, unknown>;
```

- `IArgs` is the record used to fill `[param]` placeholders in route paths.
- `IBody` is the record JSON-stringified into the request body for non-GET requests.

## `IRateLimitConfig`

Source: `src/tools/rateLimit.ts`

```typescript
export interface IRateLimitConfig {
  limit: number;
  duration: number;
}
```

Field meanings:

- `limit`: max allowed requests in the window
- `duration`: window size in seconds

## `ITimeoutConfig`

Source: `src/tools/timeout.ts`

```typescript
export interface ITimeoutConfig {
  duration: number;
  message: string;
}
```

Field meanings:

- `duration`: timeout in seconds
- `message`: error message used for `TimeoutError`

## Example

```typescript
import type { IArgs, IRateLimitConfig, ITimeoutConfig } from "klaim";

const routeArgs: IArgs = { id: 1 };
const rate: IRateLimitConfig = { limit: 5, duration: 10 };
const timeout: ITimeoutConfig = { duration: 2, message: "Too slow" };
```

Related pages: [Route](/docs/api-reference/route), [Api](/docs/api-reference/api), [Registry](/docs/api-reference/registry)
