![NPM Downloads](https://img.shields.io/npm/d18m/klaim?style=flat)

## 📚 Table of Contents

- [Features](#-features)
- [Next features](#-next-features)
- [Installation](#-installation)
- [Usage](#-usage)
    - [Basic API Configuration](#basic-api-configuration)
    - [Route Definition](#route-definition)
    - [Request Handling](#request-handling)
    - [Groups](#groups)
        - [API Groups](#api-groups)
        - [Route Groups](#route-groups)
        - [Nested Groups](#nested-groups)
        - [Group Configuration](#group-configuration)
    - [Middleware Usage](#middleware-usage)
    - [Hook Subscription](#hook-subscription)
    - [Caching Requests](#caching-requests)
    - [Retry Mechanism](#retry-mechanism)
    - [Response Validation](#response-validation)
- [Links](#-links)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Features

- **Efficient API Management**: Easily manage multiple APIs with streamlined integration and interaction capabilities.
- **API Grouping**: Organize related APIs into logical groups with shared settings and configuration.
- **Route Grouping**: Organize related routes into logical groups with inherited settings.
- **Request Recording**: Seamlessly track requests for debugging and monitoring.
- **User Experience Optimization**: Focused on performance and usability for a smooth user experience.
- **Lightweight**: Minimal footprint for fast load times and minimal performance impact.
- **Middleware Support**: Easily add middleware to modify requests and responses (`before` and `after`).
- **Hook System**: Subscribe to hooks to monitor and react to specific events.
- **Caching**: Enable caching on requests to reduce network load and improve performance.
- **Retry Mechanism**: Automatically retry failed requests to enhance reliability.
- **TypeScript Support**: Fully typed for enhanced code quality and developer experience.
- **Response Validation**: Validate responses using schemas for increased reliability and consistency.

## ⌛ Next features

- Pagination (Version: 1.8)
- Rate Limiting (Version: 1.9)
- Login (Version: 1.10)
- Time Out (Version: 1.11)
- Error Handling (Version: 1.12)

## 📥 Installation

Install Klaim via npm:

```sh
// Using npm
npm install klaim

// Using bun
bun add klaim

// Using deno
deno add @antharuu/klaim
```

## 🛠 Usage

### Basic API Configuration

First, set up the API configuration. Define the API and its base URL.

```typescript
import {Api, Route} from 'klaim';
// For deno: import { Api, Route } from "@antharuu/klaim";

// Your simple Todo type
type Todo = {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
};

// Create a new API with the name "hello" and the base URL "https://jsonplaceholder.typicode.com/"
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Define routes for the API
    Route.get<Todo[]>("listTodos", "todos");
    Route.get<Todo>("getTodo", "todos/[id]");
    Route.post<Todo>("addTodo", "todos");
});
```

### Route Definition

Routes represent endpoints in your API and can be defined with different HTTP methods. Routes can include parameters and custom configurations:

```typescript
Api.create("api", "https://api.example.com", () => {
    // Basic GET route
    Route.get("listUsers", "/users");
    
    // GET route with URL parameter
    Route.get("getUser", "/users/[id]");
    
    // POST route with custom headers and body
    Route.post("createUser", "/users", {
        "Content-Type": "application/json"
    }, { userId: 1, name: "John Doe" });
    
    // PUT route with parameter
    Route.put("updateUser", "/users/[id]");
    
    // DELETE route
    Route.delete("deleteUser", "/users/[id]");
    
    // PATCH route
    Route.patch("updateUserStatus", "/users/[id]/status");
    
    // OPTIONS route
    Route.options("userOptions", "/users");
});
```

### Groups

Klaim provides powerful grouping capabilities for both APIs and routes. Groups can be used to organize related elements, share configuration, and maintain a clean structure in your application.

#### API Groups

Organize multiple APIs that serve related purposes:

```typescript
import {Group, Api, Route} from 'klaim';

// Create a group for user-related services
Group.create("userServices", () => {
    // Authentication API
    Api.create("auth", "https://auth.example.com", () => {
        Route.post("login", "/login");
        Route.post("register", "/register");
    });

    // User Management API
    Api.create("users", "https://users.example.com", () => {
        Route.get("list", "/users");
        Route.get("getOne", "/users/[id]");
    });
}).withRetry(3); // Apply retry mechanism to all APIs in the group

// Access grouped APIs
await Klaim.userServices.auth.login({}, { username: "user", password: "pass" });
await Klaim.userServices.users.list();
```

#### Route Groups

Organize routes within an API into logical groups:

```typescript
Api.create("hello", "https://api.example.com/", () => {
    // Group user-related routes
    Group.create("users", () => {
        Route.get<User[]>("list", "/users");
        Route.get<User>("getOne", "/users/[id]");
        Route.post<User>("create", "/users");
    }).withCache(60);  // Cache all user routes for 60 seconds
    
    // Group product-related routes
    Group.create("products", () => {
        Route.get("list", "/products");
        Route.get("getOne", "/products/[id]");
    });
});

// Use grouped routes
const users = await Klaim.hello.users.list();
const product = await Klaim.hello.products.getOne({ id: 1 });
```

#### Nested Groups

Create complex hierarchies with nested groups:

```typescript
Group.create("services", () => {
    // Internal services group
    Group.create("internal", () => {
        Api.create("logs", "https://logs.internal.example.com", () => {
            Route.post("write", "/logs");
        });
        
        Api.create("metrics", "https://metrics.internal.example.com", () => {
            Route.post("track", "/metrics");
        });
    }).withRetry(5);  // More retries for internal services
    
    // External services group
    Group.create("external", () => {
        Api.create("weather", "https://api.weather.com", () => {
            Route.get("forecast", "/forecast/[city]");
        });
        
        Api.create("geocoding", "https://api.geocoding.com", () => {
            Route.get("search", "/search/[query]");
        });
    }).withCache(300);  // Cache external services longer
});

// Access nested groups
await Klaim.services.internal.logs.write({}, { message: "Log entry" });
await Klaim.services.external.weather.forecast({ city: "Paris" });
```

#### Group Configuration

Groups can share configuration among all their members:

```typescript
Group.create("apis", () => {
    Api.create("service1", "https://api1.example.com", () => {
        Route.get("test", "/test");
    });
    
    Api.create("service2", "https://api2.example.com", () => {
        Route.get("test", "/test");
    });
})
    .withCache(60)  // Enable caching for all APIs
    .withRetry(3)   // Enable retries for all APIs
    .before(({ config }) => {  // Add authentication for all APIs
        config.headers.Authorization = `Bearer ${getToken()}`;
    })
    .after(({ data }) => {  // Process all responses
        logResponse(data);
    });
```

### Request Handling

Handle requests using the defined routes:

```typescript
import {Klaim} from 'klaim';
// For deno: import { Klaim } from "@antharuu/klaim";

// Make a request to the "listTodos" route
const listOfTodos = await Klaim.hello.listTodos<Todo[]>();

// Make a request to the "getTodo" route with the parameter "id"
const todo = await Klaim.hello.getTodo<Todo>({id: 1});

// Make a request to the "addTodo" route
const newTodo = await Klaim.hello.addTodo<Todo>({}, {title: "New Todo", completed: false, userId: 1});
```

### Middleware Usage

Add middleware to modify requests and responses. Use `before` middleware to alter requests before they are sent
and `after` middleware to process responses:

```typescript
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // With before middleware
    Route.get<Todo>("getRandomTodo", "todos")
        .before(({url}) => {
            const random = Math.floor(Math.random() * 10) + 1;
            return {url: `${url}/${random}`};
        });

    // With after middleware
    Route.get<Todo>("getFirstTodo", "todos")
        .after(({data: [first]}) => ({data: first}));
});
```

### Hook Subscription

Subscribe to hooks to monitor specific events:

```typescript
import {Hook} from 'klaim';
// For deno: import { Hook } from "@antharuu/klaim";

// Subscribe to the "hello.getFirstTodo" hook
Hook.subscribe("hello.getFirstTodo", ({url}) => {
    console.log(`Requesting ${url}`);
});
```

### Caching Requests

Enable caching on requests to reduce network load and improve performance. By default, the cache duration is 20 seconds,
but you can specify a custom duration in seconds.

#### Caching Individual Routes

You can enable caching on individual routes:

```typescript
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Get a list of todos with default cache duration (20 seconds)
    Route.get<Todo[]>("listTodos", "todos").withCache();

    // Get a specific todo by id with custom cache duration (300 seconds)
    Route.get<Todo>("getTodo", "todos/[id]").withCache(300);

    // Add a new todo (no cache)
    Route.post<Todo>("addTodo", "todos");
});
```

Now, when making requests, the caching feature will be applied.

#### Caching the Entire API

You can also enable caching for all routes defined within an API:

```typescript
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Define routes for the API
    Route.get<Todo[]>("listTodos", "todos");
    Route.get<Todo>("getTodo", "todos/[id]");
    Route.post<Todo>("addTodo", "todos");
}).withCache(); // Enable default cache duration (20 seconds) for all routes
```

### Retry Mechanism

Automatically retry failed requests to enhance reliability. You can specify the number of retry attempts for individual
routes or for the entire API.

#### Retry on Individual Routes

Enable retry on individual routes:

```typescript
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Get a list of todos with retry mechanism (default: 2)
    Route.get<Todo[]>("listTodos", "todos").withRetry();

    // Get a specific todo by id with retry mechanism (specified to 5)
    Route.get<Todo>("getTodo", "todos/[id]").withRetry(5);

    // Add a new todo (no retry)
    Route.post<Todo>("addTodo", "todos");
});
```

#### Retry the Entire API

Enable retry for all routes defined within an API:

```typescript
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Define routes for the API
    Route.get<Todo[]>("listTodos", "todos");
    Route.get<Todo>("getTodo", "todos/[id]");
    Route.post<Todo>("addTodo", "todos");
}).withRetry();
```

Now, when a request fails, it will be retried the specified number of times before ultimately failing.

### Response Validation

You can use [Yup](https://www.npmjs.com/package/yup) to validate the response schema for increased reliability and
consistency. You can specify a schema for
individual routes to ensure the response data conforms to the expected structure.

⚠️ **Note**: This feature requires the `yup` package to be installed.

#### Adding Validation to Individual Routes

Enable validation on individual routes:

```typescript
import * as yup from 'yup';

// Define the schema using Yup
const todoSchema = yup.object().shape({
    userId: yup.number().required(),
    id: yup.number().min(1).max(10).required(),
    title: yup.string().required(),
    completed: yup.boolean().required()
});

Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Get a specific todo by id with validation
    Route.get<Todo>("getTodo", "todos/[id]").validate(todoSchema);
});

// This request will fail because the id is out of range
const todoFail = await Klaim.hello.getTodo<Todo>({id: 15});

// This request will succeed
const todo = await Klaim.hello.getTodo<Todo>({id: 1});
```

## 🔗 Links

- [NPM](https://www.npmjs.com/package/klaim)
- [JSR](https://jsr.io/@antharuu/klaim)
- [GitHub](https://github.com/antharuu/klaim)

## 🤝 Contributing

Contributions are welcome! Please see the [Contributing Guide](CONTRIBUTING.md) for more details.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
