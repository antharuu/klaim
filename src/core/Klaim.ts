import { Api } from "./Api";
import { Route, RouteMethod } from "./Route";

export type IArgs = Record<string, unknown>;

export type IBody = Record<string, unknown>;

export type IRouteReference = Record<string, <T>(args?: IArgs, body?: IBody) => Promise<T>>;

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
export async function callApi<T> (api: Api, route: Route, args: IArgs = {}, body: IBody = {}): Promise<T> {
    const url = applyArgs(`${api.url}/${route.url}`, route, args);

    const config: Record<string, unknown> = {};

    if (body && route.method !== RouteMethod.GET) {
        config.body = JSON.stringify(body);
    }

    config.headers = {
        "Content-Type": "application/json",
        ...api.headers,
        ...route.headers
    };

    config.method = route.method;

    const response = await fetch(url, config);

    const data = await response.json();
    return data as T;
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

        newUrl = newUrl.replace(`[${arg}]`, <string>args[arg]);
    });

    return newUrl;
}
