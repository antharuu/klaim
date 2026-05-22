---
title: "Pagination, Validation, and Observability"
description: "Build a paginated Klaim route that validates responses and emits route-level hooks."
---

This guide shows a realistic pattern for list endpoints that return paginated results and need contract checks.

## Problem

You need to call a paginated endpoint repeatedly, ensure the response shape stays valid, and observe when the route completes so other parts of the app can react.

## Solution

Use `withPagination()` to standardize the page argument, `validate()` to guard the response contract, and `Hook.subscribe()` to observe successful calls.

<Steps>
<Step>
### Define the route with pagination and validation

```typescript
import { Api, Route } from "klaim";
import * as yup from "yup";

const pokemonListSchema = yup.object({
  results: yup.array(
    yup.object({
      name: yup.string().required(),
    })
  ).required(),
});

Api.create("pokemon", "https://pokeapi.co/api/v2", () => {
  Route.get("list", "/pokemon")
    .withPagination({ pageParam: "offset", limitParam: "limit", limit: 5 })
    .validate(pokemonListSchema);
});
```

</Step>
<Step>
### Subscribe to the route hook

```typescript
import { Hook } from "klaim";

Hook.subscribe("pokemon.list", () => {
  console.log("pokemon list request completed");
});
```

</Step>
<Step>
### Request multiple pages

```typescript
import { Klaim } from "klaim";

const firstPage = await Klaim.pokemon.list(0);
const secondPage = await Klaim.pokemon.list(5);

console.log(firstPage.results.length, secondPage.results.length);
```

</Step>
</Steps>

## Complete Example

```typescript
import { Api, Hook, Klaim, Route } from "klaim";
import * as yup from "yup";

type PokemonList = {
  results: Array<{ name: string }>;
};

const pokemonListSchema = yup.object({
  results: yup.array(
    yup.object({
      name: yup.string().required(),
    })
  ).required(),
});

Api.create("pokemon", "https://pokeapi.co/api/v2", () => {
  Route.get("list", "/pokemon")
    .withPagination({ pageParam: "offset", limitParam: "limit", limit: 5 })
    .withTimeout(2)
    .validate(pokemonListSchema);
});

Hook.subscribe("pokemon.list", () => {
  console.log("pokemon.list finished");
});

async function run() {
  const pageOne = await Klaim.pokemon.list<PokemonList>(0);
  const pageTwo = await Klaim.pokemon.list<PokemonList>(5);

  console.log(pageOne.results.map((item) => item.name));
  console.log(pageTwo.results.map((item) => item.name));
}

run();
```

Two implementation details from `src/core/Klaim.ts` matter here:

- Pagination changes the function shape so the first argument is numeric page or offset data.
- Hooks run after validation and after the route-level `after` callback, so observers see a completed request lifecycle.
