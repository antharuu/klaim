---
title: "Advanced Runtime Patterns"
description: "Combine retries, timeouts, hooks, and route middleware for a more production-oriented client."
---

This guide focuses on the features that matter once you move past a basic demo: retries, timeout boundaries, route instrumentation, and response shaping.

## Problem

You need a client that can survive transient failures, expose useful lifecycle hooks, and normalize responses before the rest of your application sees them.

## Solution

Put shared reliability settings on the API, add route-level overrides where needed, and use `Hook` plus `before` and `after` callbacks for instrumentation and normalization.

<Steps>
<Step>
### Create an API with shared runtime defaults

```typescript
import { Api, Route } from "klaim";

Api.create("inventory", "https://dummyjson.com", () => {
  Route.get("listProducts", "/products");
  Route.get("getProduct", "/products/[id]").withTimeout(1);
}).withRetry(2).withRate({ limit: 10, duration: 30 });
```

</Step>
<Step>
### Add route-level middleware and route hooks

```typescript
import { Hook, Registry } from "klaim";

const productRoute = Registry.i.getRoute("inventory", "listProducts");

productRoute?.before(({ route, api, url, config }) => {
  console.log("calling", url);
  return { route, api, url, config };
});

productRoute?.after(({ route, api, response, data }) => {
  const payload = data as { products: unknown[] };
  return {
    route,
    api,
    response,
    data: payload.products,
  };
});

Hook.subscribe("inventory.listProducts", () => {
  console.log("inventory.listProducts completed");
});
```

</Step>
<Step>
### Call the route and handle operational errors

```typescript
import { Klaim, RateLimitError, RetryExhaustedError, TimeoutError } from "klaim";

async function loadProducts() {
  try {
    return await Klaim.inventory.listProducts();
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error("Timeout:", error.message);
      return [];
    }

    if (error instanceof RateLimitError) {
      console.error("Retry after ms:", error.retryAfterMs);
      return [];
    }

    if (error instanceof RetryExhaustedError) {
      console.error("Attempts:", error.attempts);
      throw error.cause ?? error;
    }

    throw error;
  }
}
```

</Step>
</Steps>

## Complete Example

```typescript
import {
  Api,
  Hook,
  Klaim,
  RateLimitError,
  Registry,
  RetryExhaustedError,
  Route,
  TimeoutError,
} from "klaim";

Api.create("inventory", "https://dummyjson.com", () => {
  Route.get("listProducts", "/products");
  Route.get("getProduct", "/products/[id]").withTimeout(1.5, "Product lookup timed out");
}).withRetry(2).withRate({ limit: 8, duration: 30 });

Registry.i.getRoute("inventory", "listProducts")?.after(({ route, api, response, data }) => {
  const payload = data as { products: Array<{ id: number; title: string }> };
  return {
    route,
    api,
    response,
    data: payload.products.map((item) => ({
      id: item.id,
      title: item.title,
    })),
  };
});

Hook.subscribe("inventory.listProducts", () => {
  console.log("products loaded");
});

async function main() {
  try {
    const products = await Klaim.inventory.listProducts<Array<{ id: number; title: string }>>();
    console.log(products.slice(0, 3));
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error(error.message);
      return;
    }
    if (error instanceof RateLimitError) {
      console.error(`wait ${error.retryAfterMs}ms`);
      return;
    }
    if (error instanceof RetryExhaustedError) {
      console.error(`failed after ${error.attempts} attempts`);
      return;
    }
    throw error;
  }
}

main();
```

This pattern keeps route behavior close to the place where it matters while still benefiting from API-level defaults.
