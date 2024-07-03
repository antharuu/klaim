# Klaim 📦

[![JSR Score](https://jsr.io/badges/@antharuu/klaim/score)](https://jsr.io/@antharuu/klaim)

Klaim is a lightweight TypeScript library designed to manage APIs and record requests, optimized for an optimal user
experience.

## 📚 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
    - [Basic API Configuration](#basic-api-configuration)
    - [Route Definition](#route-definition)
    - [Request Handling](#request-handling)
    - [Middleware Usage](#middleware-usage)
    - [Hook Subscription](#hook-subscription)
- [Links](#-links)
- [Contributing](#-contributing)
- [License](#-license)

## 🚀 Features

- **Efficient API Management**: Easily manage multiple APIs with streamlined integration and interaction capabilities.
- **Request Recording**: Seamlessly track requests for debugging and monitoring.
- **User Experience Optimization**: Focused on performance and usability for a smooth user experience.
- **Lightweight**: Minimal footprint for fast load times and minimal performance impact.
- **Middleware Support**: Easily add middleware to modify requests and responses (`before` and `after`).
- **Hook System**: Subscribe to hooks to monitor and react to specific events.
- **TypeScript Support**: Fully typed for enhanced code quality and developer experience.

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

Define various routes within the API callback:

```typescript
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Get a list of todos
    Route.get<Todo[]>("listTodos", "todos");

    // Get a specific todo by id
    Route.get<Todo>("getTodo", "todos/[id]");

    // Add a new todo
    Route.post<Todo>("addTodo", "todos");
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

## 🔗 Links

- [NPM](https://www.npmjs.com/package/klaim)
- [JSR](https://jsr.io/@antharuu/klaim)
- [GitHub](https://github.com/antharuu/klaim)

## 🤝 Contributing

Contributions are welcome! Please see the [Contributing Guide](CONTRIBUTING.md) for more details.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
