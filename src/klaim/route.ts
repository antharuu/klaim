import Core from './core'
import {
  type KlaimAPI,
  type KlaimApiParam,
  type KlaimCallParams,
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
      on: (apiName: string) => Route.addApiToRoute(Route._routes[id], apiName),
      urlParams: Route.getUrlParams(path)
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
    return async (params: KlaimCallParams = {}) => {
      console.info(`Call: ${id}`)

      const currentPath = Route.resolvePathParams(Route.get(id), params)

      const route = Route.get(id)

      console.log(route, currentPath)

      return await new Promise((resolve) => {
        resolve({ params: true })
      })
    }
  }

  static async call (id: string, params: KlaimCallParams = {}): KlaimFunctionReturn {
    return await Route.getCallFunction(id)(params)
  }

  private static getMethod (method: KlaimMethod | string): KlaimMethod {
    if (!(method.toUpperCase() in KlaimMethodEnum)) {
      throw new Error(`Invalid KlaimMethod: ${method}`)
    }

    return method.toUpperCase() as KlaimMethod
  }

  private static getUrlParams (path: string): string[] {
    // Match all [] in path
    const regex = /\[([^\]]+)]/g
    const params: string[] = []

    let match = regex.exec(path)

    while (match != null) {
      params.push(match[1])
      match = regex.exec(path)
    }

    return params
  }

  private static validatePathParams (klaimRoute: KlaimRoute, params: KlaimCallParams): void {
    const requiredParams = klaimRoute.urlParams ?? []

    Route.checkRequiredParams(requiredParams, params)
    Route.checkUselessParams(requiredParams, params)
  }

  private static replacePathParams (path: string, requiredParams: string[], params: KlaimCallParams): string {
    return requiredParams.reduce((updatedPath, param) => {
      return updatedPath.replace(`[${param}]`, params[param])
    }, path)
  }

  private static resolvePathParams (klaimRoute: KlaimRoute, params: KlaimCallParams): string {
    const requiredParams = klaimRoute.urlParams ?? []

    Route.validatePathParams(klaimRoute, params)
    return Route.replacePathParams(klaimRoute.path, requiredParams, params)
  }

  private static checkRequiredParams (requiredParams: string[], params: KlaimCallParams): void {
    const missingParam = requiredParams.find(param => !(param in (params ?? [])))

    if (missingParam !== undefined) {
      throw new Error(`Missing required param: ${missingParam}`)
    }
  }

  private static checkUselessParams (requiredParams: string[], params: KlaimCallParams): void {
    const paramKeys = Object.keys(params ?? [])

    const hasUselessParam = paramKeys.some(param => !requiredParams.includes(param))

    if (hasUselessParam) {
      console.warn('Some params are not used.')
    }
  }
}
