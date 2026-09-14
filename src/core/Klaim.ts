import { CancelToken, createCancelToken } from "../tools/cancelToken";
import { checkCircuitBreaker, reportCircuitBreakerResult } from "../tools/circuitBreaker";
import { dedupe } from "../tools/dedupe";
import fetchWithCache, { FetchCacheOptions } from "../tools/fetchWithCache";
import { checkRateLimit, getTimeUntilNextRequest } from "../tools/rateLimit";
import { runWithTimeout } from "../tools/timeout";

import { Cache } from "./Cache";
import { ICallback, ICallbackAfterArgs, ICallbackBeforeArgs, IElement } from "./Element";
import { CancelledError, CircuitOpenError, InvalidPathError, MissingArgumentError, RateLimitError, RetryExhaustedError } from "./errors";
import { Hook } from "./Hook";
import { Registry } from "./Registry";

/**
 * Type representing key-value pairs for route arguments
 */
export type IArgs = Record<string, unknown>;

/**
 * Type representing request body data structure
 */
export type IBody = Record<string, unknown>;

/**
 * A promise returned by a route call that can be cancelled before it settles.
 *
 * Cancellation is per call: each invocation of a route function gets its own
 * cancellation token, so concurrent calls to the same route never share or
 * collide over a single controller. When the call is running under a
 * `.withTimeout()` budget, cancelling reuses that attempt's existing
 * `AbortController` (no extra allocation, no signal collision). Without a
 * timeout, cancellation is cooperative: it rejects the promise as soon as the
 * next checkpoint (cache lookup, response decoding, validation, ...) is
 * reached, but cannot preempt an already-started synchronous step.
 *
 * @template T - The type of data returned by the route
 */
export interface CancellablePromise<T> extends Promise<T> {
    /**
     * Cancels this specific call. Calling it again, or after the call has
     * already settled, has no additional effect.
     *
     * @param reason - Optional custom cancellation reason; defaults to a {@link CancelledError}
     */
    cancel(reason?: unknown): void;
}

/**
 * Generic function type for route handlers with pagination support
 *
 * @template T - The type of data returned by the route
 */
export type RouteFunction<T = any> = {
    (offset?: number, args?: IArgs, body?: IBody): CancellablePromise<T>;
    /**
     * Invalidates every cached entry for this route (all parameterized variants included).
     * No-op if the route was never called with caching enabled.
     *
     * @returns The number of cache entries removed
     */
    invalidate(): number;
};

/**
 * Type representing a nested structure of route references
 */
export type IRouteReference = Record<string, RouteFunction>;

/**
 * Type representing API references containing route references
 */
export type IApiReference = Record<string, IRouteReference>;

/**
 * Shape of the global middleware registration methods exposed on the {@link Klaim} object.
 *
 * These extend the existing before/after pattern (already available per-element via
 * `Api`/`Route`/`Group`) to a global level: callbacks registered here run for every route of
 * every API. See {@link registerGlobalBefore} for the full documented execution order.
 */
export interface IGlobalMiddlewareApi {
    /** Registers a global "before" middleware, executed ahead of local before hooks. */
    before(callback: ICallback<ICallbackBeforeArgs>): void;
    /** Registers a global "after" middleware, executed after local after hooks. */
    after(callback: ICallback<ICallbackAfterArgs>): void;
}

/**
 * Global Klaim object that provides access to all registered APIs and their routes
 *
 * @example
 * ```typescript
 * // Basic usage
 * await Klaim.apiName.routeName();
 *
 * // With pagination
 * await Klaim.apiName.routeName(2); // Page 2
 * ```
 */
export const Klaim: IApiReference & IGlobalMiddlewareApi = {} as IApiReference & IGlobalMiddlewareApi;

/**
 * Collection of global middleware callbacks executed for every route of every API.
 *
 * Unlike element-level `before`/`after` (a single callback slot, replaced on each call),
 * this stores an array so multiple global middlewares can be stacked in registration order.
 *
 * @private
 */
