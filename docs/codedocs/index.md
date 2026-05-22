---
title: "Getting Started"
description: "Learn what Klaim does, why it exists, and how to define your first callable API client."
---

Klaim is a lightweight TypeScript library for declaring APIs as a typed object tree and calling them through a shared runtime.

## The Problem

- Repeating `fetch()` setup across routes makes headers, retry policy, and timeout rules drift over time.
- Stringly-typed endpoint paths such as `"/users/" + id` make missing parameters and malformed URLs easy to ship.
- Shared concerns like caching, validation, and rate limiting usually end up scattered across wrappers, hooks, and ad hoc helpers.
- Large integrations get hard to navigate when there is no single runtime object showing every API, route, and group in one place.

## The Solution

Klaim lets you declare APIs, routes, and route groups once, then exposes them on the global `Klaim` object as callable functions. Internally, `src/core/Registry.ts` records each declaration, `src/core/Klaim.ts` turns routes into functions, and `src/core/Element.ts` carries shared settings such as cache, retry, timeout, and pagination.

```typescript
import { Api, Klaim, Route } from "klaim";

type Todo = {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
};

Api.create("todos", "https://jsonplaceholder.typicode.com", () => {
  Route.get("list", "/todos");
  Route.get("getOne", "/todos/[id]");
});

const items = await Klaim.todos.list<Todo[]>();
const first = await Klaim.todos.getOne<Todo>({ id: 1 });
```

## Installation

" "bun"]}>
<Tab value="npm">

```bash
npm install klaim
```

</Tab>
<Tab value="pnpm">

```bash
pnpm add klaim
```

</Tab>
<Tab value="yarn">

```bash
yarn add klaim
```

</Tab>
<Tab value="bun">

```bash
bun add klaim
```

</Tab>
</Tabs>

Klaim also ships a Deno entrypoint through `mod.ts` and `deno.json`, so the equivalent Deno package import is `@antharuu/klaim`.

Supported environments:

- Node.js 18+ or any runtime with global `fetch`
- Modern browsers
- Bun
- Deno

## Quick Start

This is the smallest useful setup: one API, one route with a path parameter, and one request.

```typescript
import { Api, Klaim, Route } from "klaim";

type Todo = {
  id: number;
  title: string;
  completed: boolean;
};

Api.create("jsonPlaceholder", "https://jsonplaceholder.typicode.com", () => {
  Route.get("getTodo", "/todos/[id]");
});

const todo = await Klaim.jsonPlaceholder.getTodo<Todo>({ id: 1 });

console.log(todo.id, todo.title, todo.completed);
```

Expected output:

```text
1 delectus aut autem false
```

What happens under the hood:

1. `Api.create()` registers `jsonPlaceholder` in `src/core/Registry.ts`.
2. `Route.get()` creates a `Route` instance, detects `[id]` as a required argument, and registers it.
3. The registry writes `Klaim.jsonPlaceholder.getTodo` as a callable handler.
4. Calling that handler runs `callApi()` from `src/core/Klaim.ts`, injects the URL argument, performs `fetch`, and returns parsed JSON.

## Key Features

- Declarative API and route registration with camel-cased property names
- Nested groups for organizing APIs and routes
- Built-in caching, retry, timeout, rate limit, pagination, and schema validation
- Middleware hooks for request and response mutation
- Route-level hooks via `Hook.subscribe()`
- Exported registry and cache singletons for testing and instrumentation

<Cards>
  <Card title="Architecture" href="/docs/architecture">See how `Element`, `Registry`, and `Klaim` work together.</Card>
  <Card title="Core Concepts" href="/docs/api-and-routes">Start with APIs, routes, groups, and the runtime lifecycle.</Card>
  <Card title="API Reference" href="/docs/api-reference/api">Jump straight to method signatures and source locations.</Card>
</Cards>
