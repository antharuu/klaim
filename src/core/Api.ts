import toCamelCase from "../tools/toCamelCase";

import { Element, IHeaders } from "./Element";
import { Registry } from "./Registry";

export type IApiCallback = () => void;

export class Api extends Element {
    public static create (
        name: string,
        url: string,
        callback: IApiCallback,
        headers: IHeaders = {}
    ): Element {
        const newName = toCamelCase(name);
        if (newName !== name) {
            console.warn(`API name "${name}" has been camelCased to "${newName}"`);
        }

        const api = new Api(newName, url, headers);
        Registry.i.registerElement(api);
        Registry.i.setCurrentParent(newName);

        callback();
        Registry.i.clearCurrentParent();
        return api;
    }

    private constructor (
        name: string,
        url: string,
        headers: IHeaders = {}
    ) {
        super("api", name, url, headers);
    }
}
