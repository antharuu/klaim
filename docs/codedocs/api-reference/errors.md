---
title: "Errors"
description: "Reference for the exported Klaim-specific error classes."
---

Source: `src/core/errors.ts`

Import path:

```typescript
import {
  InvalidPathError,
  KlaimError,
  MissingArgumentError,
  RateLimitError,
  RetryExhaustedError,
  TimeoutError,
} from "klaim";
```

Klaim exports a small error hierarchy so callers can catch specific operational failures.

## Signatures

```typescript
class KlaimError extends Error {
  constructor(message: string);
}

class RateLimitError extends KlaimError {
  readonly retryAfterMs: number;
  constructor(message: string, retryAfterMs: number);
}

class TimeoutError extends KlaimError {
  constructor(message: string);
}

class RetryExhaustedError extends KlaimError {
  readonly attempts: number;
  readonly cause: Error | undefined;
  constructor(message: string, attempts: number, cause?: Error);
}

class MissingArgumentError extends KlaimError {
  readonly argument: string;
  constructor(argument: string);
}

class InvalidPathError extends KlaimError {
  constructor(path: string);
}
```

## Error Classes

### `KlaimError`

Base class for every library-specific error.

### `RateLimitError`

Thrown by `fetchWithRetry()` when `checkRateLimit()` denies a request. The `retryAfterMs` property tells you when the next request should be allowed.

### `TimeoutError`

Thrown by `withTimeout()` from `src/tools/timeout.ts` when the configured duration expires before the request completes.

### `RetryExhaustedError`

Thrown by `fetchWithRetry()` after all attempts have failed. `attempts` contains the final attempt count and `cause` stores the last underlying error when available.

### `MissingArgumentError`

Thrown by `applyArgs()` when a route path contains a required `[param]` but the caller did not supply it in `args`.

### `InvalidPathError`

Thrown by `callApi()` when it cannot resolve a valid route and owning API combination for the requested path.

## Example

```typescript
try {
  await Klaim.pokemon.list(0);
} catch (error) {
  if (error instanceof MissingArgumentError) {
    console.error(error.argument);
  }

  if (error instanceof RateLimitError) {
    console.error(error.retryAfterMs);
  }
}
```

## Practical Guidance

These error classes are most useful when you let Klaim’s runtime controls do the work and then branch on the result. For example, `TimeoutError` and `RateLimitError` are usually recoverable at the UI or job-runner layer, while `InvalidPathError` and `MissingArgumentError` usually indicate a programming mistake that should be fixed rather than retried. `RetryExhaustedError` sits between those two categories because it wraps an operational failure but also preserves the final underlying `cause`.

Because every custom error extends `KlaimError`, you can also catch the whole family when you want library-specific fallback behavior:

```typescript
try {
  await Klaim.inventory.listProducts();
} catch (error) {
  if (error instanceof KlaimError) {
    console.error("klaim runtime failure", error.message);
  }
}
```

Related pages: [Resilience and Control](/docs/resilience-and-control), [Klaim Runtime](/docs/api-reference/klaim)
