import fetchWithCache, { FetchCacheOptions } from "../tools/fetchWithCache";
import { checkRateLimit, getTimeUntilNextRequest } from "../tools/rateLimit";
import { runWithTimeout } from "../tools/timeout";

import { ICallback, ICallbackAfterArgs, ICallbackBeforeArgs, IElement } from "./Element";
import { InvalidPathError, MissingArgumentError, RateLimitError, RetryExhaustedError } from "./errors";
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
 * Generic function type for route handlers with pagination support
 *
 * @template T - The type of data returned by the route
 */
export type RouteFunction<T = any> = {
    (offset?: number, args?: IArgs, body?: IBody): Promise<T>;
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
 * @param parent - Parent path in dot notation
 * @param element - Route element to bind
 * @returns The generated route function
 */
export function createRouteHandler<T> (
    parent: string,
    element: IElement
): RouteFunction<T> {
    return async (...args: [number?, IArgs?, IBody?] | [IArgs?, IBody?]): Promise<T> => {
        if (element.pagination) {
            const [
                page = 0,
                customArgs = {},
                body = {}
            ] = args as [number?, IArgs?, IBody?];
            return callApi<T>(parent, element, page, customArgs as IArgs, body as IBody);
        }
        const [ customArgs = {}, body = {} ] = args as [IArgs?, IBody?];
        return callApi<T>(parent, element, undefined, customArgs as IArgs, body as IBody);
    };
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
    body: IBody = {}
): Promise<T> {
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

    let response = await fetchWithRetry(api, element, url, config, parent);

    if (element.schema) {
        response = await element.schema.validate(response);
    }

    const {
        afterRoute,
        afterApi,
        afterData
    } = applyGlobalAfter(applyAfter({ route: element, api, response, data: response }));

    Registry.updateElement(afterApi);
    Registry.updateElement(afterRoute);

    Hook.run(`${api.name}.${element.name}`);

    return afterData as T;
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
 * Performs a fetch request with retry capability and rate limiting
 *
 * @param api - API element containing retry settings
 * @param route - Route element containing retry settings
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @param parent - Parent path captured by the route handler
 * @returns Promise resolving to the parsed response
 * @throws Error after all retry attempts fail or if rate limited
 */
async function fetchWithRetry (
    api: IElement,
    route: IElement,
    url: string,
    config: Record<string, unknown>,
    parent: string
): Promise<unknown> {
    const cacheDuration = route.cache || api.cache;
    const cacheOptions: FetchCacheOptions | undefined = cacheDuration
        ? {
            ttl: cacheDuration * 1000,
            namespace: `${parent}.${route.name}`,
            policy: route.responsePolicy ?? api.responsePolicy ?? "legacy"
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

    let response;
    let success = false;
    let attempt = 0;

    while (attempt <= maxRetries && !success) {
        try {
            if (route.callbacks?.call) {
                route.callbacks.call({});
            } else if (api.callbacks?.call) {
                api.callbacks.call({});
            }
            response = timeoutCfg
                ? await runWithTimeout(
                    (signal, assertActive) => fetchData(cacheOptions, url, { ...init, signal }, assertActive),
                    timeoutCfg,
                    callerSignal
                )
                : await fetchData(cacheOptions, url, init);
            success = true;
        } catch (error: unknown) {
            attempt++;
            if (attempt > maxRetries) {
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
        }
    }

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
