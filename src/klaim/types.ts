export type BaseObjType = Record<string, string | number>

export enum KlaimMethodEnum {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  DELETE = 'DELETE',
}

export type KlaimMethod = keyof typeof KlaimMethodEnum

export type KlaimFunctionReturn = Promise<{ params: any }>
export type KlaimFunction = (params?: any) => KlaimFunctionReturn

export type KlaimCallParams = Record<string, any>
export type KlaimCallParamsType = 'num' | 'str' | null

export interface KlaimUrlParams {
  name: string
  type: KlaimCallParamsType
}

export interface KlaimRoute {
  api: KlaimAPI | null
  call: KlaimFunction
  id: string
  method: KlaimMethod
  urlParams?: KlaimUrlParams[]
  on: (apiName: string) => KlaimRoute
  params?: BaseObjType
  path: string
}

export interface KlaimAPI {
  baseUrl: string
  id: string
  queryParameters?: BaseObjType
}

export type KlaimApiParam = Partial<KlaimAPI> | string
