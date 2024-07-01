import {Registry} from "./Registry";
import {IRoute} from "./Route";
import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

export interface IApi {
    name: string;
    url: string;
    headers: IHeaders;
    routes: Map<string, IRoute>;
}

export type IApiCallback = () => void;
export type IHeaders = Record<string, string>;

export class Api implements IApi {
    public name: string;
    public url: string;
    public headers: IHeaders;
    public routes: Map<string, IRoute> = new Map<string, IRoute>();

    private constructor(name: string, url: string, headers: IHeaders) {
        this.name = name;
        this.url = cleanUrl(url);
        this.headers = headers || {};
    }

    public static create(name: string, url: string, callback: IApiCallback, headers: IHeaders = {}) {
        const newName = toCamelCase(name)
        if (newName !== name) {
            console.warn(`API name "${name}" has been camelCased to "${newName}"`);
        }
        const api = new Api(newName, url, headers);
        Registry.i.registerApi(api);
        Registry.i.setCurrent(newName);
        callback();
        Registry.i.clearCurrent();
        return api;
    }
}
