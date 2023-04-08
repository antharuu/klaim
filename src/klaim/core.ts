import { type BaseObjType } from './types'

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export default class Core {
  protected static parseObjectNums (baseObj: Record<string, string>): BaseObjType {
    const obj: BaseObjType = {}

    for (const [key, value] of Object.entries(baseObj)) {
      obj[key] = isNaN(Number(value)) ? value : Number(value)
    }

    return obj
  }
}
