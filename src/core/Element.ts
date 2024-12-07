import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";

/**
 * Type definition for HTTP headers.
 * A record of string key-value pairs representing header names and values.
 */
export type IHeaders = Record<string, string>;

/**
 * Arguments passed to before-request middleware callbacks.
 * Allows modification of request parameters before execution.
 */
export interface ICallbackBeforeArgs {
    /** The route element being called */
    route: IElement;
    /** The API element containing the route */
    api: IElement;
    /** The fully constructed URL for the request */
    url: string;
    /** The request configuration object */
    config: Record<string, unknown>;
}

/**
 * Arguments passed to after-request middleware callbacks.
 * Enables post-processing of responses.
 */
export interface ICallbackAfterArgs {
    /** The route element that was called */
    route: IElement;
    /** The API element containing the route */
    api: IElement;
    /** The raw response from the request */
    response: Response;
    /** The parsed response data */
    data: any;
}

/**
 * Arguments for call middleware callbacks.
 * Used for request lifecycle monitoring.
 */
export type ICallbackCallArgs = object;

/**
 * Generic callback type for middleware functions.
 *
 * @template ArgsType - The type of arguments passed to the callback
 */
export type ICallback<ArgsType> = (args: ArgsType) => Partial<ArgsType> | void;

/**
 * Collection of middleware callbacks for an element.
 */
interface IElementCallbacks {
    /** Executed before the request is made */
    before: ICallback<ICallbackBeforeArgs> | null;
    /** Executed after the response is received */
    after: ICallback<ICallbackAfterArgs> | null;
    /** Executed during the request lifecycle */
    call: ICallback<ICallbackCallArgs> | null;
}

/**
 * Core interface defining the structure and behavior of API elements.
 * Represents both APIs and routes within the system.
 */
export interface IElement {
    /** Element type: 'api', 'route', or 'group' */
    type: "api" | "route" | "group";
    /** Unique identifier for the element */
    name: string;
    /** Base URL or path segment */
    url: string;
    /** HTTP headers specific to this element */
    headers: IHeaders;
    /** Middleware callbacks */
    callbacks: IElementCallbacks;
    /** Cache duration in seconds, or false if caching is disabled */
    cache: false | number;
    /** Number of retry attempts, or false if retries are disabled */
    retry: false | number;
    /** Reference to parent element name */
    parent?: string;
    /** HTTP method for routes */
    method?: string;
    /** Dynamic URL parameters */
    arguments: Set<string>;
    /** Response validation schema */
    schema?: any;

    /** Adds before-request middleware */
    before(callback: ICallback<ICallbackBeforeArgs>): this;
    /** Adds after-request middleware */
    after(callback: ICallback<ICallbackAfterArgs>): this;
    /** Adds request lifecycle middleware */
    onCall(callback: ICallback<ICallbackCallArgs>): this;
    /** Enables response caching */
    withCache(duration?: number): this;
    /** Enables request retries */
    withRetry(maxRetries?: number): this;
}

/**
 * Abstract base class implementing common functionality for API elements.
 * Provides core features like middleware handling, caching, and retry logic.
 *
 * @example
 * ```typescript
 * class CustomElement extends Element {
 *   constructor() {
 *     super("custom", "myElement", "https://api.example.com");
 *   }
 * }
 * ```
 */
export abstract class Element implements IElement {
    /** Element type identifier */
    public type: "api" | "route" | "group";

    /** Element name (unique within its scope) */
    public name: string;

    /** Base URL or path segment */
    public url: string;

    /** HTTP headers specific to this element */
    public headers: IHeaders;

    /** Reference to parent element name */
    public parent?: string;

    /** HTTP method (for routes) */
    public method?: string;

    /** Set of dynamic URL parameters */
    public arguments: Set<string> = new Set<string>();

    /** Response validation schema */
    public schema?: any;

    /** Middleware callbacks collection */
    public callbacks: IElementCallbacks = {
        before: null,
        after: null,
        call: null
    };

    /** Cache duration in seconds, or false if disabled */
    public cache: false | number = false;

    /** Number of retry attempts, or false if disabled */
    public retry: false | number = false;

    /**
     * Creates a new element with the specified properties.
     *
     * @param type - Element type identifier
     * @param name - Unique name for the element
     * @param url - Base URL or path segment
     * @param headers - HTTP headers for the element
     */
    protected constructor (
        type: "api" | "route" | "group",
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

    /**
     * Adds a before-request middleware callback.
     *
     * @param callback - Function to execute before the request
     * @returns this element instance for chaining
     */
    public before (callback: ICallback<ICallbackBeforeArgs>): this {
        this.callbacks.before = callback;
        return this;
    }

    /**
     * Adds an after-request middleware callback.
     *
     * @param callback - Function to execute after the response
     * @returns this element instance for chaining
     */
    public after (callback: ICallback<ICallbackAfterArgs>): this {
        this.callbacks.after = callback;
        return this;
    }

    /**
     * Adds a request lifecycle middleware callback.
     *
     * @param callback - Function to execute during the request
     * @returns this element instance for chaining
     */
    public onCall (callback: ICallback<ICallbackCallArgs>): this {
        this.callbacks.call = callback;
        return this;
    }

    /**
     * Enables response caching for this element.
     *
     * @param duration - Cache duration in seconds (default: 20)
     * @returns this element instance for chaining
     */
    public withCache (duration = 20): this {
        this.cache = duration;
        return this;
    }

    /**
     * Enables request retries for this element.
     *
     * @param maxRetries - Maximum number of retry attempts (default: 2)
     * @returns this element instance for chaining
     */
    public withRetry (maxRetries = 2): this {
        this.retry = maxRetries;
        return this;
    }
}
