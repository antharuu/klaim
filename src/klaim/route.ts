import Core from './core'
import {
  type KlaimAPI,
  type KlaimApiParam,
  type KlaimFunction,
  type KlaimFunctionReturn,
  type KlaimMethod,
  KlaimMethodEnum,
  type KlaimRoute
} from './types'
import Api from './api'

export default class Route extends Core {
  private static _routes: Record<string, KlaimRoute> = {}

  static get (id: string): KlaimRoute {
    if (!(id in Route._routes)) {
      throw new Error(`Route not found: ${id}`)
    }

    return Route._routes[id]
  }

  static create (id: string, method: KlaimMethod | string, path: string): KlaimRoute {
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

  static addApiToRoute (route: KlaimRoute, api: KlaimApiParam): KlaimRoute {
    if (typeof api === 'string') {
      api = Api.get(api)
    }

    route.api = api as KlaimAPI

    return route
  }

  static getCallFunction (id: string): KlaimFunction {
    return async (_params: any = null) => {
      console.log(`Call: ${id}`)

      const route = Route.get(id)

      console.table({ route })

      return await new Promise((resolve) => {
        resolve({ params: true })
      })
    }
  }

  static async call (id: string): KlaimFunctionReturn {
    return await Route.getCallFunction(id)()
  }

  private static getMethod (method: KlaimMethod | string): KlaimMethod {
    if (!(method.toUpperCase() in KlaimMethodEnum)) {
      throw new Error(`Invalid KlaimMethod: ${method}`)
    }

    return method.toUpperCase() as KlaimMethod
  }
}
