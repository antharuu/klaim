import { Api } from "./Api";
import { callApi, IArgs, IBody, Klaim } from "./Klaim";
import { Route } from "./Route";

/**
 * Represents the registry
 */
export class Registry {
    private static _instance: Registry;

    private _apis: Map<string, Api> = new Map<string, Api>();

    private _currentApi: Api | null = null;

    /**
     * Constructor
     */
    private constructor () {
    }

    /**
     * Singleton instance
     *
     * @returns The singleton instance
     */
    public static get i (): Registry {
        if (!Registry._instance) {
            Registry._instance = new Registry();
        }
        return Registry._instance;
    }

    /**
     * Registers an API
     *
     * @param api - The API to register
     */
    public registerApi (api: Api): void {
        this._apis.set(api.name, api);
        Klaim[api.name] = {};
    }

    /**
     * Sets the current API
     *
     * @param name - The name of the API
     */
    public setCurrent (name: string): void {
        const api = this._apis.get(name);
        if (!api) {
            throw new Error(`API ${name} not found`);
        }
        this._currentApi = api;
    }

    /**
     * Clears the current API
     */
    public clearCurrent (): void {
        this._currentApi = null;
    }

    /**
     * Registers a route
     *
     * @param route - The route to register
     */
    public registerRoute (route: Route): void {
        if (!this._currentApi) {
            throw new Error(`No current API set, use Route only inside Api.create callback`);
        }

        route.api = this._currentApi.name;
        this._currentApi.routes.set(route.name, route);

        this.addToKlaimRoute(route.api, route);
    }

    /**
     * Gets an API
     *
     * @param name - The name of the API
     * @returns The API
     */
    public getApi (name: string): Api | undefined {
        return this._apis.get(name);
    }

    /**
     * Gets a route
     *
     * @param api - The name of the API
     * @param name - The name of the route
     * @returns The route
     */
    public getRoute (api: string, name: string): Route | undefined {
        const apiObj = this._apis.get(api);
        if (!apiObj) {
            throw new Error(`API ${api} not found`);
        }
        return apiObj.routes.get(name) as Route;
    }

    /**
     * Adds a route to Klaim object
     *
     * @param apiName - The name of the API
     * @param route - The route to add
     */
    private addToKlaimRoute (apiName: string, route: Route): void {
        /**
         * The route function
         *
         * @param args - The arguments to pass to the route
         * @param body - The body to pass to the route
         * @returns The response
         */
        Klaim[apiName][route.name] = async <T>(args: IArgs = {}, body: IBody = {}): Promise<T> => {
            const api = Registry.i._apis.get(apiName);
            if (!api) {
                throw new Error(`API ${route.api} not found`);
            }
            return callApi(api, route, args, body);
        };
    }
}
