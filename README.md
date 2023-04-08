# Klaim

Klaim is a modern JavaScript library for simplifying API calls and data validation by offering an alternative to Axios and Yup. Klaim allows you to declare your routes in advance, use them later, and define schemas for request and response data for robust validation.

## ⚠️ **Klaim is still in development and is not yet ready for production use.** ⚠️

## Installation

Use your preferred package manager to install Klaim:

```
yarn add klaim
```

## Usage

Here's an example of using Klaim:

```js
import klaim from "klaim";

// Create an API instance
klaim.create.api('test', 'https://jsonplaceholder.typicode.com')

// Get an API instance
klaim.get.api('test')

const randomId = () => Math.round(Math.random() * 200)

// Create a route
const r1 = klaim.create.route('route1', 'get', '/todos/[id:num]').on('test')

// Call a route
const r1b = await r1.call({id: randomId()})
console.log(r1b)

// Get and call a route
const r2 = await klaim.get.route('route1').call({id: randomId()})
console.log(r2);

// Call a route by name
const r3 = await klaim.call('route1', {id: randomId()})
console.log(r3); 
```

## Features Coming Soon

-   Declaration of schemas for request body data and responses
-   Strong data validation based on declared schemas

## Contribution

Contributions are welcome! Feel free to create issues to report bugs or propose enhancements, and submit pull requests to contribute to the project.

## License

Klaim is available under the [MIT license](https://opensource.org/licenses/MIT).