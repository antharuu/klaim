import fetchWithCache from "../tools/fetchWithCache.ts";

import { Api } from "./Api";
import { Hook } from "./Hook";
import { Registry } from "./Registry";
import { ICallbackAfter, ICallbackBefore, Route, RouteMethod } from "./Route";

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

    const withCache = api.cache || route.cache;

    let response;
    if (withCache) {
        response = await fetchWithCache(url, config, api.cache);
    } else {
        const rawResponse = await fetch(url, config);
        response = await rawResponse.json();
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
function applyBefore ({ route, api, url, config }: ICallbackBefore): {
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
function applyAfter ({ route, api, response, data }: ICallbackAfter): {
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
