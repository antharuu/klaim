import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

import { Api, IHeaders } from "./Api";
import { Registry } from "./Registry";

export enum RouteMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    OPTIONS = "OPTIONS"
}

export interface ICallbackBefore {
    route: Route;
    api: Api;
    url: string;
    config: Record<string, unknown>;
}

export interface ICallbackAfter {
    route: Route;
    api: Api;
    response: Response;
    data: any;
}

interface IRouteCallbacks {
    before: ((args: ICallbackBefore) => (Partial<ICallbackBefore> | void)) | null;
    after: ((args: ICallbackAfter) => (Partial<ICallbackAfter> | void)) | null;
}

interface IRoute {
    api: Api["name"];
    name: string;
    url: string;
    method: RouteMethod;
    headers: IHeaders;
    arguments: Set<string>;
    callbacks: IRouteCallbacks;

    before: (callback: (args: ICallbackBefore) => (Partial<ICallbackBefore> | void)) => Route;
    after: (callback: (args: ICallbackAfter) => (Partial<ICallbackAfter> | void)) => Route;
}

/**
 * Represents a route
 */
export class Route implements IRoute {
    public api: Api["name"] = "undefined";

    public name: string;

    public url: string;

    public method: RouteMethod;

    public headers: IHeaders;

    public arguments: Set<string> = new Set<string>();

    public callbacks: IRouteCallbacks = {
        /**
         * Called before the request is sent
         */
        before: null,
        /**
         * Called after the request is sent and before the data is returned
         */
        after: null
    };

    /**
     * Constructor
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @param method - The HTTP method of the route
     */
    private constructor (name: string, url: string, headers: IHeaders, method: RouteMethod = RouteMethod.GET) {
        this.name = toCamelCase(name);
        if (this.name !== name) {
            console.warn(`Route name "${name}" has been camelCased to "${this.name}"`);
        }

        this.url = cleanUrl(url);
        this.headers = headers || {};
        this.method = method;

        this.detectArguments();
    }

    /**
     * Creates a new route
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @param method - The HTTP method of the route
     * @returns The new route
     */
    private static createRoute (name: string, url: string, headers: IHeaders, method: RouteMethod): Route {
        const route = new Route(name, url, headers, method);
        Registry.i.registerRoute(route as Route);
        return route;
    }

    /**
     * Creates a new route with the GET method
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @returns The new route
     */
    public static get (name: string, url: string, headers: IHeaders = {}): Route {
        return this.createRoute(name, url, headers, RouteMethod.GET);
    }

    /**
     * Creates a new route with the POST method
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @returns The new route
     */
    public static post (name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.POST);
    }

    /**
     * Creates a new route with the PUT method
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @returns The new route
     */
    public static put (name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.PUT);
    }

    /**
     * Creates a new route with the DELETE method
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @returns The new route
     */
    public static delete (name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.DELETE);
    }

    /**
     * Creates a new route with the PATCH method
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @returns The new route
     */
    public static patch (name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.PATCH);
    }

    /**
     * Creates a new route with the OPTIONS method
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @returns The new route
     */
    public static options (name: string, url: string, headers: IHeaders): Route {
        return this.createRoute(name, url, headers, RouteMethod.OPTIONS);
    }

    /**
     * Sets the before callback
     *
     * @param callback - The callback
     * @returns The route
     */
    public before (callback: (args: ICallbackBefore) => (Partial<ICallbackBefore> | void)): this {
        this.callbacks.before = callback;
        return this;
    }

    /**
     * Sets the after callback
     *
     * @param callback - The callback
     * @returns The route
     */
    public after (callback: (args: ICallbackAfter) => (Partial<ICallbackAfter> | void)): this {
        this.callbacks.after = callback;
        return this;
    }

    /**
     * Detects the arguments in the URL
     */
    private detectArguments (): void {
        const matches = this.url.match(/\[([^\]]+)]/g);
        if (matches) {
            matches.forEach(match => {
                const key = match.replace(/\[|]/g, "");
                this.arguments.add(key);
            });
        }
    }
}
