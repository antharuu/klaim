import toCamelCase from "../tools/toCamelCase";

import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";
import { Route } from "./Route";

/**
 * Represents a callback function that is used for declaring routes in an API
 *
 * @callback IApiCallback
 * @returns {void}
 */
export type IApiCallback = () => void;
/**
 * Represents an API
 */
export class Api extends Element {
    public routes: Map<string, Route> = new Map<string, Route>();

    /**
     * Creates a new API
     *
     * @param name - The name of the API
     * @param url - The base URL of the API
     * @param callback - The callback function that declares the routes of the API
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
}
