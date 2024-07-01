import {IApi, IHeaders} from "./Api";
import {Registry} from "./Registry";
import cleanUrl from "../tools/cleanUrl";
import slugify from "../tools/slugify";
import toCamelCase from "../tools/toCamelCase";

type IRouteDeclaration = (name: string, url: string, headers: IHeaders) => IRoute;

enum RouteMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    OPTIONS = "OPTIONS",
}

export interface IRoute {
    api: IApi['name'];
    name: string;
    url: string;
    method: RouteMethod;
    headers: IHeaders;
    arguments: Set<string>;
}

export class Route implements IRoute {
    public api: IApi['name'] = "undefined";
    public name: string;
    public url: string;
    public method: RouteMethod;
    public headers: IHeaders;
    public arguments: Set<string> = new Set<string>();

    private constructor(name: string, url: string, headers: IHeaders, method: RouteMethod = RouteMethod.GET) {
        this.name = toCamelCase(name)
        if (this.name !== name) {
            console.warn(`Route name "${name}" has been camelCased to "${this.name}"`);
        }

        this.url = cleanUrl(url);
        this.headers = headers || {};
        this.method = method;

        this.detectArguments();
    }

    private static createRoute<T>(name: string, url: string, headers: IHeaders, method: RouteMethod): IRoute {
        const route = new Route(name, url, headers, method);
        Registry.i.registerRoute<T>(route);
        return route;
    }

    public static get<T>(name: string, url: string, headers: IHeaders = {}): IRoute {
        return this.createRoute<T>(name, url, headers, RouteMethod.GET);
    }

    public static post(name: string, url: string, headers: IHeaders): IRoute {
        return this.createRoute(name, url, headers, RouteMethod.POST);
    }

    public static put(name: string, url: string, headers: IHeaders): IRoute {
        return this.createRoute(name, url, headers, RouteMethod.PUT);
    }

    public static delete(name: string, url: string, headers: IHeaders): IRoute {
        return this.createRoute(name, url, headers, RouteMethod.DELETE);
    }

    public static patch(name: string, url: string, headers: IHeaders): IRoute {
        return this.createRoute(name, url, headers, RouteMethod.PATCH);
    }

    public static options(name: string, url: string, headers: IHeaders): IRoute {
        return this.createRoute(name, url, headers, RouteMethod.OPTIONS);
    }

    private detectArguments() {
        // From todo/[id] -> {id: "string"}
        const matches = this.url.match(/\[([^\]]+)\]/g);
        if (matches) {
            matches.forEach((match) => {
                const key = match.replace(/\[|\]/g, "");
                this.arguments.add(key);
            });
        }
    }
}
