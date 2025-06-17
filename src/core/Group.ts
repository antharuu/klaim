import { DEFAULT_TIMEOUT_CONFIG } from "../tools/timeout";
import toCamelCase from "../tools/toCamelCase";

import { Element, ICallback, ICallbackAfterArgs, ICallbackBeforeArgs, ICallbackCallArgs, IHeaders } from "./Element";
import { Registry } from "./Registry";

/**
 * Callback function type for group configuration.
 * Executed during group creation to define routes and nested groups.
 */
type GroupCallback = () => void;

/**
 * Groups related routes together and provides shared configuration.
 * Supports nested grouping, middleware inheritance, and common settings for all child routes.
 *
 * @example
 * ```typescript
 * // Inside an API
 * Api.create("api", "https://api.example.com", () => {
 *   Group.create("users", () => {
 *     Route.get("list", "/users");
 *     Route.get("getOne", "/users/[id]");
 *   }).withCache(60); // Cache all routes for 60 seconds
 * });
 *
 * // Or grouping APIs
 * Group.create("shared", () => {
 *   Api.create("users", "https://users-api.com", () => {
 *     Route.get("list", "/users");
 *   });
 *   Api.create("posts", "https://posts-api.com", () => {
 *     Route.get("list", "/posts");
 *   });
 * });
 * ```
 */
export class Group extends Element {
    /**
     * Creates a new group and registers it in the Registry.
     * Supports nested groups and inheritable configurations.
     * Can contain both Routes (when inside an API) and APIs (when at root level).
     *
     * @param name - Name of the group (will be converted to camelCase)
     * @param callback - Configuration callback for defining routes, nested groups or APIs
     * @returns The created group instance
     * @throws Error if group creation fails or parent context is invalid
     * @example
     * ```typescript
     * // Group routes within an API
     * Group.create("admin", () => {
     *   Route.get("list", "/admin/users");
     * });
     *
     * // Group multiple APIs
     * Group.create("shared", () => {
     *   Api.create("users", "https://users-api.com", () => {
     *     Route.get("list", "/users");
     *   });
     * });
     * ```
     */
    public static create (name: string, callback: GroupCallback): Element {
        const camelCasedName = toCamelCase(name);

        // Get current parent to build full path
        const currentParent = Registry.i.getCurrentParent();
        const parentPath = currentParent ? Registry.i.getFullPath(currentParent) : "";
        const fullName = parentPath ? `${parentPath}.${camelCasedName}` : camelCasedName;

        // Create the group with the camelCased name
        const group = new Group(camelCasedName, "");

        if (camelCasedName !== name) {
            console.warn(`Group name "${name}" has been camelCased to "${camelCasedName}"`);
        }

        // Register the group at the appropriate level
        Registry.i.registerElement(group);

        // Save current parent state
        const previousParent = Registry.i.getCurrentParent();

        // Set this group as the current parent using full path with camelCased name
        Registry.i.setCurrentParent(fullName);

        // Execute the callback in the group's context
        callback();

        // Restore the previous parent or clear if none
        if (previousParent) {
            Registry.i.setCurrentParent(Registry.i.getFullPath(previousParent));
        } else {
            Registry.i.clearCurrentParent();
        }

        return group;
    }

    /**
     * Creates a new Group instance.
     * Private constructor to ensure groups are only created through the static create method.
     *
     * @param name - The camelCased name of the group
     * @param url - Base URL for the group (usually empty)
     * @param headers - Optional headers shared by all routes in the group
     * @private
     */
    private constructor (name: string, url: string, headers: IHeaders = {}) {
        super("group", name, url, headers);
    }

    /**
     * Enables caching for the group and all its children (routes and APIs).
     * Children can override the cache duration with their own settings.
     *
     * @param duration - Cache duration in seconds (default: 20)
     * @returns this group instance for chaining
     * @example
     * ```typescript
     * Group.create("shared", () => {
     *   Api.create("users", "https://api.users.com", () => {
     *     Route.get("list", "/users");
     *   });
     * }).withCache(300);
     * ```
     */
    public withCache (duration = 20): this {
        super.withCache(duration);
        // Propagate cache settings to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.cache) {
                    child.cache = duration;
                }
            });
        return this;
    }

    /**
     * Enables retry mechanism for the group and all its children (routes and APIs).
     * Children can override the retry count with their own settings.
     *
     * @param maxRetries - Maximum number of retry attempts (default: 2)
     * @returns this group instance for chaining
     * @example
     * ```typescript
     * Group.create("shared", () => {
     *   Api.create("users", "https://api.users.com", () => {
     *     Route.get("list", "/users");
     *   });
     * }).withRetry(3);
     * ```
     */
    public withRetry (maxRetries = 2): this {
        super.withRetry(maxRetries);
        // Propagate retry settings to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.retry) {
                    child.retry = maxRetries;
                }
            });
        return this;
    }

    /**
     * Enables request timeout for the group and its children.
     * Children can override with their own timeout configuration.
     *
     * @param duration
     * @param message
     */
    public withTimeout (duration = DEFAULT_TIMEOUT_CONFIG.duration, message = DEFAULT_TIMEOUT_CONFIG.message): this {
        super.withTimeout(duration, message);
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.timeout) {
                    child.timeout = { duration, message };
                }
            });
        return this;
    }

    /**
     * Adds a before-request middleware to the group and all its children.
     * Children can override this middleware with their own.
     *
     * @param callback - Middleware function to execute before requests
     * @returns this group instance for chaining
     * @example
     * ```typescript
     * Group.create("shared", () => {
     *   Api.create("users", "https://api.users.com", () => {
     *     Route.get("list", "/users");
     *   });
     * }).before(({ config }) => {
     *   config.headers.Authorization = getSharedToken();
     * });
     * ```
     */
    public before (callback: ICallback<ICallbackBeforeArgs>): this {
        super.before(callback);
        // Propagate before callback to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.callbacks.before) {
                    child.callbacks.before = callback;
                }
            });
        return this;
    }

    /**
     * Adds an after-request middleware to the group and all its children.
     * Children can override this middleware with their own.
     *
     * @param callback - Middleware function to execute after requests
     * @returns this group instance for chaining
     * @example
     * ```typescript
     * Group.create("shared", () => {
     *   Api.create("users", "https://api.users.com", () => {
     *     Route.get("list", "/users");
     *   });
     * }).after(({ data }) => {
     *   console.log(`Fetched from shared API`);
     * });
     * ```
     */
    public after (callback: ICallback<ICallbackAfterArgs>): this {
        super.after(callback);
        // Propagate after callback to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.callbacks.after) {
                    child.callbacks.after = callback;
                }
            });
        return this;
    }

    /**
     * Adds a request lifecycle middleware to the group and all its children.
     * Children can override this middleware with their own.
     *
     * @param callback - Middleware function to execute during requests
     * @returns this group instance for chaining
     * @example
     * ```typescript
     * Group.create("shared", () => {
     *   Api.create("users", "https://api.users.com", () => {
     *     Route.get("list", "/users");
     *   });
     * }).onCall(() => {
     *   metrics.incrementSharedApiCalls();
     * });
     * ```
     */
    public onCall (callback: ICallback<ICallbackCallArgs>): this {
        super.onCall(callback);
        // Propagate onCall callback to existing children
        Registry.i.getChildren(Registry.i.getFullPath(this))
            .forEach(child => {
                if (!child.callbacks.call) {
                    child.callbacks.call = callback;
                }
            });
        return this;
    }
}
