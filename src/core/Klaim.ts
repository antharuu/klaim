import {IRoute} from "./Route";
import {IApi} from "./Api";

export interface IRouteReference {
    [key: string]: <T>(...args: any[]) => Promise<T>;
}

export interface IApiReference {
    [key: string]: IRouteReference;
}

export const Klaim: IApiReference = {}

export async function callApi<T>(api: IApi, route: IRoute, ...args: any[]): Promise<T> {
    console.log(`Calling ${api.name}.${route.name}`);

    const url = applyArgs(`${api.url}/${route.url}`, route, args);

    console.log(`URL: ${url}`);

    // Fetch the data
    const response = await fetch(url, {
        method: route.method,
        headers: {
            ...api.headers,
            ...route.headers,
        }
    });

    // Parse the JSON
    const data = await response.json();

    // Return the data
    return data;
}

function applyArgs(url: string, route: IRoute, args: any[]) {
    // Check if the number of arguments is correct
    if (args.length !== route.arguments.size) {
        throw new Error(`Invalid number of arguments for route ${route.name}`);
    }

    // Replace the arguments in the URL
    let i = 0;
    for (const arg of route.arguments) {
        url = url.replace(`[${arg}]`, args[i]);
        i++;
    }

    return url;
}
