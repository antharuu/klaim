import {IApi} from "./Api";
import {IRoute} from "./Route";
import {callApi, Klaim} from "./Klaim";

export class Registry {
    private static _instance: Registry;

    private _apis: Map<string, IApi> = new Map<string, IApi>();
    private _currentApi: IApi | null = null

    private constructor() {
        // Private constructor to prevent instantiation
    }

    public static get i(): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

    public registerApi(api: IApi) {
        this._apis.set(api.name, api);

        Klaim[api.name] = {};
    }

    public setCurrent(name: string): void {
        const api = this._apis.get(name);
        if (!api) {
            throw new Error(`API ${name} not found`);
        }

        this._currentApi = api;
    }

    public clearCurrent() {
        this._currentApi = null;
    }

    registerRoute<T>(route: IRoute) {
        if (!this._currentApi) {
            throw new Error(`No current API set, use Route only inside Api.create callback`);
        }

        route.api = this._currentApi.name;
        this._currentApi.routes.set(route.name, route);

        this.addToKlaimRoute<T>(route.api, route);
    }

    private addToKlaimRoute<T>(apiName: string, route: IRoute) {
        Klaim[apiName][route.name] = async (...args: any[]): Promise<T> => {
            const api = Registry.i._apis.get(apiName);
            if (!api) {
                throw new Error(`API ${route.api} not found`);
            }

            return callApi<T>(api, route, ...args);
        };
    }
}
