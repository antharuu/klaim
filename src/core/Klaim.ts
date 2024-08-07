import fetchWithCache from "../tools/fetchWithCache";

import { Api } from "./Api";
import { ICallbackAfterArgs, ICallbackBeforeArgs } from "./Element";
import { Hook } from "./Hook";
import { Registry } from "./Registry";
import { Route, RouteMethod } from "./Route";

export type IArgs = Record<string, unknown>;

export type IBody = Record<string, unknown>;

export type IRouteReference = Record<
    string,
    <T>(args?: IArgs, body?: IBody) => Promise<T>
>;

export type IApiReference = Record<string, IRouteReference>;

export const Klaim: IApiReference = {};

/**
 * Calls an API route
 *
 * @param api - The API to call
 * @param route - The route to call
 * @param args - The arguments to pass to the route
 * @param body - The body to pass to the route
 * @returns The response
 */
export async function callApi<T> (
    api: Api,
    route: Route,
    args: IArgs = {},
    body: IBody = {}
): Promise<T> {
    let url = applyArgs(`${api.url}/${route.url}`, route, args);

    let config: Record<string, unknown> = {};

    if (body && route.method !== RouteMethod.GET) {
        config.body = JSON.stringify(body);
    }

    config.headers = {
        "Content-Type": "application/json",
        ...api.headers,
        ...route.headers
    };

    config.method = route.method;

    const {
        beforeRoute,
        beforeApi,
        beforeUrl,
        beforeConfig
    } = applyBefore({ route, api, url, config });
    url = beforeUrl;
    config = beforeConfig;
    api = Registry.updateApi(beforeApi);
    route = Registry.updateRoute(beforeRoute);

    let response = await fetchWithRetry(api, route, url, config);

    if (route.schema && "validate" in route.schema) {
        response = await route.schema.validate(response);
    }

    const {
        afterRoute,
        afterApi,
        afterData
    } = applyAfter({ route, api, response, data: response });
    Registry.updateApi(afterApi);
    Registry.updateRoute(afterRoute);

    Hook.run(`${api.name}.${route.name}`);

    return afterData as T;
}

/**
 * Fetches data from the API
 *
 * @param withCache - Whether to use the cache
 * @param url - The URL to fetch
 * @param config - The fetch config
 * @param api - The API
 * @returns The response
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
 * Fetches data with retries
 *
 * @param api - The API
 * @param route - The route
 * @param url - The URL to fetch
 * @param config - The fetch config
 * @returns The response
 */
async function fetchWithRetry (
    api: Api,
    route: Route,
    url: string,
    config: any
): Promise<any> {
    const withCache = api.cache || route.cache;
    const maxRetries = (route.retry || api.retry) || 0;

    let response;
    let attempt = 0;
    let success = false;
    const callCallback = route.callbacks?.call !== null
        ? route.callbacks?.call
        : api.callbacks?.call;

    while (attempt <= maxRetries && !success) {
        if (callCallback) {
            callCallback({});
        }

        try {
            response = await fetchData(!!withCache, url, config, api);
            success = true;
        } catch (error: any) {
            attempt++;
            if (attempt > maxRetries) {
                error.message
                    = `Failed to fetch ${url} after ${maxRetries} attempts`;
                throw error;
            }
        }
    }

    return response;
}

/**
 * Applies the arguments to the URL
 *
 * @param url - The URL to apply the arguments to
 * @param route - The route to apply the arguments to
 * @param args - The arguments to apply
 * @returns The new URL
 */
function applyArgs (url: string, route: Route, args: IArgs): string {
    let newUrl = url;
    route.arguments.forEach(arg => {
        const value = args[arg];
        if (value === undefined) {
            throw new Error(`Argument ${arg} is missing`);
        }

        newUrl = newUrl.replace(`[${arg}]`, <string> args[arg]);
    });

    return newUrl;
}

/**
 * Applies the before callback
 *
 * @param callbackArgs - The arguments to pass to the callback
 * @param callbackArgs.route - The route
 * @param callbackArgs.api - The API
 * @param callbackArgs.url - The URL
 * @param callbackArgs.config - The config
 * @returns The new args
 */
function applyBefore ({ route, api, url, config }: ICallbackBeforeArgs): {
    beforeRoute: Route;
    beforeApi: Api;
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
 * Applies the after callback
 *
 * @param callbackArgs - The arguments to pass to the callback
 * @param callbackArgs.route - The route
 * @param callbackArgs.api - The API
 * @param callbackArgs.response - The response
 * @param callbackArgs.data - The data
 * @returns The new data
 */
function applyAfter ({ route, api, response, data }: ICallbackAfterArgs): {
    afterRoute: Route;
    afterApi: Api;
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
