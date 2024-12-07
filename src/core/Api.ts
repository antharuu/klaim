import toCamelCase from "../tools/toCamelCase";
import {Element, IHeaders} from "./Element";
import {Registry} from "./Registry";

/**
 * Callback function type for API configuration
 * Used to define routes and other API settings within a creation context
 */
export type IApiCallback = () => void;

/**
 * Represents an API endpoint with configuration and route management.
 * Handles API creation, registration, and hierarchical organization within groups.
 *
 * @example
 * ```typescript
 * Api.create("users", "https://api.example.com", () => {
 *   Route.get("list", "/users");
 *   Route.post("create", "/users");
 * });
 * ```
 */
export class Api extends Element {
    /**
     * Creates and registers a new API instance with the given configuration
     *
     * @param name - Name of the API (will be converted to camelCase)
     * @param url - Base URL for the API
     * @param callback - Configuration callback for defining routes and settings
     * @param headers - Optional default headers for all routes
     * @returns The created API element
     * @throws Error if API creation or registration fails
     * @example
     * ```typescript
     * Api.create("userApi", "https://api.users.com", () => {
     *   Route.get("getUser", "/users/[id]");
     * }, {
     *   "Authorization": "Bearer token"
     * });
     * ```
     */
    public static create(
        name: string,
        url: string,
        callback: IApiCallback,
        headers: IHeaders = {}
    ): Element {
        const newName = toCamelCase(name);
        if (newName !== name) {
            console.warn(`API name "${name}" has been camelCased to "${newName}"`);
        }

        // Create API instance
        const api = new Api(newName, url, headers);

        // Store current parent context
        const currentParent = Registry.i.getCurrentParent();

        // Register the API
        Registry.i.registerElement(api);

        // Get the full API path considering any parents
        const parentPath = currentParent ? Registry.i.getFullPath(currentParent) : '';
        const apiFullPath = parentPath ? `${parentPath}.${newName}` : newName;

        // Set this API as current parent
        Registry.i.setCurrentParent(apiFullPath);

        // Execute callback inside API context
        callback();

        // Important: Only restore parent context after route creation
        if (currentParent) {
            Registry.i.setCurrentParent(Registry.i.getFullPath(currentParent));
        } else {
            Registry.i.clearCurrentParent();
        }

        return api;
    }

    /**
     * Creates a new API instance
     * Private constructor to ensure APIs are only created through the static create method
     *
     * @param name - The camelCased name of the API
     * @param url - Base URL for the API
     * @param headers - Optional default headers for all routes
     * @private
     */
    private constructor(
        name: string,
        url: string,
        headers: IHeaders = {}
    ) {
        super("api", name, url, headers);
    }
}
