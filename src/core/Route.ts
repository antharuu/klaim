import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";

/**
 * Supported HTTP methods for route definitions.
 */
export enum RouteMethod {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    OPTIONS = "OPTIONS"
}

/**
 * Represents an API route with its HTTP method, path, and configuration.
 * Routes define endpoints within an API and handle URL parameter detection.
 *
 * @example
 * ```typescript
 * // Create a GET route with URL parameters
 * Route.get("getUser", "/users/[id]");
 *
 * // Create a POST route with headers
 * Route.post("createUser", "/users", {
 *   "Content-Type": "application/json"
 * });
 * ```
 */
export class Route extends Element {
    /**
     * Creates a new Route instance.
     *
     * @param name - Unique name for the route
     * @param url - URL path for the route, can include parameters in [param] format
     * @param headers - Optional HTTP headers specific to this route
     * @param method - HTTP method for this route
     */
    public constructor (
        name: string,
        url: string,
        headers: IHeaders = {},
        method: RouteMethod = RouteMethod.GET
    ) {
        super("route", name, url, headers);
        this.method = method;
        this.detectArguments();
    }

    /**
     * Internal helper to create and register a new route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @param method - HTTP method
     * @returns The created route element
     * @private
     */
    private static createRoute (
        name: string,
        url: string,
        headers: IHeaders = {},
        method: RouteMethod
    ): Element {
        const route = new Route(name, url, headers, method);
        Registry.i.registerRoute(route);
        return route;
    }

    /**
     * Creates a GET route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @returns The created GET route
     * @example
     * ```typescript
     * Route.get("listUsers", "/users");
     * Route.get("getUser", "/users/[id]");
     * ```
     */
    public static get (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.GET);
    }

    /**
     * Creates a POST route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @returns The created POST route
     * @example
     * ```typescript
     * Route.post("createUser", "/users");
     * ```
     */
    public static post (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.POST);
    }

    /**
     * Creates a PUT route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @returns The created PUT route
     * @example
     * ```typescript
     * Route.put("updateUser", "/users/[id]");
     * ```
     */
    public static put (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.PUT);
    }

    /**
     * Creates a DELETE route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @returns The created DELETE route
     * @example
     * ```typescript
     * Route.delete("deleteUser", "/users/[id]");
     * ```
     */
    public static delete (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.DELETE);
    }

    /**
     * Creates a PATCH route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @returns The created PATCH route
     * @example
     * ```typescript
     * Route.patch("updateUserStatus", "/users/[id]/status");
     * ```
     */
    public static patch (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.PATCH);
    }

    /**
     * Creates an OPTIONS route.
     *
     * @param name - Route name
     * @param url - Route URL path
     * @param headers - Route-specific headers
     * @returns The created OPTIONS route
     * @example
     * ```typescript
     * Route.options("userOptions", "/users");
     * ```
     */
    public static options (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.OPTIONS);
    }

    /**
     * Detects URL parameters in the route path.
     * Parameters are defined using square brackets, e.g., [id] in /users/[id].
     * Detected parameters are stored in the arguments Set.
     *
     * @private
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
     * Sets up response validation using a schema.
     *
     * @param schema - Validation schema (e.g., Yup schema)
     * @returns This route instance for chaining
     * @example
     * ```typescript
     * Route.get("getUser", "/users/[id]")
     *   .validate(userSchema);
     * ```
     */
    public validate (schema: any): Element {
        this.schema = schema;
        return this;
    }
}
