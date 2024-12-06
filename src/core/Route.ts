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

export class Route extends Element {
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

    public static get (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.GET);
    }

    public static post (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.POST);
    }

    public static put (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.PUT);
    }

    public static delete (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.DELETE);
    }

    public static patch (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.PATCH);
    }

    public static options (name: string, url: string, headers: IHeaders = {}): Element {
        return this.createRoute(name, url, headers, RouteMethod.OPTIONS);
    }

    private detectArguments (): void {
        const matches = this.url.match(/\[([^\]]+)]/g);
        if (matches) {
            matches.forEach(match => {
                const key = match.replace("[", "").replace("]", "");
                this.arguments.add(key);
            });
        }
    }

    public validate (schema: any): Element {
        this.schema = schema;
        return this;
    }
}
