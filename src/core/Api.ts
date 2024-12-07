import toCamelCase from "../tools/toCamelCase";
import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";

export type IApiCallback = () => void;

export class Api extends Element {
    public static create(
        name: string,
        url: string,
        callback: IApiCallback,
        headers: IHeaders = {}
    ): Element {
        const newName = toCamelCase(name);
        if (newName !== name) {
            console.warn(`API name "${name}" has been camelCased to "${newName}"`);
        }

        // Create API instance
        const api = new Api(newName, url, headers);

        // Store current parent context
        const currentParent = Registry.i.getCurrentParent();

        // Register the API
        Registry.i.registerElement(api);

        // Get the full API path considering any parents
        const parentPath = currentParent ? Registry.i.getFullPath(currentParent) : '';
        const apiFullPath = parentPath ? `${parentPath}.${newName}` : newName;

        // Set this API as current parent
        Registry.i.setCurrentParent(apiFullPath);

        // Execute callback inside API context
        callback();

        // Important: Only restore parent context after route creation
        if (currentParent) {
            Registry.i.setCurrentParent(Registry.i.getFullPath(currentParent));
        } else {
            Registry.i.clearCurrentParent();
        }

        return api;
    }

    private constructor(
        name: string,
        url: string,
        headers: IHeaders = {}
    ) {
        super("api", name, url, headers);
    }
}
