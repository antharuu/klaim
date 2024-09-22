import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

import { Api } from "./Api";
import { Route } from "./Route";

export type IHeaders = Record<string, string>;

export interface ICallbackBeforeArgs {
    route: Route;
    api: Api;
    url: string;
    config: Record<string, unknown>;
}

export interface ICallbackAfterArgs {
    route: Route;
    api: Api;
    response: Response;
    data: any;
}

export type ICallbackCallArgs = object;

export type ICallback<ArgsType> = (args: ArgsType) => Partial<ArgsType> | void;

interface IElementCallbacks {
    before: (ICallback<ICallbackBeforeArgs>) | null;
    after: (ICallback<ICallbackAfterArgs>) | null;
    call: (ICallback<ICallbackCallArgs>) | null;
}

export interface IElement {
    name: string;
    url: string;
    headers: IHeaders;
    callbacks: IElementCallbacks;
    cache: false | number;
    retry: false | number;

    before: (callback: ICallback<ICallbackBeforeArgs>) => this;
    after: (callback: ICallback<ICallbackAfterArgs>) => this;
    onCall: (callback: ICallback<ICallbackCallArgs>) => this;

    withCache: (duration?: number) => this;
    withRetry: (maxRetries?: number) => this;
}

/**
 * Represents an element (API or Route)
 */
export abstract class Element implements IElement {
    public name: string;

    public url: string;

    public headers: IHeaders;

    public callbacks: IElementCallbacks = {
        /**
         * Called before the request is sent
         */
        before: null,
        /**
         * Called after the request is sent and before the data is returned
         */
        after: null,
        /**
         * Called when the route is called (call also includes retries)
         */
        call: null
    };

    public cache: false | number = false;

    public retry: false | number = false;

    /**
     * Constructor
     *
     * @param name - The name of the element
     * @param url - The base URL of the element
     * @param headers - The headers to be sent with each request
     */
    protected constructor (name: string, url: string, headers: IHeaders = {}) {
        this.name = toCamelCase(name);
        if (this.name !== name) {
            console.warn(`Name "${name}" has been camelCased to "${this.name}"`);
        }

        this.url = cleanUrl(url);
        this.headers = headers || {};
    }

    /**
     * Sets the before callback
     *
     * @param callback - The callback
     * @returns The route
     */
    public before (callback: ICallback<ICallbackBeforeArgs> | null): this {
        this.callbacks.before = callback;
        return this;
    }

    /**
     * Sets the after callback
     *
     * @param callback - The callback
     * @returns The route
     */
    public after (callback: ICallback<ICallbackAfterArgs>): this {
        this.callbacks.after = callback;
        return this;
    }

    /**
     * Sets the onCall callback
     *
     * @param callback - The callback
     * @returns The route
     */
    public onCall (callback: ICallback<ICallbackCallArgs>): this {
        this.callbacks.call = callback;
        return this;
    }

    /**
     * Enables caching for the Route
     *
     * @param duration - The duration to cache the response for seconds (default: 20)
     * @returns The Route
     */
    public withCache (duration = 20): this {
        this.cache = duration;
        return this;
    }

    /**
     * Enables retry for the Route
     *
     * @param maxRetries - The maximum number of retries (default: 3)
     * @returns The Route
     */
    public withRetry (maxRetries = 2): this {
        this.retry = maxRetries;
        return this;
    }
}
