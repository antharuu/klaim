import { Api, IHeaders } from "./Api";
import { Registry } from "./Registry";
import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

export enum RouteMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    OPTIONS = "OPTIONS",
}

interface IRoute {
    api: Api['name'];
    name: string;
    url: string;
    method: RouteMethod;
    headers: IHeaders;
    arguments: Set<string>;
}

export class Route implements IRoute {
    public api: Api['name'] = "undefined";
    public name: string;
    public url: string;
    public method: RouteMethod;
    public headers: IHeaders;
    public arguments: Set<string> = new Set<string>();

    private constructor(name: string, url: string, headers: IHeaders, method: RouteMethod = RouteMethod.GET) {
        this.name = toCamelCase(name);
        if (this.name !== name) {
            console.warn(`Route name "${name}" has been camelCased to "${this.name}"`);
        }

        this.url = cleanUrl(url);
        this.headers = headers || {};
        this.method = method;

        this.detectArguments();
    }

    private static createRoute(name: string, url: string, headers: IHeaders, method: RouteMethod): Route {
        const route = new Route(name, url, headers, method);
        Registry.i.registerRoute(route as Route);
        return route;
    }

    public static get(name: string, url: string, headers: IHeaders = {}): Route {
        return this.createRoute(name, url, headers, RouteMethod.GET);
    }

    public static post(name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.POST);
    }

    public static put(name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.PUT);
    }

    public static delete(name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.DELETE);
    }

    public static patch(name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.PATCH);
    }

    public static options(name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.OPTIONS);
    }

    private detectArguments() {
        const matches = this.url.match(/\[([^\]]+)]/g);
        if (matches) {
            matches.forEach((match) => {
                const key = match.replace(/\[|]/g, "");
                this.arguments.add(key);
            });
        }
    }
}
