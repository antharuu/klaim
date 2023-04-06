import {Api} from "./api";
import {Route} from "./route";

export default {
    create: {
        api: Api.create,
        route: Route.create
    },
    get: {
        api: Api.get,
        route: Route.get
    },
    call: Route.call
}