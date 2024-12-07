import {IElement} from "./Element";
import {callApi, IArgs, IBody, Klaim, RouteFunction} from "./Klaim";

export class Registry {
    private static _instance: Registry;
    private _elements: Map<string, IElement> = new Map<string, IElement>();
    private _currentParent: IElement | null = null;

    private constructor() {}

    public static get i(): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

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

            // Ne pas écraser l'existant
            if (!target[element.name]) {
                target[element.name] = {};
            }
        }
    }

    public getCurrentParent(): IElement | null {
        return this._currentParent;
    }

    public setCurrentParent(fullPath: string): void {
        const element = this._elements.get(fullPath);
        if (!element || (element.type !== "api" && element.type !== "group")) {
            throw new Error(`Element ${fullPath} not found or not a valid parent type`);
        }
        this._currentParent = element;
    }

    public clearCurrentParent(): void {
        this._currentParent = null;
    }

    public registerRoute(element: IElement): void {
        if (!this._currentParent) {
            throw new Error("No current parent set, use Route only inside Api or Group create callback");
        }

        element.parent = this.getFullPath(this._currentParent);
        const key = this.getElementKey(element);
        this._elements.set(key, element);

        this.addToKlaimRoute(element);
    }

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

    public getElementKey(element: IElement): string {
        if (!element) return "";
        if (!element.parent) return element.name;
        return `${element.parent}.${element.name}`;
    }

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

    public getRoute(apiName: string, routeName: string): IElement | undefined {
        return this._elements.get(`${apiName}.${routeName}`);
    }

    public getChildren(elementPath: string): IElement[] {
        const children: IElement[] = [];
        this._elements.forEach(element => {
            if (element.parent === elementPath) {
                children.push(element);
            }
        });
        return children;
    }

    public static updateElement(element: IElement): IElement {
        return Registry.i._elements.get(Registry.i.getElementKey(element)) || element;
    }

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
