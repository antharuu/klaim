# Klaim 📦

Klaim is a lightweight TypeScript library designed to manage APIs and record requests, optimized for an optimal user
experience.

## 🚀 Features

- **Efficient API Management**: Easily manage multiple APIs with streamlined integration and interaction capabilities.
- **Request Recording**: Seamlessly track requests for debugging and monitoring.
- **User Experience Optimization**: Focused on performance and usability for a smooth user experience.
- **Lightweight**: Minimal footprint for fast load times and minimal performance impact.
- **TypeScript Support**: Fully typed for enhanced code quality and developer experience.

## 📥 Installation

Install Klaim via npm:

```sh
// Using npm
npm install klaim

// Using bun
bun add klaim
```

## 🛠 Usage

Here’s a basic example to get you started:

```typescript
import {Api, Klaim, Registry, Route} from 'klaim';

// Your simple Todo type
type Todo = {
    userId: number;
    id: number;
    title: string;
    completed: boolean;
}

// --- Basic API configuration
// Create a new API with the name "hello" and the base URL "https://jsonplaceholder.typicode.com/"
Api.create("hello", "https://jsonplaceholder.typicode.com/", () => {
    // Define routes for the API
    Route.get<Todo[]>("listTodos", "todos");

    // You can also define routes with parameters
    Route.get<Todo>("getTodo", "todos/[id]");

    // You can also define routes in post, (put, delete, etc)
    Route.post<Todo>("addTodo", "todos");

    // With before middleware
    Route.get<Todo>("getRandomTodo", "todos")
        .before(({url}) => {
            const random = Math.floor(Math.random() * 10) + 1;
            return ({url: `${url}/${random}`});
        });

    // With after middleware
    Route.get<Todo>("getFirstTodo", "todos")
        .after(({data: [first]}) => ({data: first}));
});

// --- Usage
// Make a request to the "listTodos" route
const listOfTodos = await Klaim.hello.todo<Todo>({id: 1})

// Make a request to the "getTodo" route with the parameter "id"
const todo = await Klaim.hello.getTodo<Todo>({id: 1})

// Make a request to the "addTodo" route
const newTodo = await Klaim.hello.addTodo<Todo>({}, {title: "New Todo", completed: false, userId: 1})
```

## 🤝 Contributing

Contributions are welcome!
