import { type BaseObjType } from './types'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class Core {
  protected static parseObjectNums (baseObj: Record<string, string>): BaseObjType {
    return Object.fromEntries(
      Object.entries(baseObj).map(([key, value]) => [
        key,
        isNaN(Number(value)) ? value : Number(value)
      ])
    )
  }
}
