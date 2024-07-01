import {Api} from "./Api";
import {Route, RouteMethod} from "./Route";

export interface IArgs {
    [key: string]: unknown;
}

export interface IBody {
    [key: string]: unknown;
}

export interface IRouteReference {
    [key: string]: <T>(args?: IArgs, body?: IBody) => Promise<T>
}

export interface IApiReference {
    [key: string]: IRouteReference;
}

export const Klaim: IApiReference = {};

export async function callApi<T>(api: Api, route: Route, args: IArgs = {}, body: IBody = {}): Promise<T> {
    console.log(`Calling ${api.name}.${route.name}`);

    const url = applyArgs(`${api.url}/${route.url}`, route, args);

    console.log(`URL: ${url}`);

    const config: { [key: string]: unknown; } = {}

    if (body && route.method !== RouteMethod.GET) {
        config.body = JSON.stringify(body);
    }

    config.headers = {
        'Content-Type': 'application/json',
        ...api.headers,
        ...route.headers
    };

    config.method = route.method;

    const response = await fetch(url, config);


    const data = await response.json();
    return data as T;
}

function applyArgs(url: string, route: Route, args: IArgs): string {
    let newUrl = url;
    route.arguments.forEach((arg) => {
        const value = args[arg];
        if (value === undefined) {
            throw new Error(`Argument ${arg} is missing`);
        }

        newUrl = newUrl.replace(`[${arg}]`, <string>args[arg]);
    });

    return newUrl;
}
