import {Api} from "./Api";
import {Route} from "./Route";
import {callApi, IArgs, IBody, Klaim} from "./Klaim";

export class Registry {
    private static _instance: Registry;

    private _apis: Map<string, Api> = new Map<string, Api>();
    private _currentApi: Api | null = null;

    private constructor() {
    }

    public static get i(): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

    public registerApi(api: Api) {
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

    public registerRoute(route: Route) {
        if (!this._currentApi) {
            throw new Error(`No current API set, use Route only inside Api.create callback`);
        }

        route.api = this._currentApi.name;
        this._currentApi.routes.set(route.name, route);

        this.addToKlaimRoute(route.api, route);
    }

    public getApi(name: string): Api | undefined {
        return this._apis.get(name);
    }

    public getRoute(api: string, name: string): Route | undefined {
        const apiObj = this._apis.get(api);
        if (!apiObj) {
            throw new Error(`API ${api} not found`);
        }
        return apiObj.routes.get(name) as Route;
    }

    private addToKlaimRoute(apiName: string, route: Route) {
        Klaim[apiName][route.name] = async <T>(args: IArgs = {}, body: IBody = {}): Promise<T> => {
            const api = Registry.i._apis.get(apiName);
            if (!api) {
                throw new Error(`API ${route.api} not found`);
            }
            return callApi(api, route, args, body);
        };
    }
}

