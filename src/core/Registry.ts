import { IElement } from "./Element";
import { callApi, IArgs, IBody, IRouteReference, Klaim, RouteFunction } from "./Klaim";

/**
 * Singleton registry that manages all API, Group, and Route elements.
 * Maintains the hierarchical structure of elements and integrates with the Klaim object.
 *
 * @example
 * ```typescript
 * const registry = Registry.i;
 * registry.registerElement(apiElement);
 * registry.setCurrentParent(apiName);
 * ```
 */
export class Registry {
    /** Singleton instance of the Registry */
    private static _instance: Registry;

    /**
     * Map storing all registered elements keyed by their full path.
     *
     * @private
     */
    private _elements: Map<string, IElement> = new Map<string, IElement>();

    /**
     * Reference to the currently active parent element during registration.
     *
     * @private
     */
    private _currentParent: IElement | null = null;

    /** @private */
    private constructor () {}

    /**
     * Gets the singleton instance of the Registry.
     * Creates the instance if it doesn't exist.
     *
     * @returns The singleton Registry instance
     */
    public static get i (): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

    /**
     * Registers an element (API, Group, or Route) in the registry.
     * Sets up parent-child relationships and updates the Klaim object structure.
     *
     * @param element - The element to register
     * @throws Error if registration fails
     */
    public registerElement (element: IElement): void {
        const parent = this._currentParent;
        if (parent) {
            element.parent = this.getFullPath(parent);
        }

        const key = this.getElementKey(element);
        this._elements.set(key, element);

        if (element.type === "api" || element.type === "group") {
            let target: Record<string, IRouteReference | RouteFunction> = Klaim;
            if (parent) {
                target = this.getOrCreateKlaimBranch(parent);
            }
            target[element.name] = {};
        }
    }

    /**
     * Gets the currently active parent element.
     * Used during element registration to establish hierarchy.
     *
     * @returns The current parent element or null if none is set
     */
    public getCurrentParent (): IElement | null {
        return this._currentParent;
    }

    /**
     * Sets the current parent element by its full path.
     * Used to establish context for registering child elements.
     *
     * @param fullPath - Full path to the parent element
     * @throws Error if the specified element doesn't exist or isn't a valid parent type
     */
    public setCurrentParent (fullPath: string): void {
        const element = this._elements.get(fullPath);
        if (!element || (element.type !== "api" && element.type !== "group")) {
            throw new Error(`Element ${fullPath} not found or not a valid parent type`);
        }
        this._currentParent = element;
    }

    /**
     * Clears the current parent reference.
     * Called after finishing registration of child elements.
     */
    public clearCurrentParent (): void {
        this._currentParent = null;
    }

    /**
     * Registers a route element under the current parent.
     * Sets up the route in the Klaim object hierarchy.
     *
     * @param element - The route element to register
     * @throws Error if no current parent is set or if registration fails
     */
    public registerRoute (element: IElement): void {
        if (!this._currentParent) {
            throw new Error("No current parent set, use Route only inside Api or Group create callback");
        }

        const parentFullPath = this.getFullPath(this._currentParent);
        if (!this._elements.has(parentFullPath)) {
            throw new Error(`Parent element ${parentFullPath} not found`);
        }

        element.parent = parentFullPath;
        const key = this.getElementKey(element);
        this._elements.set(key, element);

        this.addToKlaimRoute(element);
    }

    /**
     * Gets or creates a branch in the Klaim object hierarchy.
     *
     * @param parent - The parent element whose branch to get/create
     * @returns The branch object in the Klaim hierarchy
     * @private
     */
    private getOrCreateKlaimBranch (parent: IElement): Record<string, IRouteReference | RouteFunction> {
        let target: Record<string, IRouteReference | RouteFunction> = Klaim;
        const fullPath = this.getFullPath(parent);
        const parts = fullPath.split(".");

        for (const part of parts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part] as Record<string, IRouteReference | RouteFunction>;
        }
        return target;
    }

    /**
     * Adds a route to the Klaim object hierarchy.
     * Creates the necessary function wrapper for API calls.
     *
     * @param route - The route element to add
     * @private
     */
    private addToKlaimRoute (route: IElement): void {
        if (!route.parent) return;

        const parentParts = route.parent.split(".");
        let target: Record<string, IRouteReference | RouteFunction> = Klaim;

        for (const part of parentParts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part] as Record<string, IRouteReference | RouteFunction>;
        }

        /**
         * Wrapper function for making API calls through the Klaim object.
         *
         * @param args - Arguments for the API call
         * @param body - Body data for the API call
         * @returns A promise that resolves to the response of type T
         */
        target[route.name] = function routeFunction<T> (args: IArgs = {}, body: IBody = {}): Promise<T> {
            return callApi(route.parent!, route, args, body);
        };
    }

    /**
     * Gets the registry key for an element.
     * The key is the full path of the element in dot notation.
     *
     * @param element - The element to get the key for
     * @returns The element's registry key
     */
    public getElementKey (element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;
        return `${element.parent}.${element.name}`;
    }

    /**
     * Gets the full path for an element.
     * Builds the path by traversing the parent hierarchy.
     *
     * @param element - The element to get the path for
     * @returns The full path in dot notation
     */
    public getFullPath (element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;

        const path = [ element.name ];
        let current = element;

        while (current.parent) {
            const parent = this._elements.get(current.parent);
            if (!parent) break;
            path.unshift(parent.name);
            current = parent;
        }

        return path.join(".");
    }

    /**
     * Gets a route element by API and route names.
     *
     * @param apiName - Name of the API containing the route
     * @param routeName - Name of the route to retrieve
     * @returns The route element or undefined if not found
     */
    public getRoute (apiName: string, routeName: string): IElement | undefined {
        return this._elements.get(`${apiName}.${routeName}`);
    }

    /**
     * Gets all child elements for a given parent path.
     *
     * @param elementPath - Full path of the parent element
     * @returns Array of child elements
     */
    public getChildren (elementPath: string): IElement[] {
        const children: IElement[] = [];
        this._elements.forEach(element => {
            if (element.parent === elementPath) {
                children.push(element);
            }
        });
        return children;
    }

    /**
     * Updates an element in the registry.
     *
     * @param element - The element to update
     * @returns The updated element or the original if not found
     */
    public static updateElement (element: IElement): IElement {
        return Registry.i._elements.get(Registry.i.getElementKey(element)) || element;
    }

    /**
     * Gets an API element by name.
     *
     * @param name - Name of the API to retrieve
     * @returns The API element or undefined if not found
     */
    public getApi (name: string): IElement | undefined {
        const element = this._elements.get(name);
        if (!element) return undefined;

        if (element.type === "api") return element;
        return this.findApi(element);
    }

    /**
     * Finds the parent API element for a given element.
     * Traverses up the parent hierarchy until an API element is found.
     *
     * @param element - The element to find the API for
     * @returns The parent API element or undefined if not found
     * @private
     */
    private findApi (element: IElement): IElement | undefined {
        if (!element || !element.parent) return undefined;

        const parentParts = element.parent.split(".");
        for (let i = parentParts.length; i >= 0; i--) {
            const partialPath = parentParts.slice(0, i).join(".");
            const parent = this._elements.get(partialPath);
            if (parent?.type === "api") return parent;
        }

        return undefined;
    }
}
