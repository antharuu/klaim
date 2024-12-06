import toCamelCase from "../tools/toCamelCase";

import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";

/**
 * Callback function type for API configuration.
 * This callback is executed during API creation to define routes and configurations.
 */
export type IApiCallback = () => void;

/**
 * Represents an API endpoint configuration.
 * The Api class provides a way to define and configure API endpoints with their base URLs,
 * headers, and related routes.
 *
 * @example
 * ```typescript
 * Api.create("myApi", "https://api.example.com", () => {
 *   // Define routes and configurations here
 * }, { Authorization: "Bearer token" });
 * ```
 */
export class Api extends Element {
    /**
     * Creates a new API instance and registers it in the global Registry.
     *
     * @param name - The name of the API. Will be converted to camelCase if necessary
     * @param url - The base URL for the API
     * @param callback - Configuration callback where routes and other settings are defined
     * @param headers - Optional headers to be included with all requests to this API
     * @returns The created API instance
     * @throws Error if the API registration fails
     * @example
     * ```typescript
     * Api.create("userApi", "https://api.users.com", () => {
     *   Route.get("getUser", "/users/[id]");
     * }, { "API-Key": "secret" });
     * ```
     */
    public static create (
        name: string,
        url: string,
        callback: IApiCallback,
        headers: IHeaders = {}
    ): Element {
        const newName = toCamelCase(name);
        if (newName !== name) {
            console.warn(`API name "${name}" has been camelCased to "${newName}"`);
        }

        const api = new Api(newName, url, headers);
        Registry.i.registerElement(api);
        Registry.i.setCurrentParent(newName);

        callback();
        Registry.i.clearCurrentParent();
        return api;
    }

    /**
     * Creates a new Api instance.
     * Private constructor to ensure APIs are only created through the static create method.
     *
     * @param name - The camelCased name of the API
     * @param url - The base URL for the API
     * @param headers - Optional headers to be included with all requests to this API
     */
    private constructor (
        name: string,
        url: string,
        headers: IHeaders = {}
    ) {
        super("api", name, url, headers);
    }
}
