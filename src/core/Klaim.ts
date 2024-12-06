// Klaim.ts
import fetchWithCache from "../tools/fetchWithCache";

import { IElement } from "./Element";
import { Hook } from "./Hook";
import { Registry } from "./Registry";

export type IArgs = Record<string, unknown>;
export type IBody = Record<string, unknown>;
export type IRouteReference = Record<string, <T>(args?: IArgs, body?: IBody) => Promise<T>>;
export type IApiReference = Record<string, IRouteReference>;
export const Klaim: IApiReference = {};

export async function callApi<T> (
    parent: string,
    element: IElement,
    args: IArgs = {},
    body: IBody = {}
): Promise<T> {
    const api = Registry.i.getApi(parent);

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
