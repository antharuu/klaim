# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run build` or `yarn build` - Build the library with Vite 
- `npm run dev` or `yarn dev` - Build in watch mode for development
- `npm test` or `yarn test` - Run tests with Vitest
- `npm run test:ui` or `yarn test:ui` - Run tests with UI and coverage
- `npm run test:cover` or `yarn test:cover` - Run tests with coverage report
- `npm run lint` or `yarn lint` - Lint source code with ESLint
- `npm run lint:fix` or `yarn lint:fix` - Fix linting errors automatically

## Project Architecture

Klaim is a TypeScript library for API management with request recording and optimization features. The architecture follows a modular design:

### Core Components (`src/core/`)
- **Klaim.ts** - Main entry point providing the global `Klaim` object and request execution logic with middleware, caching, retry, and rate limiting
- **Api.ts** - API class for creating and managing API endpoints with base URLs and headers
- **Route.ts** - Route class for defining HTTP endpoints (GET, POST, PUT, DELETE, etc.) with URL parameters
- **Group.ts** - Grouping system for organizing APIs and routes hierarchically with shared configuration
- **Registry.ts** - Central registry managing all APIs, routes, and groups with path resolution
- **Element.ts** - Base class providing common functionality (caching, retry, middleware, rate limiting, validation)
- **Hook.ts** - Event system for subscribing to and triggering API call events

### Utilities (`src/tools/`)
- **fetchWithCache.ts** - Caching implementation for API responses
- **rateLimit.ts** - Rate limiting mechanism to control API call frequency  
- **timeout.ts** - Request timeout functionality with custom error messages
- **cleanUrl.ts** - URL cleaning and normalization utilities
- **hashStr.ts** - String hashing for cache keys
- **toCamelCase.ts** - Converts strings to camelCase for consistent naming

### Key Patterns
- **Fluent API**: Methods like `.withCache()`, `.withRetry()`, `.before()`, `.after()` for configuration
- **Registry Pattern**: Central management of all APIs/routes with hierarchical path resolution
- **Middleware System**: Before/after hooks for request/response modification
- **Hierarchical Organization**: Groups can contain APIs or other groups, routes belong to APIs
- **Type Safety**: Full TypeScript support with generic types for API responses

### Testing
- Tests are in `/tests/` directory with numbered test files (01.api.test.ts, etc.)
- Uses Vitest with jsdom environment and v8 coverage provider
- Coverage excludes certain files like Registry.ts and config files

### Build System
- Vite-based build system generating ES, CommonJS, and UMD formats
- TypeScript compilation with strict settings and declaration generation
- Supports multiple runtime environments (Node.js, Bun, Deno)