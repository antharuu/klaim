import fetchWithCache from "../tools/fetchWithCache";

import {IElement} from "./Element";
import {Hook} from "./Hook";
import {Registry} from "./Registry";

/**
 * Type representing key-value pairs for route arguments
 */
export type IArgs = Record<string, unknown>;

/**
 * Type representing request body data structure
 */
export type IBody = Record<string, unknown>;

/**
 * Generic function type for route handlers with optional arguments and body
 */
export type RouteFunction = {
    <T>(args?: IArgs, body?: IBody): Promise<T>;
    [key: string]: any;
};

/**
 * Type representing a nested structure of route references
 */
export type IRouteReference = {
    [key: string]: RouteFunction | IRouteReference;
};

/**
 * Type representing API references containing route references
 */
export type IApiReference = Record<string, IRouteReference>;

/**
 * Global Klaim object that provides access to all registered APIs and their routes
 * @example
 * ```typescript
 * // Access a route
 * await Klaim.apiName.routeName();
 *
 * // Access a grouped route
 * await Klaim.apiName.groupName.routeName();
 * ```
 */
export const Klaim: IApiReference = {};

/**
 * Executes an API call for a specific route with optional arguments and body
 *
 * @param parent - Parent path in dot notation (e.g., "api.group")
 * @param element - Route element to be called
 * @param args - URL parameters for the route
 * @param body - Request body data
 * @returns Promise resolving to the API response
 * @throws Error if the path is invalid or required arguments are missing
 * @example
 * ```typescript
 * const response = await callApi<UserData>(
 *   "users",
 *   userRoute,
 *   { id: "123" },
 *   { name: "John" }
 * );
 * ```
 */
export async function callApi<T>(
    parent: string,
    element: IElement,
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
    } = applyBefore({route: element, api, url, config});

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
    } = applyAfter({route: element, api, response, data: response});

    Registry.updateElement(afterApi);
    Registry.updateElement(afterRoute);

    Hook.run(`${api.name}.${element.name}`);

    return afterData as T;
}

/**
 * Fetches data from an API with optional caching
 *
 * @param withCache - Whether to use caching
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @param api - API element containing cache settings
 * @returns Promise resolving to the parsed response
 */
async function fetchData(
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
 * Performs a fetch request with retry capability
 *
 * @param api - API element containing retry settings
 * @param route - Route element containing retry settings
 * @param url - The URL to fetch from
 * @param config - Fetch configuration options
 * @returns Promise resolving to the parsed response
 * @throws Error after all retry attempts fail
 */
async function fetchWithRetry(
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
 * Replaces URL parameter placeholders with actual values
 *
 * @param url - URL template with parameter placeholders
 * @param route - Route element containing parameter definitions
 * @param args - Parameter values to insert
 * @returns URL with parameters replaced
 * @throws Error if a required parameter is missing
 */
function applyArgs(url: string, route: IElement, args: IArgs): string {
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
 * Applies before-request middleware to modify request parameters
 *
 * @param params - Object containing route, API, URL, and config
 * @returns Modified request parameters
 */
function applyBefore({route, api, url, config}: {
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
    const beforeRes = route.callbacks.before?.({route, api, url, config});
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
 * @returns Modified response parameters
 */
function applyAfter({route, api, response, data}: {
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
    const afterRes = route.callbacks.after?.({route, api, response, data});
    return {
        afterRoute: afterRes?.route || route,
        afterApi: afterRes?.api || api,
        afterResponse: afterRes?.response || response,
        afterData: afterRes?.data || data
    };
}