const globalCallbacks: {
    before: ICallback<ICallbackBeforeArgs>[];
    after: ICallback<ICallbackAfterArgs>[];
} = {
    before: [],
    after: []
};

/**
 * Registers a global "before" middleware, executed for every route of every API.
 *
 * ### Execution order
 * Global middlewares extend the existing before/after pattern rather than introducing a new
 * concept. The full, documented order for a single call is:
 *
 * 1. **global before** (registered here, in registration order, each fed the previous result)
 * 2. **api before** *(not currently invoked — see note below)*
 * 3. **route before** (`route.before(...)`, the existing local hook)
 * 4. network request execution
 * 5. **route after** (`route.after(...)`, the existing local hook)
 * 6. **api after** *(not currently invoked — see note below)*
 * 7. **global after** (registered here, in registration order, each fed the previous result)
 *
 * > **Note (pre-existing, out of scope for this change):** `applyBefore`/`applyAfter` in this
 * > module only ever invoke `route.callbacks.before` / `route.callbacks.after`. An API-level
 * > `before`/`after` callback (set via `Api.create(...).before(...)`) is stored on the API
 * > element but is never actually called during a request. This is a pre-existing gap in the
 * > local (non-global) middleware chain; it is documented here for visibility but intentionally
 * > left unfixed by this feature, which only adds the global layer on top of current behavior.
 *
 * Each global middleware receives the same shape as a local `before` callback
 * ({@link ICallbackBeforeArgs}) and may return a partial override; returned fields are merged
 * into the arguments passed to the next middleware in the chain (global, then local).
 *
 * @param {ICallback<ICallbackBeforeArgs>} callback - Function to execute before every request
 * @returns {void}
 * @example
 * ```typescript
 * import { Klaim } from "klaim";
 *
 * Klaim.before(({ url, config }) => {
 *   console.log(`[global] requesting ${url}`);
 *   return { config: { ...config, headers: { ...config.headers as object, "X-Trace": "1" } } };
 * });
 * ```
 */
export function registerGlobalBefore (callback: ICallback<ICallbackBeforeArgs>): void {
    globalCallbacks.before.push(callback);
}

/**
 * Registers a global "after" middleware, executed for every route of every API.
 *
 * See {@link registerGlobalBefore} for the full documented execution order.
 * Global "after" middlewares run last, once route-level (and, in the future, api-level)
 * "after" callbacks have already run, in registration order, each fed the previous result.
 *
 * @param {ICallback<ICallbackAfterArgs>} callback - Function to execute after every response
 * @returns {void}
 * @example
 * ```typescript
 * import { Klaim } from "klaim";
 *
 * Klaim.after(({ data }) => {
 *   console.log("[global] response received");
 *   return { data };
 * });
 * ```
 */
export function registerGlobalAfter (callback: ICallback<ICallbackAfterArgs>): void {
    globalCallbacks.after.push(callback);
}

/**
 * Removes every registered global middleware (before and after).
 * Primarily useful for tests to isolate global middleware state between cases.
 *
 * @returns {void}
 */
export function resetGlobalMiddlewares (): void {
    globalCallbacks.before.length = 0;
    globalCallbacks.after.length = 0;
}

Object.assign(Klaim, {
    /**
     * Registers a global "before" middleware, executed for every route of every API,
     * ahead of any element-level (api/route) before hooks. See {@link registerGlobalBefore}.
     *
     * @param {ICallback<ICallbackBeforeArgs>} callback - Function to execute before every request
     * @returns {void}
     */
    before: registerGlobalBefore,

    /**
     * Registers a global "after" middleware, executed for every route of every API,
     * after any element-level (route/api) after hooks. See {@link registerGlobalAfter}.
     *
     * @param {ICallback<ICallbackAfterArgs>} callback - Function to execute after every response
     * @returns {void}
     */
    after: registerGlobalAfter
});

