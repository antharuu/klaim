---
title: "Defining a Client"
description: "Build a practical Klaim client with grouped routes, default headers, and typed calls."
---

This guide shows how to turn a set of related HTTP endpoints into one organized client object that the rest of your app can call.

## Problem

You need one reusable client for a service that exposes multiple endpoints. You want the routes grouped by feature area, shared headers applied at the API level, and a runtime object that is easy to call from application code.

## Solution

Declare one API, group the routes by feature area, and call them through `Klaim`.

<Steps>
<Step>
### Define the API and route groups

```typescript
import { Api, Group, Route } from "klaim";

Api.create(
  "blog",
  "https://jsonplaceholder.typicode.com",
  () => {
    Group.create("posts", () => {
      Route.get("list", "/posts");
      Route.get("getOne", "/posts/[id]");
      Route.post("create", "/posts");
    });

    Group.create("users", () => {
      Route.get("list", "/users");
      Route.get("getOne", "/users/[id]");
    });
  },
  {
    Authorization: "Bearer example-token",
  }
);
```

</Step>
<Step>
### Call the generated runtime functions

```typescript
import { Klaim } from "klaim";

const posts = await Klaim.blog.posts.list();
const user = await Klaim.blog.users.getOne({ id: 1 });
const created = await Klaim.blog.posts.create(
  {},
  { title: "New post", body: "Created through Klaim", userId: 1 }
);
```

</Step>
<Step>
### Use the client from real application code

```typescript
type DashboardData = {
  latestPosts: unknown;
  currentUser: unknown;
};

export async function loadDashboard(): Promise<DashboardData> {
  const [latestPosts, currentUser] = await Promise.all([
    Klaim.blog.posts.list(),
    Klaim.blog.users.getOne({ id: 1 }),
  ]);

  return { latestPosts, currentUser };
}
```

</Step>
</Steps>

## Complete Example

```typescript
import { Api, Group, Klaim, Route } from "klaim";

type Post = {
  id: number;
  title: string;
  body: string;
  userId: number;
};

type User = {
  id: number;
  name: string;
  email: string;
};

Api.create(
  "blog",
  "https://jsonplaceholder.typicode.com",
  () => {
    Group.create("posts", () => {
      Route.get("list", "/posts").withTimeout(2);
      Route.get("getOne", "/posts/[id]");
      Route.post("create", "/posts");
    }).withRetry(1);

    Group.create("users", () => {
      Route.get("list", "/users");
      Route.get("getOne", "/users/[id]");
    });
  },
  {
    Authorization: "Bearer example-token",
  }
);

async function run() {
  const [posts, user] = await Promise.all([
    Klaim.blog.posts.list<Post[]>(),
    Klaim.blog.users.getOne<User>({ id: 1 }),
  ]);

  const created = await Klaim.blog.posts.create<Post>(
    {},
    { title: "Guide post", body: "Example body", userId: 1 }
  );

  console.log(posts.length, user.email, created.id);
}

run();
```

This pattern works well when you want one stable integration module that the rest of the application can import without caring how URLs are built.
