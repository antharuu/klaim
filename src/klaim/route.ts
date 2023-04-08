import Core from './core'
import {
  type KlaimAPI,
  type KlaimApiParam,
  type KlaimCallParams, type KlaimCallParamsType,
  type KlaimFunction,
  type KlaimFunctionReturn,
  type KlaimMethod,
  KlaimMethodEnum,
  type KlaimRoute, type KlaimUrlParams
} from './types'
import Api from './api'

export default class Route extends Core {
  private static _routes: Record<string, KlaimRoute> = {}

  private static readonly regexTypesMap: Record<KlaimCallParamsType, RegExp> = {
    str: /^[^\d\s]+$/,
    num: /^-?\d+\.?\d*$/,
    alpha: /^[a-zA-Z]+$/,
    alphaNum: /^[a-zA-Z0-9]+$/,
    word: /^[a-zA-Z0-9_-]+$/
  }

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

  private static getUrlParams (path: string): KlaimUrlParams[] {
    const match = /\[([^\]]+)]/g.exec(path)
    const params: KlaimUrlParams[] = []

    if (match !== null) {
      const [, param] = match

      const [name, type] = param.split(':')

      params.push({ name, type: type as KlaimCallParamsType ?? null })
    }

    return params
  }

  private static validatePathParams (klaimRoute: KlaimRoute, params: KlaimCallParams): void {
    const requiredParams = klaimRoute.urlParams ?? []

    Route.checkRequiredParams(requiredParams, params)
    Route.checkUselessParams(requiredParams, params)
    Route.checkParamsType(requiredParams, params)
  }

  private static replacePathParams (path: string, requiredParams: KlaimUrlParams[], params: KlaimCallParams): string {
    return requiredParams.reduce((updatedPath, param) => {
      const replaceStr = param.type !== null ? `[${param.name}:${param.type}]` : `[${param.name}]`
      return updatedPath.replace(replaceStr, params[param.name])
    }, path)
  }

  private static resolvePathParams (klaimRoute: KlaimRoute, params: KlaimCallParams): string {
    const requiredParams = klaimRoute.urlParams ?? []

    Route.validatePathParams(klaimRoute, params)
    return Route.replacePathParams(klaimRoute.path, requiredParams, params)
  }

  private static checkRequiredParams (requiredParams: KlaimUrlParams[], params: KlaimCallParams): void {
    const missingParam = requiredParams.find(param => !(param.name in (params ?? [])))

    if (missingParam !== undefined) {
      throw new Error(`Missing required param: ${missingParam.name}`)
    }
  }

  private static checkUselessParams (requiredParams: KlaimUrlParams[], params: KlaimCallParams): void {
    const paramKeys = Object.keys(params ?? [])

    const hasUselessParam = paramKeys.some(param => {
      return requiredParams.find(requiredParam => requiredParam.name === param) == null
    })

    if (hasUselessParam) {
      console.warn('Some params are not used.')
    }
  }

  private static isInvalidParam (param: KlaimUrlParams, params: KlaimCallParams): boolean {
    const value = params[param.name]
    if (param.type !== null) {
      this.checkType(param.type, value, param.name)
    }
    return false
  }

  private static checkParamsType (requiredParams: KlaimUrlParams[], params: KlaimCallParams): void {
    requiredParams.some(param => this.isInvalidParam(param, params))
  }

  private static checkType (type: KlaimCallParamsType, givenParam: any, name: string): void {
    Object.keys(Route.regexTypesMap).forEach((regexType: string) => {
      if (type.toLowerCase() === regexType.toLowerCase()) {
        const regex = Route.regexTypesMap[regexType as KlaimCallParamsType]

        if (!regex.test(givenParam)) {
          throw new Error(`Invalid type: ${type} for param: ${name}, given: ${(givenParam as string)}`)
        }
      }
    })
  }
}