/**
 * Creates a callable function for a specific route.
 *
 * Each invocation creates its own cancellation token, so the `.cancel()`
 * exposed on the returned promise only ever affects that single call.
 *
 * @param parent - Parent path in dot notation
 * @param element - Route element to bind
 * @returns The generated route function
 */
export function createRouteHandler<T> (
    parent: string,
    element: IElement
): RouteFunction<T> {
    /**
     * Invokes the bound route, resolving pagination and default arguments.
     * Each invocation creates its own cancellation token, so the `.cancel()`
     * exposed on the returned promise only ever affects that single call.
     *
     * @param args - Pagination offset (if paginated) followed by args/body, or args/body alone
     * @returns Cancellable promise resolving to the route's response
     */
    function handler (...args: [number?, IArgs?, IBody?] | [IArgs?, IBody?]): CancellablePromise<T> {
        const token = createCancelToken(() => new CancelledError(`Call to ${parent}.${element.name} was cancelled`));

        let promise: Promise<T>;
        if (element.pagination) {
            const [
                page = 0,
                customArgs = {},
                body = {}
            ] = args as [number?, IArgs?, IBody?];
            promise = callApi<T>(parent, element, page, customArgs as IArgs, body as IBody, token);
        } else {
            const [ customArgs = {}, body = {} ] = args as [IArgs?, IBody?];
            promise = callApi<T>(parent, element, undefined, customArgs as IArgs, body as IBody, token);
        }

        const cancellable = promise as CancellablePromise<T>;
        /**
         * Cancels this specific call via the enclosing cancellation token.
         *
         * @param reason - Optional custom cancellation reason
         * @returns Nothing
         */
        cancellable.cancel = (reason?: unknown): void => token.cancel(reason);
        return cancellable;
    }

    /**
     * Invalidates every cached entry belonging to this route's namespace.
     *
     * @returns The number of cache entries removed
     */
    (handler as RouteFunction<T>).invalidate = function invalidate (): number {
        return Cache.i.invalidate(`${parent}.${element.name}`);
    };
    return handler as RouteFunction<T>;
}

/**
 * Executes an API call for a specific route with optional pagination, arguments and body
 *
 * @template T - The type of data returned by the route
 * @param {string} parent - Parent path in dot notation (e.g., "api.group")
 * @param {IElement} element - Route element to be called
 * @param {number} [offset] - Page number for paginated routes
 * @param {IArgs} [args] - URL parameters for the route
 * @param {IBody} [body] - Request body data
 * @param {CancelToken} [token] - Cancellation token owned by the exposed `.cancel()` API
 * @returns {Promise<T>} Promise resolving to the API response
 * @throws {Error} If the path is invalid or required arguments are missing
 * @example
 * ```typescript
 * // Basic call
 * const response = await callApi<UserData>("users", userRoute);
 *
 * // Paginated call
 * const pagedResponse = await callApi<UserData[]>(
 *   "users",
 *   userRoute,
 *   2,    // Page number
 *   10,   // Items per page
 *   { status: 'active' }
 * );
 * ```
 */
