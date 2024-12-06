// Registry.ts
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
            element.parent = parent.name;
        }

        const key = this.getElementKey(element);
        this._elements.set(key, element);

        if (element.type === "api" || element.type === "group") {
            let target = Klaim;
            if (parent) {
                // On vérifie si on doit créer une nouvelle branche
                target = this.getOrCreateKlaimBranch(parent);
            }
            target[element.name] = {};
        }
    }

    private getOrCreateKlaimBranch (parent: IElement): any {
        let target = Klaim;
        const path = this.getElementKey(parent);

        if (!path) return target;

        const parts = path.split(".");
        for (const part of parts) {
            if (!target[part]) {
                target[part] = {};
            }
            target = target[part];
        }
        return target;
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
        if (element.type !== "route") {
            throw new Error("Only routes can be registered within an API or Group");
        }

        const parent = this._currentParent;
        element.parent = this.getFullPath(parent);

        const key = `${element.parent}.${element.name}`;
        this._elements.set(key, element);

        this.addToKlaimRoute(element);
    }

    private getElementKey (element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;
        return `${element.parent}.${element.name}`;
    }

    public getFullPath (element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;

        let path = element.name;
        let current = element;

        while (current.parent) {
            const parent = this._elements.get(current.parent);
            if (!parent) break;
            path = `${current.parent}.${path}`;
            current = parent;
        }

        return path;
    }

    public getRoute (apiName: string, routeName: string): IElement | undefined {
        return this._elements.get(`${apiName}.${routeName}`);
    }

    public getElement (path: string): IElement | undefined {
        return this._elements.get(path);
    }

    public getParent (element: IElement): IElement | undefined {
        return element.parent ? this._elements.get(element.parent) : undefined;
    }

    public getChildren (elementName: string): IElement[] {
        const children: IElement[] = [];
        this._elements.forEach(element => {
            if (element.parent === elementName) {
                children.push(element);
            }
        });
        return children;
    }

    public static updateElement (element: IElement): IElement {
        const key = Registry.i.getElementKey(element);

        if (!Registry.i._elements.has(key)) {
            Registry.i.registerElement(element);
        }

        Registry.i._elements.set(key, element);
        return element;
    }

    private addToKlaimRoute (route: IElement): void {
        if (!route.parent) return;

        const parent = this._elements.get(route.parent);
        if (!parent) return;

        // On trouve la bonne branche dans Klaim
        const target = this.getOrCreateKlaimBranch(parent);

        // On ajoute la route
        const routeFunction = async <T>(args: IArgs = {}, body: IBody = {}): Promise<T> => {
            return callApi(route.parent!, route, args, body);
        };

        target[route.name] = routeFunction;
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

    public getApi (name: string): IElement | undefined {
        const element = this._elements.get(name);
        if (!element) return undefined;

        if (element.type === "api") return element;
        return this.findApi(element);
    }

    public getEffectiveCache (element: IElement): number | false {
        return this.getInheritedProperty<number>(element, "cache") || false;
    }

    public getEffectiveRetry (element: IElement): number | false {
        return this.getInheritedProperty<number>(element, "retry") || false;
    }

    private getInheritedProperty<T>(element: IElement, property: keyof IElement): T | undefined {
        if (!element) return undefined;

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
