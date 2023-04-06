import {BaseObjType} from "./types";

export default class Core {
    protected static parseObjectNums(baseObj: Record<string, string>): BaseObjType {
        const obj: BaseObjType = {}

        for (const [key, value] of Object.entries(baseObj)) {
            obj[key] = isNaN(Number(value)) ? value : Number(value)
        }

        return obj
    }
}