export async function callApi<T> (
    parent: string,
    element: IElement,
    offset?: number,
    args: IArgs = {},
    body: IBody = {},
    token?: CancelToken
): Promise<T> {
    const startTime = Date.now();
    const parentParts = parent.split(".");
    let api: IElement | undefined;

    for (let i = 0; i < parentParts.length; i++) {
        const potentialApiName = parentParts[i];
        api = Registry.i.getApi(potentialApiName);
        if (api) break;
    }

    if (!element || !api || element.type !== "route" || api.type !== "api") {
        throw new InvalidPathError(`${parent}.${element.name}`);
    }

    const routeKey = `${api.name}.${element.name}`;
    const cacheState = { hit: false };

    try {
        token?.assertActive();

        let url = applyArgs(`${api.url}/${element.url}`, element, args);

        if (element.pagination && typeof offset !== "undefined") {
            const { pageParam = "page", limit = 10, limitParam = "limit" } = element.pagination;
            const urlParams = new URLSearchParams();
            urlParams.append(pageParam, String(offset));
            urlParams.append(limitParam, String(limit));
            const separator = url.includes("?") ? "&" : "?";
            url = `${url}${separator}${urlParams.toString()}`;
        }

        let config: Record<string, unknown> = {};

        if (body && element.method !== "GET") {
            config.body = JSON.stringify(body);
        }

        config.headers = {
            "Content-Type": "application/json",
            ...api.headers,
            ...element.headers
        };

        config.method = element.method;

        const {
            beforeRoute,
            beforeApi,
            beforeUrl,
            beforeConfig
        } = applyBefore(applyGlobalBefore({ route: element, api, url, config }));

        url = beforeUrl;
        config = beforeConfig;

        Registry.updateElement(beforeApi);
        Registry.updateElement(beforeRoute);

        token?.assertActive();

        let response = await fetchWithRetry(api, element, url, config, parent, token, cacheState);

        if (element.schema) {
            token?.assertActive();
            response = await element.schema.validate(response);
        }

        token?.assertActive();

        const {
            afterRoute,
            afterApi,
            afterData
        } = applyGlobalAfter(applyAfter({ route: element, api, response, data: response }));

        Registry.updateElement(afterApi);
        Registry.updateElement(afterRoute);

        Hook.run(routeKey);
        Hook.emit(routeKey, {
            success: true,
            durationMs: Date.now() - startTime,
            cacheHit: cacheState.hit
        });

        return afterData as T;
    } catch (error: unknown) {
        Hook.emit(routeKey, {
            success: false,
            durationMs: Date.now() - startTime,
            cacheHit: cacheState.hit,
            error
        });
        throw error;
    }
}

/**
 * Fetches data from an API with optional caching
 *
 * @param cacheOptions - Captured cache settings, or undefined to bypass the cache
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @param assertActive - Attempt terminal guard, absent without timeout
 * @returns Promise resolving to the parsed response
 */
async function fetchData (
    cacheOptions: FetchCacheOptions | undefined,
    url: string,
    config: RequestInit,
    assertActive?: () => void
): Promise<unknown> {
    assertActive?.();
    if (cacheOptions) {
        const data = await fetchWithCache(url, config, { ...cacheOptions, assertActive });
        assertActive?.();
        return data;
    } else {
        const rawResponse = await fetch(url, config);
        assertActive?.();
        const data: unknown = await rawResponse.json();
        assertActive?.();
        return data;
    }
}

/**
 * Fetches data without a timeout budget, still honoring an exposed
 * `.cancel()` by racing the request against the cancellation token.
 *
 * @param cacheOptions - Captured cache settings, or undefined to bypass the cache
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @param token - Cancellation token owned by the exposed `.cancel()` API, if any
 * @returns Promise resolving to the parsed response
 */
async function fetchCancellable (
    cacheOptions: FetchCacheOptions | undefined,
    url: string,
    config: RequestInit,
    token?: CancelToken
): Promise<unknown> {
    if (!token) return fetchData(cacheOptions, url, config);
    const request = fetchData(cacheOptions, url, config, (): void => token.assertActive());
    return Promise.race([ request, token.whenCancelled() ]);
}

/**
 * Performs a fetch request with retry capability and rate limiting.
 *
 * GET requests are additionally coalesced through {@link dedupe}: concurrent
 * identical GET calls (same route, same resolved URL and params) share a
 * single in-flight request instead of hitting the network multiple times.
 * Mutating methods (POST/PUT/PATCH/DELETE) are never deduplicated, since
 * replaying/sharing a write between callers would be incorrect.
 *
 * @param api - API element containing retry settings
 * @param route - Route element containing retry settings
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @param parent - Parent path captured by the route handler
 * @param token - Cancellation token owned by the exposed `.cancel()` API
 * @param cacheState - Mutable holder flipped to true when a cache hit occurs, for Stats/Hook reporting
 * @param cacheState.hit - Whether a cache hit has occurred for this call
 * @returns Promise resolving to the parsed response
 * @throws Error after all retry attempts fail or if rate limited
 */
