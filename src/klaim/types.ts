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

export interface KlaimRoute {
  id: string
  path: string
  method: KlaimMethod
  call: KlaimFunction
  api: KlaimAPI | null
  params?: BaseObjType
  on: (apiName: string) => KlaimRoute
}

export interface KlaimAPI {
  id: string
  baseUrl: string
  queryParameters?: BaseObjType
}

export type KlaimApiParam = Partial<KlaimAPI> | string
