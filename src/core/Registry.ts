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
        const key = element.type === "route"
            ? `${element.parent}.${element.name}`
            : element.name;
        this._elements.set(key, element);

        if (element.type === "api") {
            Klaim[element.name] = {};
        }
    }

    public setCurrentParent (name: string): void {
        const element = this._elements.get(name);
        if (!element || element.type !== "api") {
            throw new Error(`API ${name} not found`);
        }
        this._currentParent = element;
    }

    public clearCurrentParent (): void {
        this._currentParent = null;
    }

    public registerRoute (element: IElement): void {
        if (!this._currentParent) {
            throw new Error("No current parent set, use Route only inside Api.create callback");
        }
        if (element.type !== "route") {
            throw new Error("Only routes can be registered within an API");
        }

        element.parent = this._currentParent.name;
        const key = `${element.parent}.${element.name}`;
        this._elements.set(key, element);

        this.addToKlaimRoute(element);
    }

    public getElement (path: string): IElement | undefined {
        return this._elements.get(path);
    }

    public getApi (name: string): IElement | undefined {
        console.log(this._elements);
        const element = this._elements.get(name);
        return element?.type === "api" ? element : undefined;
    }

    public getRoute (apiName: string, routeName: string): IElement | undefined {
        const element = this._elements.get(`${apiName}.${routeName}`);
        return element?.type === "route" ? element : undefined;
    }

    public static updateElement (element: IElement): IElement {
        const key = element.type === "route"
            ? `${element.parent}.${element.name}`
            : element.name;

        if (!Registry.i._elements.has(key)) {
            Registry.i.registerElement(element);
        }

        Registry.i._elements.set(key, element);
        return element;
    }

    private addToKlaimRoute (route: IElement): void {
        if (!route.parent) return;

        Klaim[route.parent][route.name] = async <T>(
            args: IArgs = {},
            body: IBody = {}
        ): Promise<T> => {
            const parent = route.parent!;
            return callApi(parent, route, args, body);
        };
    }
}