async function fetchWithRetry (
    api: IElement,
    route: IElement,
    url: string,
    config: Record<string, unknown>,
    parent: string,
    token?: CancelToken,
    cacheState?: { hit: boolean }
): Promise<unknown> {
    const method = typeof config.method === "string" ? config.method.toUpperCase() : "GET";
    if (method === "GET") {
        const dedupeKey = buildDedupeKey(parent, route.name, url, config);
        return dedupe(dedupeKey, () => executeFetchWithRetry(api, route, url, config, parent, token, cacheState));
    }
    return executeFetchWithRetry(api, route, url, config, parent, token, cacheState);
}

/**
 * Builds the deduplication key for a GET request.
 *
 * The key includes the logical route (parent + route name) as well as the
 * fully-resolved URL and the relevant request configuration (method and
 * headers), so that two GET calls to the same route with different
 * parameters/URLs are never incorrectly coalesced together.
 *
 * @param parent - Parent path captured by the route handler
 * @param routeName - Name of the route being called
 * @param url - Fully-resolved request URL, including query params
 * @param config - Fetch configuration options (signal is excluded on purpose)
 * @returns Stable string key identifying this exact GET request
 */
function buildDedupeKey (
    parent: string,
    routeName: string,
    url: string,
    config: Record<string, unknown>
): string {
    const configSansSignal: Record<string, unknown> = { ...config };
    delete configSansSignal.signal;
    return JSON.stringify([
        "klaim-dedupe-v1",
        parent,
        routeName,
        url,
        configSansSignal
    ]);
}

/**
 * Actually performs the fetch request with retry capability and rate limiting,
 * without any deduplication concerns.
 *
 * @param api - API element containing retry settings
 * @param route - Route element containing retry settings
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @param parent - Parent path captured by the route handler
 * @param token - Cancellation token owned by the exposed `.cancel()` API
 * @param cacheState - Mutable holder flipped to true when a cache hit occurs, for Stats/Hook reporting
 * @param cacheState.hit - Whether a cache hit has occurred for this call
 * @returns Promise resolving to the parsed response
 * @throws Error after all retry attempts fail or if rate limited
 */
