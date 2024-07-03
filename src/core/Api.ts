import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

import { Registry } from "./Registry";
import { Route } from "./Route";

interface IApi {
    name: string;
    url: string;
    headers: IHeaders;
    routes: Map<string, Route>;
    cache: false | number;

    withCache: (duration?: number) => this;
}

export type IApiCallback = () => void;
export type IHeaders = Record<string, string>;

/**
 * Represents an API
 */
export class Api implements IApi {
    public name: string;

    public url: string;

    public headers: IHeaders;

    public routes: Map<string, Route> = new Map<string, Route>();

    public cache: false | number = false;

    /**
     * Constructor
     *
     * @param name - The name of the API
     * @param url - The base URL of the API
     * @param headers - The headers to be sent with each request
     */
    private constructor (name: string, url: string, headers: IHeaders = {}) {
        this.name = name;
        this.url = cleanUrl(url);
        this.headers = headers;
    }

    /**
     * Creates a new API
     *
     * @param name - The name of the API
     * @param url - The base URL of the API
     * @param callback - The callback to define the routes
     * @param headers - The headers to be sent with each request
     * @returns The new API
     */
    public static create (
        name: string,
        url: string,
        callback: IApiCallback,
        headers: IHeaders = {}
    ): Api {
        const newName = toCamelCase(name);
        if (newName !== name) {
            console.warn(`API name "${name}" has been camelCased to "${newName}"`);
        }
        const api = new Api(newName, url, headers);
        Registry.i.registerApi(api);
        Registry.i.setCurrent(newName);
        callback();
        Registry.i.clearCurrent();
        return api;
    }

    /**
     * Enables caching for the API
     *
     * @param duration - The duration to cache the response for seconds (default: 20)
     * @returns The API
     */
    public withCache (duration = 20): this {
        this.cache = duration;
        return this;
    }
}
