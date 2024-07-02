type IHookCallback = () => any;

/**
 * Represents hooks
 */
export class Hook {
    private static _callbacks: Map<string, IHookCallback> = new Map<string, IHookCallback>();

    /**
     * Subscribes to the hook
     *
     * @param routeName - The name of the route to subscribe to
     * @param callback - The callback to subscribe
     */
    public static subscribe (routeName: string, callback: IHookCallback): void {
        this._callbacks.set(routeName, callback);
    }

    /**
     * Runs the hook
     *
     * @param routeName - The name of the route to run
     */
    public static run (routeName: string): void {
        const callback = this._callbacks.get(routeName);
        if (!callback) {
            return;
        }

        callback();
    }
}