async function executeFetchWithRetry (
    api: IElement,
    route: IElement,
    url: string,
    config: Record<string, unknown>,
    parent: string,
    token?: CancelToken,
    cacheState?: { hit: boolean }
): Promise<unknown> {
    const cacheDuration = route.cache || api.cache;
    const cacheOptions: FetchCacheOptions | undefined = cacheDuration
        ? {
            ttl: cacheDuration * 1000,
            namespace: `${parent}.${route.name}`,
            policy: route.responsePolicy ?? api.responsePolicy ?? "legacy",
            /**
             * Marks the shared cache-state holder when this cached fetch resolves from cache.
             */
            onHit: (): void => {
                if (cacheState) cacheState.hit = true;
            }
        }
        : undefined;
    const maxRetries = (route.retry || api.retry) || 0;
    const timeoutCfg = route.timeout || api.timeout;
    const init: RequestInit = config;
    const callerSignal = init.signal;

    // Check rate limiting
    // Si la route a sa propre configuration de limite, on l'utilise avec une clé spécifique à la route
    if (route.rate) {
        const routeKey = `ROUTE:${api.name}:${route.name}`;
        const allowed = checkRateLimit(routeKey, route.rate);

        if (!allowed) {
            const waitTime = getTimeUntilNextRequest(routeKey, route.rate);
            throw new RateLimitError(`Rate limit exceeded for ${api.name}.${route.name}. Try again in ${Math.ceil(waitTime / 1000)} seconds.`, waitTime);
        }
    } else if (api.rate) {
        // Si l'API a une configuration de limite et que la route n'en a pas, utiliser une clé au niveau de l'API
        const apiKey = `API:${api.name}`;
        const allowed = checkRateLimit(apiKey, api.rate);

        if (!allowed) {
            const waitTime = getTimeUntilNextRequest(apiKey, api.rate);
            throw new RateLimitError(`Rate limit exceeded for ${api.name} API. Try again in ${Math.ceil(waitTime / 1000)} seconds.`, waitTime);
        }
    }

    token?.assertActive();

    // Check circuit breaker state for the whole operation (all retry attempts together),
    // before any attempt is made. Route-level config takes precedence over API-level config,
    // mirroring rate limiting above.
    const breakerConfig = route.breaker || api.breaker;
    const breakerKey = route.breaker
        ? `ROUTE:${api.name}:${route.name}`
        : `API:${api.name}`;

    if (breakerConfig) {
        const check = checkCircuitBreaker(breakerKey, breakerConfig);
        if (!check.allowed) {
            throw new CircuitOpenError(
                `Circuit breaker open for ${route.breaker ? `${api.name}.${route.name}` : `${api.name} API`}. Try again in ${Math.ceil(check.retryAfterMs / 1000)} seconds.`,
                check.retryAfterMs
            );
        }
    }

    let response;
    let success = false;
    let attempt = 0;

    while (attempt <= maxRetries && !success) {
        try {
            token?.assertActive();
            if (route.callbacks?.call) {
                route.callbacks.call({});
            } else if (api.callbacks?.call) {
                api.callbacks.call({});
            }
            response = timeoutCfg
                ? await runWithTimeout(
                    (signal, assertActive) => fetchData(cacheOptions, url, { ...init, signal }, assertActive),
                    timeoutCfg,
                    callerSignal,
                    token && ((abort): void => token.bindAbort(abort))
                )
                : await fetchCancellable(cacheOptions, url, init, token);
            success = true;
        } catch (error: unknown) {
            attempt++;
            if (attempt > maxRetries) {
                if (breakerConfig) reportCircuitBreakerResult(breakerKey, breakerConfig, false);
                // If no retries were configured, throw the original error
                if (maxRetries === 0 && error instanceof Error) {
                    throw error;
                }
                const cause = error instanceof Error ? error : undefined;
                throw new RetryExhaustedError(
                    `Failed to fetch ${url} after ${maxRetries + 1} attempts`,
                    attempt,
                    cause
                );
            }
            // Exponential backoff with jitter: base * 2^attempt + random jitter
            const baseDelay = 200;
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
            await new Promise(resolve => setTimeout(resolve, delay));
            token?.assertActive();
        }
    }

    if (breakerConfig && success) reportCircuitBreakerResult(breakerKey, breakerConfig, true);

    return response;
}
/**
 * Replaces URL parameter placeholders with actual values
 *
 * @param url - URL template with parameter placeholders
 * @param route - Route element containing parameter definitions
 * @param args - Parameter values to insert
 * @returns URL with parameters replaced
 * @throws Error if a required parameter is missing
 */
function applyArgs (url: string, route: IElement, args: IArgs): string {
    let newUrl = url;
    route.arguments.forEach(arg => {
        const value = args[arg];
        if (value === undefined) {
            throw new MissingArgumentError(arg);
        }
        newUrl = newUrl.replace(`[${arg}]`, encodeURIComponent(String(value)));
    });
    return newUrl;
}

/**
 * Runs all registered global "before" middlewares in registration order, ahead of the
 * element-level (route) before hook. Each middleware receives the output of the previous one,
 * so partial overrides accumulate down the chain — mirroring how a single local `before`
 * callback would modify `url`/`config`.
 *
 * See {@link registerGlobalBefore} for the full documented execution order.
 *
 * @param params - Object containing route, API, URL, and config
 * @param params.route - Route element being called
 * @param params.api - API element containing the route
 * @param params.url - URL after arguments replacement
 * @param params.config - Fetch configuration to send
 * @returns The (possibly modified) request parameters, ready for {@link applyBefore}
 */
