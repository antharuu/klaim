import { IElement } from "./Element";
import { callApi, IArgs, IBody, Klaim } from "./Klaim";

export class Registry {
    private static _instance: Registry;

    private _elements: Map<string, IElement> = new Map<string, IElement>();

    private _currentParent: IElement | null = null;

    private constructor () {}

    public static get i (): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

    public registerElement (element: IElement): void {
        const parent = this._currentParent;
        if (parent) {
            element.parent = this.getFullPath(parent);
        }

        const key = this.getElementKey(element);
        this._elements.set(key, element);

        if (element.type === "api" || element.type === "group") {
            let target = Klaim;
            if (parent) {
                target = this.getOrCreateKlaimBranch(parent);
            }
            target[element.name] = {};
        }
    }

    public getCurrentParent (): IElement | null {
        return this._currentParent;
    }

    public setCurrentParent (fullPath: string): void {
        const element = this._elements.get(fullPath);
        if (!element || (element.type !== "api" && element.type !== "group")) {
            throw new Error(`Element ${fullPath} not found or not a valid parent type`);
        }
        this._currentParent = element;
    }

    public clearCurrentParent (): void {
        this._currentParent = null;
    }

    public registerRoute (element: IElement): void {
        if (!this._currentParent) {
            throw new Error("No current parent set, use Route only inside Api or Group create callback");
        }

        // Get the full path for the parent and verify it exists
        const parentFullPath = this.getFullPath(this._currentParent);
        if (!this._elements.has(parentFullPath)) {
            throw new Error(`Parent element ${parentFullPath} not found`);
        }

        // Set the parent and register the element
        element.parent = parentFullPath;
        const key = this.getElementKey(element);
        this._elements.set(key, element);

        // Add the route to the Klaim object
        this.addToKlaimRoute(element);
    }

    private getOrCreateKlaimBranch (parent: IElement): any {
        let target = Klaim;
        const fullPath = this.getFullPath(parent);
        const parts = fullPath.split(".");

        for (const part of parts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part];
        }
        return target;
    }

    private addToKlaimRoute (route: IElement): void {
        if (!route.parent) return;

        // Split the parent path to get the hierarchy
        const parentParts = route.parent.split(".");
        let target = Klaim;

        // Navigate through each level of the hierarchy
        for (const part of parentParts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part];
        }

        // Create the route function
        const routeFunction = async <T>(args: IArgs = {}, body: IBody = {}): Promise<T> => {
            return callApi(route.parent!, route, args, body);
        };

        // Add the route to the target location
        target[route.name] = routeFunction;
    }

    public getElementKey (element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;
        return `${element.parent}.${element.name}`;
    }

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

    public getRoute (apiName: string, routeName: string): IElement | undefined {
        return this._elements.get(`${apiName}.${routeName}`);
    }

    public getElement (path: string): IElement | undefined {
        return this._elements.get(path);
    }

    public getParent (element: IElement): IElement | undefined {
        if (!element.parent) return undefined;
        return this._elements.get(element.parent);
    }

    public getChildren (elementPath: string): IElement[] {
        const children: IElement[] = [];
        this._elements.forEach((element, key) => {
            if (element.parent === elementPath) {
                children.push(element);
            }
        });
        return children;
    }

    public static updateElement (element: IElement): IElement {
        return Registry.i._elements.get(Registry.i.getElementKey(element)) || element;
    }

    public getApi (name: string): IElement | undefined {
        const element = this._elements.get(name);
        if (!element) return undefined;

        if (element.type === "api") return element;
        return this.findApi(element);
    }

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

    public getEffectiveCache (element: IElement): number | false {
        return this.getInheritedProperty<number>(element, "cache") || false;
    }

    public getEffectiveRetry (element: IElement): number | false {
        return this.getInheritedProperty<number>(element, "retry") || false;
    }

    private getInheritedProperty<T>(element: IElement, property: keyof IElement): T | undefined {
        let current: IElement | undefined = element;

        while (current) {
            if (current[property] !== undefined && current[property] !== false) {
                return current[property] as T;
            }
            current = current.parent ? this._elements.get(current.parent) : undefined;
        }

        return undefined;
    }
}
