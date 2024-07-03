# Klaim 📦

Klaim is a lightweight TypeScript library designed to manage APIs and record requests, optimized for an optimal user
experience.

## 📚 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Usage](#-usage)
    - [Basic API Configuration](#basic-api-configuration)
    - [Route Definition](#route-definition)
    - [Request Handling](#request-handling)
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

```typescript
import {Api, Klaim, Route, Hook} from 'klaim';
// For deno: import { Api, Klaim, Route, Hook } from "@antharuu/klaim";

// Your simple Todo type
type Todo = {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
}

// Create a new API with the name "hello" and the base URL "https://jsonplaceholder.typicode.com/"
Api.create("hello", "https://jsonplaceholder.typicode.com/");
```

### Route Definition

Define routes for the API:

```typescript
// Define a route to get a list of todos
Route.get<Todo[]>("listTodos", "todos");

// Define a route to get a todo by id
Route.get<Todo>("getTodo", "todos/[id]");

// Define a route to add a new todo
Route.post<Todo>("addTodo", "todos");

// Define a route with before middleware
Route.get<Todo>("getRandomTodo", "todos")
    .before(({url}) => {
        const random = Math.floor(Math.random() * 10) + 1;
        return ({url: `${url}/${random}`});
    });

// Define a route with after middleware
Route.get<Todo>("getFirstTodo", "todos")
    .after(({data: [first]}) => ({data: first}));
```

### Request Handling

Make requests using the defined routes:

```typescript
// Make a request to the "listTodos" route
const listOfTodos = await Klaim.hello.todo<Todo>({id: 1});

// Make a request to the "getTodo" route with the parameter "id"
const todo = await Klaim.hello.getTodo<Todo>({id: 1});

// Make a request to the "addTodo" route
const newTodo = await Klaim.hello.addTodo<Todo>({}, {title: "New Todo", completed: false, userId: 1});
```

### Hook Subscription

Subscribe to hooks to monitor specific events:

```typescript
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
