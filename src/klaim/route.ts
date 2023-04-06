import Core from "./core";
import {KlaimFunction, KlaimFunctionReturn, KlaimMethod, KlaimMethodEnum, KlaimRoute} from "./types";

export class Route extends Core {
    private static _routes: Record<string, KlaimRoute> = {}

    static get(id: string) {
        return Route._routes[id]
    }

    static create(id: string, method: KlaimMethod | string, path: string): KlaimRoute {
        Route._routes[id] = {
            id,
            method: Route.getMethod(method),
            path,
            call: Route.getCallFunction(id)
        }

        return Route._routes[id]
    }

    static getCallFunction(id: string): KlaimFunction {
        return (params: any = null) => {
            console.log(`Call: ${id}`);
            return Promise.resolve({
                params
            });
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