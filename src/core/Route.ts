import { Api } from "./Api";
import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";

export enum RouteMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    OPTIONS = "OPTIONS"
}

/**
 * Represents a route
 */
export class Route extends Element {
    public api: Api["name"] = "undefined";

    public method: RouteMethod;

    public arguments: Set<string> = new Set<string>();

    public schema: any;

    /**
     * Constructor
     *
     * @param name - The name of the route
     * @param url - The URL of the route
     * @param headers - The headers to be sent with the request
     * @param method - The HTTP method of the route
     */
    private constructor (
        name: string,
        url: string,
        headers: IHeaders,
        method: RouteMethod = RouteMethod.GET
    ) {
        super(name, url, headers);
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
    private static createRoute (
        name: string,
        url: string,
        headers: IHeaders,
        method: RouteMethod
    ): Route {
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
    public static get (
        name: string,
        url: string,
        headers: IHeaders = {}
    ): Route {
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
     * Detects the arguments in the URL
     */
    private detectArguments (): void {
        const matches = this.url.match(/\[([^\]]+)]/g);
        if (matches) {
            matches.forEach(match => {
                const key = match.replace("[", "").replace("]", "");
                this.arguments.add(key);
            });
        }
    }

    /**
     * Schema validation (Yup)
     *
     * @param schema - The schema to validate
     * @returns The route
     */
    public validate (schema: any): Route {
        this.schema = schema;
        return this;
    }
}