function applyGlobalBefore ({ route, api, url, config }: ICallbackBeforeArgs): ICallbackBeforeArgs {
    return globalCallbacks.before.reduce<ICallbackBeforeArgs>((acc, callback) => {
        const result = callback(acc);
        return {
            route: result?.route || acc.route,
            api: result?.api || acc.api,
            url: result?.url || acc.url,
            config: result?.config || acc.config
        };
    }, { route, api, url, config });
}

/**
 * Runs all registered global "after" middlewares in registration order, after the
 * element-level (route) after hook has already run. Each middleware receives the output of the
 * previous one (starting from the local `applyAfter` result), so partial overrides accumulate
 * down the chain.
 *
 * See {@link registerGlobalBefore} for the full documented execution order.
 *
 * @param localResult - Result already produced by {@link applyAfter} (route-level after hook)
 * @param localResult.afterRoute - Route element, possibly overridden by the route after hook
 * @param localResult.afterApi - API element, possibly overridden by the route after hook
 * @param localResult.afterResponse - Raw response, possibly overridden by the route after hook
 * @param localResult.afterData - Parsed data, possibly overridden by the route after hook
 * @returns The (possibly modified) response parameters, in the same shape as {@link applyAfter}
 */
function applyGlobalAfter (localResult: {
    afterRoute: IElement;
    afterApi: IElement;
    afterResponse: unknown;
    afterData: unknown;
}): {
    afterRoute: IElement;
    afterApi: IElement;
    afterResponse: unknown;
    afterData: unknown;
} {
    return globalCallbacks.after.reduce((acc, callback) => {
        const result = callback({
            route: acc.afterRoute,
            api: acc.afterApi,
            response: acc.afterResponse,
            data: acc.afterData
        });
        return {
            afterRoute: result?.route || acc.afterRoute,
            afterApi: result?.api || acc.afterApi,
            afterResponse: result?.response || acc.afterResponse,
            afterData: result?.data || acc.afterData
        };
    }, localResult);
}

/**
 * Applies before-request middleware to modify request parameters
 *
 * @param params - Object containing route, API, URL, and config
 * @param params.route - Route element being called
 * @param params.api - API element containing the route
 * @param params.url - URL after arguments replacement
 * @param params.config - Fetch configuration to send
 * @returns Modified request parameters
 */
function applyBefore ({ route, api, url, config }: {
    route: IElement;
    api: IElement;
    url: string;
    config: Record<string, unknown>;
}): {
    beforeRoute: IElement;
    beforeApi: IElement;
    beforeUrl: string;
    beforeConfig: Record<string, unknown>;
} {
    const beforeRes = route.callbacks.before?.({ route, api, url, config });
    return {
        beforeRoute: beforeRes?.route || route,
        beforeApi: beforeRes?.api || api,
        beforeUrl: beforeRes?.url || url,
        beforeConfig: beforeRes?.config || config
    };
}

/**
 * Applies after-request middleware to modify response data
 *
 * @param params - Object containing route, API, response, and data
 * @param params.route - Route element that was called
 * @param params.api - API element containing the route
 * @param params.response - Raw fetch Response object
 * @param params.data - Parsed response data
 * @returns Modified response parameters
 */
function applyAfter ({ route, api, response, data }: {
    route: IElement;
    api: IElement;
    response: unknown;
    data: unknown;
}): {
    afterRoute: IElement;
    afterApi: IElement;
    afterResponse: unknown;
    afterData: unknown;
} {
    const afterRes = route.callbacks.after?.({ route, api, response, data });
    return {
        afterRoute: afterRes?.route || route,
        afterApi: afterRes?.api || api,
        afterResponse: afterRes?.response || response,
        afterData: afterRes?.data || data
    };
}
