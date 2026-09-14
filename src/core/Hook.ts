/**
 * Callback function type for hook event handlers.
 * Represents functions that will be executed when a hook is triggered.
 */
type IHookCallback = () => any;

/**
 * Payload passed to global observers on every route call, successful or not.
 * Used by cross-cutting concerns (e.g. Stats) that must observe all routes
 * without competing with the single-callback-per-route `subscribe` API.
 */
export interface IHookEventPayload {
    /** Whether the call completed without throwing. */
    success: boolean;
    /** Total call duration in milliseconds, measured around the request lifecycle. */
    durationMs: number;
    /** Whether the response was served from cache instead of a network fetch. */
    cacheHit: boolean;
    /** The error thrown by the call, present only when `success` is false. */
    error?: unknown;
}

/**
 * Callback function type for global (all-routes) hook observers.
 *
 * @param routeName - The fully qualified name of the route that was called
 * @param payload - Details about the call outcome
 */
export type IHookObserver = (routeName: string, payload: IHookEventPayload) => void;

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
     * Internal storage for global observers that watch every route call.
     * Unlike `_callbacks`, this supports multiple independent listeners so
     * cross-cutting concerns (e.g. Stats) never conflict with user hooks.
     *
     * @private
     */
    private static _observers: Set<IHookObserver> = new Set<IHookObserver>();

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

    /**
     * Removes a specific hook callback.
     *
     * @param routeName - The fully qualified name of the route
     */
    public static unsubscribe (routeName: string): void {
        this._callbacks.delete(routeName);
    }

    /**
     * Removes all registered hook callbacks.
     */
    public static unsubscribeAll (): void {
        this._callbacks.clear();
    }

    /**
     * Registers a global observer notified for every route call (success or failure),
     * in addition to any per-route `subscribe` callback. Multiple observers can coexist,
     * making this the safe extension point for cross-cutting concerns like Stats.
     *
     * @param observer - The function to execute on every call
     * @returns A function that removes this observer when called
     * @example
     * ```typescript
     * const unsubscribe = Hook.onAny((routeName, payload) => {
     *   console.log(routeName, payload.durationMs);
     * });
     * unsubscribe(); // stop observing
     * ```
     */
    public static onAny (observer: IHookObserver): () => void {
        this._observers.add(observer);
        return () => this._observers.delete(observer);
    }

    /**
     * Removes a previously registered global observer.
     *
     * @param observer - The observer function to remove
     */
    public static offAny (observer: IHookObserver): void {
        this._observers.delete(observer);
    }

    /**
     * Removes all registered global observers.
     */
    public static offAllAny (): void {
        this._observers.clear();
    }

    /**
     * Notifies all global observers about a route call outcome.
     * Observer errors are swallowed so instrumentation never breaks the call flow.
     *
     * @param routeName - The fully qualified name of the route (e.g., "api.users.list")
     * @param payload - Details about the call outcome
     */
    public static emit (routeName: string, payload: IHookEventPayload): void {
        this._observers.forEach(observer => {
            try {
                observer(routeName, payload);
            } catch {
                // Observers must never break the instrumented call flow.
            }
        });
    }
}
