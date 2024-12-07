import fetchWithCache from "../tools/fetchWithCache";

import { IElement } from "./Element";
import { Hook } from "./Hook";
import { Registry } from "./Registry";

/**
 * Arguments object type for dynamic route parameters.
 * Used to replace placeholders in route URLs (e.g., [id] in /users/[id]).
 */
export type IArgs = Record<string, unknown>;

/**
 * Request body type for POST, PUT, and PATCH requests.
 */
export type IBody = Record<string, unknown>;

/**
 * Type definition for route handler functions.
 *
 * @template T - The expected response type from the API
 */
export type RouteFunction = <T>(args?: IArgs, body?: IBody) => Promise<T>;

/**
 * Type for nested route and group references.
 * Allows for both direct route functions and nested group objects.
 */
export interface IRouteReference {
    [key: string]: RouteFunction | IRouteReference;
}

/**
 * Type for the root-level API references.
 * Maps API names to their route collections.
 */
export type IApiReference = Record<string, IRouteReference>;

/**
 * Global Klaim object for accessing defined APIs and routes.
 * Provides a type-safe way to make API calls using the defined structure.
 *
 * @example
 * ```typescript
 * // Call a route without parameters
 * const users = await Klaim.api.users.list();
 *
 * // Call a route with path parameters
 * const user = await Klaim.api.users.getOne({ id: 123 });
 *
 * // Call a route with body data
 * await Klaim.api.users.create({}, { name: "John" });
 * ```
 */
export const Klaim: IApiReference = {};

/**
 * Makes an API call through the defined route configuration.
 * Handles URL construction, middleware execution, caching, retries, and response validation.
 *
 * @template T - Expected response type
 * @param parent - Full path to the parent API/group
 * @param element - Route element configuration
 * @param args - URL parameters for the route
 * @param body - Request body data
 * @returns Promise resolving to the API response
 * @throws Error for invalid paths, missing arguments, or failed requests
 * @example
 * ```typescript
 * const response = await callApi<UserData>(
 *   "userApi",
 *   userRoute,
 *   { id: 123 },
 *   { name: "John" }
 * );
 * ```
 */
export async function callApi<T> (
    parent: string,
    element: IElement,
    args: IArgs = {},
    body: IBody = {}
): Promise<T> {
    // Recherchez l'API dans toute la hiérarchie du chemin parent
    const parentParts = parent.split(".");
    let api: IElement | undefined;
    
    // Parcourir le chemin pour trouver l'API
    for (let i = 0; i < parentParts.length; i++) {
        const potentialApiName = parentParts[i];
        api = Registry.i.getApi(potentialApiName);
        if (api) break;
    }

    if (!element || !api || element.type !== "route" || api.type !== "api") {
        throw new Error(`Invalid path: ${parent}.${element.name}`);
    }

    let url = applyArgs(`${api.url}/${element.url}`, element, args);

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
    } = applyBefore({ route: element, api, url, config });

    url = beforeUrl;
    config = beforeConfig;

    Registry.updateElement(beforeApi);
    Registry.updateElement(beforeRoute);

    let response = await fetchWithRetry(api, element, url, config);

    if (element.schema && "validate" in element.schema) {
        response = await element.schema.validate(response);
    }

    const {
        afterRoute,
        afterApi,
        afterData
    } = applyAfter({ route: element, api, response, data: response });

    Registry.updateElement(afterApi);
    Registry.updateElement(afterRoute);

    Hook.run(`${api.name}.${element.name}`);

    return afterData as T;
}

/**
 * Executes a fetch request with optional caching.
 *
 * @param withCache - Whether to use caching for this request
 * @param url - The URL to fetch
 * @param config - Fetch configuration
 * @param api - The API element containing cache settings
 * @returns Promise resolving to the parsed response data
 */
async function fetchData (
    withCache: boolean,
    url: string,
    config: any,
    api: any
): Promise<any> {
    if (withCache) {
        return await fetchWithCache(url, config, api.cache);
    } else {
        const rawResponse = await fetch(url, config);
        return await rawResponse.json();
    }
}

/**
 * Executes a fetch request with retry logic.
 * Handles both caching and retry mechanisms based on API and route settings.
 *
 * @param api - The API element containing configuration
 * @param route - The route element being called
 * @param url - The constructed URL
 * @param config - Fetch configuration
 * @returns Promise resolving to the response data
 * @throws Error after all retry attempts fail
 */
async function fetchWithRetry (
    api: IElement,
    route: IElement,
    url: string,
    config: any
): Promise<any> {
    const withCache = api.cache || route.cache;
    const maxRetries = (route.retry || api.retry) || 0;
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
            response = await fetchData(!!withCache, url, config, api);
            success = true;
        } catch (error: any) {
            attempt++;
            if (attempt > maxRetries) {
                error.message = `Failed to fetch ${url} after ${maxRetries} attempts`;
                throw error;
            }
        }
    }

    return response;
}

/**
 * Applies URL parameters to the route path.
 * Replaces [parameter] placeholders with actual values.
 *
 * @param url - The URL template
 * @param route - The route element containing parameter definitions
 * @param args - The parameter values to apply
 * @returns The constructed URL with parameters applied
 * @throws Error if any required parameter is missing
 */
function applyArgs (url: string, route: IElement, args: IArgs): string {
    let newUrl = url;
    route.arguments.forEach(arg => {
        const value = args[arg];
        if (value === undefined) {
            throw new Error(`Argument ${arg} is missing`);
        }
        newUrl = newUrl.replace(`[${arg}]`, <string>args[arg]);
    });
    return newUrl;
}

/**
 * Executes before-request middleware for a route.
 * Allows modification of request configuration before execution.
 *
 * @param params - Object containing route, API, URL, and config
 * @param params.route - The route element being called
 * @param params.api - The API element containing the route
 * @param params.url - The fully constructed URL for the request
 * @param params.config - The request configuration object
 * @returns Modified route, API, URL, and config after middleware execution
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
 * Executes after-request middleware for a route.
 * Allows modification of response data after request completion.
 *
 * @param params - Object containing route, API, response, and data
 * @param params.route - The route element that was called
 * @param params.api - The API element containing the route
 * @param params.response - The raw response from the request
 * @param params.data - The parsed response data
 * @returns Modified route, API, response, and data after middleware execution
 */
function applyAfter ({ route, api, response, data }: {
    route: IElement;
    api: IElement;
    response: Response;
    data: any;
}): {
    afterRoute: IElement;
    afterApi: IElement;
    afterResponse: Response;
    afterData: any;
} {
    const afterRes = route.callbacks.after?.({ route, api, response, data });
    return {
        afterRoute: afterRes?.route || route,
        afterApi: afterRes?.api || api,
        afterResponse: afterRes?.response || response,
        afterData: afterRes?.data || data
    };
}
