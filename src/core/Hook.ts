/**
 * Callback function type for hook event handlers.
 * Represents functions that will be executed when a hook is triggered.
 */
type IHookCallback = () => any;

/**
 * Provides a simple event system for route-based hooks.
 * Allows subscribing to and triggering events based on route names.
 *
 * @example
 * ```typescript
 * // Subscribe to a route's events
 * Hook.subscribe("api.users.list", () => {
 *   console.log("Users list route was called");
 * });
 *
 * // Later, when the route is called
 * Hook.run("api.users.list"); // Triggers the callback
 * ```
 */
export class Hook {
    /**
     * Internal storage for hook callbacks.
     * Maps route names to their corresponding callback functions.
     *
     * @private
     */
    private static _callbacks: Map<string, IHookCallback> = new Map<string, IHookCallback>();

    /**
     * Registers a callback function for a specific route.
     * If a callback already exists for the route, it will be replaced.
     *
     * @param routeName - The fully qualified name of the route (e.g., "api.users.list")
     * @param callback - The function to execute when the hook is triggered
     * @example
     * ```typescript
     * Hook.subscribe("api.users.create", () => {
     *   analytics.trackEvent("User Created");
     * });
     * ```
     */
    public static subscribe (routeName: string, callback: IHookCallback): void {
        this._callbacks.set(routeName, callback);
    }

    /**
     * Triggers the callback function associated with a route.
     * If no callback is registered for the route, the call is silently ignored.
     *
     * @param routeName - The fully qualified name of the route (e.g., "api.users.list")
     * @example
     * ```typescript
     * // This will trigger the callback if one is registered
     * Hook.run("api.users.create");
     *
     * // This will do nothing if no callback is registered
     * Hook.run("nonexistent.route");
     * ```
     */
    public static run (routeName: string): void {
        const callback = this._callbacks.get(routeName);
        if (!callback) {
            return;
        }

        callback();
    }
}
