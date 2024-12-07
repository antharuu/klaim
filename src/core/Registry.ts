import {IElement} from "./Element";
import {callApi, IArgs, IBody, Klaim, RouteFunction} from "./Klaim";

/**
 * Singleton class that manages the registration and organization of API elements.
 * Handles the hierarchical structure of APIs, groups, and routes while maintaining
 * their relationships and providing lookup capabilities.
 *
 * @example
 * ```typescript
 * const registry = Registry.i;
 * registry.registerElement(apiElement);
 * const route = registry.getRoute("apiName", "routeName");
 * ```
 */
export class Registry {
    private static _instance: Registry;

    /**
     * Map storing all registered elements with their full paths as keys
     * @private
     */
    private _elements: Map<string, IElement> = new Map<string, IElement>();

    /**
     * Reference to the current parent element during registration
     * @private
     */
    private _currentParent: IElement | null = null;

    private constructor() {
    }

    /**
     * Gets the singleton instance of the Registry
     * @returns The singleton Registry instance
     */
    public static get i(): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

    /**
     * Registers a new element in the registry and updates the Klaim object structure
     *
     * @param element - The element to register
     * @throws Error if element registration fails
     * @example
     * ```typescript
     * Registry.i.registerElement(new Api("myApi", "https://api.example.com"));
     * ```
     */
    public registerElement(element: IElement): void {
        const parent = this._currentParent;
        if (parent) {
            element.parent = this.getFullPath(parent);
        }

        const key = this.getElementKey(element);
        this._elements.set(key, element);

        if (element.type === "api" || element.type === "group") {
            let target = Klaim;
            if (parent) {
                const parentParts = this.getFullPath(parent).split('.');

                for (const part of parentParts) {
                    if (!target[part]) {
                        target[part] = {};
                    }
                    target = target[part] as Record<string, any>;
                }
            }

            if (!target[element.name]) {
                target[element.name] = {};
            }
        }
    }

    /**
     * Gets the current parent element in the registration context
     * @returns The current parent element or null if none is set
     */
    public getCurrentParent(): IElement | null {
        return this._currentParent;
    }

    /**
     * Sets the current parent element using its full path
     *
     * @param fullPath - Dot-notation path to the parent element
     * @throws Error if the element is not found or is not a valid parent type
     */
    public setCurrentParent(fullPath: string): void {
        const element = this._elements.get(fullPath);
        if (!element || (element.type !== "api" && element.type !== "group")) {
            throw new Error(`Element ${fullPath} not found or not a valid parent type`);
        }
        this._currentParent = element;
    }

    /**
     * Clears the current parent element reference
     */
    public clearCurrentParent(): void {
        this._currentParent = null;
    }

    /**
     * Registers a route element and associates it with its parent API or group
     *
     * @param element - The route element to register
     * @throws Error if no parent context is set
     */
    public registerRoute(element: IElement): void {
        if (!this._currentParent) {
            throw new Error("No current parent set, use Route only inside Api or Group create callback");
        }

        element.parent = this.getFullPath(this._currentParent);
        const key = this.getElementKey(element);
        this._elements.set(key, element);

        this.addToKlaimRoute(element);
    }

    /**
     * Adds a route to the Klaim object structure for easy access
     *
     * @param route - The route element to add
     * @private
     */
    private addToKlaimRoute(route: IElement): void {
        if (!route.parent) return;

        let target = Klaim;
        const parentParts = route.parent.split('.');

        for (const part of parentParts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part] as Record<string, any>;
        }

        target[route.name] = function <T>(args: IArgs = {}, body: IBody = {}): Promise<T> {
            return callApi(route.parent!, route, args, body);
        } as RouteFunction;
    }

    /**
     * Generates a unique key for an element based on its path
     *
     * @param element - The element to generate a key for
     * @returns The element's unique key
     */
    public getElementKey(element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;
        return `${element.parent}.${element.name}`;
    }

    /**
     * Gets the full path for an element including all parent elements
     *
     * @param element - The element to get the path for
     * @returns Dot-notation path to the element
     */
    public getFullPath(element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;

        const path = [element.name];
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
     * Retrieves a route by its API and route names
     *
     * @param apiName - Name of the API containing the route
     * @param routeName - Name of the route to retrieve
     * @returns The route element or undefined if not found
     */
    public getRoute(apiName: string, routeName: string): IElement | undefined {
        return this._elements.get(`${apiName}.${routeName}`);
    }

    /**
     * Gets all child elements for a given parent path
     *
     * @param elementPath - Full path to the parent element
     * @returns Array of child elements
     */
    public getChildren(elementPath: string): IElement[] {
        const children: IElement[] = [];
        this._elements.forEach(element => {
            if (element.parent === elementPath) {
                children.push(element);
            }
        });
        return children;
    }

    /**
     * Updates an element in the registry
     *
     * @param element - The element to update
     * @returns The updated element
     */
    public static updateElement(element: IElement): IElement {
        return Registry.i._elements.get(Registry.i.getElementKey(element)) || element;
    }

    /**
     * Retrieves an API element by name, searching through the entire registry if necessary
     *
     * @param name - Name of the API to find
     * @returns The API element or undefined if not found
     */
    public getApi(name: string): IElement | undefined {
        const element = this._elements.get(name);
        if (!element) {
            for (const [key, el] of this._elements.entries()) {
                if (el.type === "api" && key.endsWith(`.${name}`)) {
                    return el;
                }
            }
            return undefined;
        }

        if (element.type === "api") return element;
        return this.findApi(element);
    }

    /**
     * Finds the parent API for a given element
     *
     * @param element - The element to find the API for
     * @returns The parent API element or undefined if not found
     * @private
     */
    private findApi(element: IElement): IElement | undefined {
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
