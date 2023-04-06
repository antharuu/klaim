import Core from "./core";
import {KlaimAPI} from "./types";

export class Api extends Core {
    private static _apis: Record<string, KlaimAPI> = {}

    static get(id: string) {
        return Api._apis[id]
    }

    static create(id: string, api: Omit<KlaimAPI, 'id'> | string) {
        if (typeof api === 'string') {
            api = {baseUrl: api}
        }

        api = Api.cleanQueryParameters(api)
        api = Api.cleanBaseUrl(api)

        Api._apis[id] = {
            id,
            ...api
        }
    }

    private static cleanBaseUrl(api: Omit<KlaimAPI, 'id'>): Omit<KlaimAPI, 'id'> {
        // Remove trailing slash
        if (api.baseUrl.endsWith('/')) {
            api.baseUrl = api.baseUrl.slice(0, -1)
        }

        // Remove double slashes (except for http:// or https://)
        api.baseUrl = api.baseUrl.replace(/([^:]\/)\/+/g, '$1')

        return api
    }

    private static cleanQueryParameters(api: Omit<KlaimAPI, "id">) {
        const url = new URL(api.baseUrl)

        api.baseUrl = url.origin + url.pathname

        api.queryParameters = Core.parseObjectNums(Object.fromEntries((url.searchParams as any).entries()))

        return api
    }

}