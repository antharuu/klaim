import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

export type IHeaders = Record<string, string>;

export interface ICallbackBeforeArgs {
    route: IElement;
    api: IElement;
    url: string;
    config: Record<string, unknown>;
}

export interface ICallbackAfterArgs {
    route: IElement;
    api: IElement;
    response: Response;
    data: any;
}

export type ICallbackCallArgs = object;
export type ICallback<ArgsType> = (args: ArgsType) => Partial<ArgsType> | void;

interface IElementCallbacks {
    before: ICallback<ICallbackBeforeArgs> | null;
    after: ICallback<ICallbackAfterArgs> | null;
    call: ICallback<ICallbackCallArgs> | null;
}

export interface IElement {
    type: "api" | "route";
    name: string;
    url: string;
    headers: IHeaders;
    callbacks: IElementCallbacks;
    cache: false | number;
    retry: false | number;
    parent?: string;
    method?: string;
    arguments: Set<string>;
    schema?: any;

    before(callback: ICallback<ICallbackBeforeArgs>): this;

    after(callback: ICallback<ICallbackAfterArgs>): this;

    onCall(callback: ICallback<ICallbackCallArgs>): this;

    withCache(duration?: number): this;

    withRetry(maxRetries?: number): this;
}

export abstract class Element implements IElement {
    public type: "api" | "route";

    public name: string;

    public url: string;

    public headers: IHeaders;

    public parent?: string;

    public method?: string;

    public arguments: Set<string> = new Set<string>();

    public schema?: any;

    public callbacks: IElementCallbacks = {
        before: null,
        after: null,
        call: null
    };

    public cache: false | number = false;

    public retry: false | number = false;

    protected constructor (
        type: "api" | "route",
        name: string,
        url: string,
        headers: IHeaders = {}
    ) {
        this.type = type;
        this.name = toCamelCase(name);
        if (this.name !== name) {
            console.warn(`Name "${name}" has been camelCased to "${this.name}"`);
        }

        this.url = cleanUrl(url);
        this.headers = headers || {};
    }

    public before (callback: ICallback<ICallbackBeforeArgs>): this {
        this.callbacks.before = callback;
        return this;
    }

    public after (callback: ICallback<ICallbackAfterArgs>): this {
        this.callbacks.after = callback;
        return this;
    }

    public onCall (callback: ICallback<ICallbackCallArgs>): this {
        this.callbacks.call = callback;
        return this;
    }

    public withCache (duration = 20): this {
        this.cache = duration;
        return this;
    }

    public withRetry (maxRetries = 2): this {
        this.retry = maxRetries;
        return this;
    }
}
