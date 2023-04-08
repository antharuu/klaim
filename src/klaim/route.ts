import Core from "./core";
import {
    KlaimAPI,
    KlaimApiParam,
    KlaimFunction,
    KlaimFunctionReturn,
    KlaimMethod,
    KlaimMethodEnum,
    KlaimRoute
} from "./types";
import Api from "./api";

export default class Route extends Core {
    private static _routes: Record<string, KlaimRoute> = {}

    static get(id: string) {
        return Route._routes[id] || null;
    }

    static create(id: string, method: KlaimMethod | string, path: string): KlaimRoute {
        Route._routes[id] = {
            id,
            method: Route.getMethod(method),
            path,
            call: Route.getCallFunction(id),
            api: null,
            on: (apiName: string) => Route.addApiToRoute(Route._routes[id], apiName)
        }

        return Route._routes[id]
    }

    static addApiToRoute(route: KlaimRoute, api: KlaimApiParam): KlaimRoute {
        if (typeof api === 'string') {
            api = Api.get(api);
        }

        if (!api) {
            throw new Error(`Api not found: ${api}`);
        }

        // check if api is not partial
        if (!('id' in api) || !('baseUrl' in api)) {
            throw new Error(`Invalid Api: ${api}`);
        }

        route.api = api as KlaimAPI;

        return route;
    }

    static getCallFunction(id: string): KlaimFunction {
        return (params: any = null) => {
            console.log(`Call: ${id}`);

            const route = Route.get(id);
            if (!route) {
                throw new Error(`Route not found: ${id}`);
            }

            console.log(route, params);

            return new Promise((resolve) => { resolve({params: true}) } );
        };
    }

    static call(id: string): KlaimFunctionReturn {
        return Route.getCallFunction(id)();
    }

    private static getMethod(method: KlaimMethod | string): KlaimMethod {
        if (!(method.toUpperCase() in KlaimMethodEnum)) {
            throw new Error(`Invalid KlaimMethod: ${method}`);
        }

        return method.toUpperCase() as KlaimMethod;
    }
}