import cleanUrl from "../tools/cleanUrl";
import toCamelCase from "../tools/toCamelCase";
import { IRateLimitConfig, DEFAULT_RATE_LIMIT_CONFIG } from "../tools/rateLimit";
import { ITimeoutConfig, DEFAULT_TIMEOUT_CONFIG } from "../tools/timeout";

/**
 * Type definition for HTTP headers
 * A record of string key-value pairs representing header names and values
 */
export type IHeaders = Record<string, string>;

/**
 * Configuration interface for pagination settings
 * @interface IPaginationConfig
 * @property {number} [page] - The default starting page number
 * @property {string} [pageParam] - The URL parameter name for page number
 * @property {number} [limit] - The default number of items per page
 * @property {string} [limitParam] - The URL parameter name for items per page
 */
export interface IPaginationConfig {
	page?: number;
	pageParam?: string;
	limit?: number;
	limitParam?: string;
}

/**
 * Arguments passed to before-request middleware callbacks
 * @interface ICallbackBeforeArgs
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
 * Arguments passed to after-request middleware callbacks
 * @interface ICallbackAfterArgs
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
 * Arguments for call middleware callbacks
 * @type ICallbackCallArgs
 */
export type ICallbackCallArgs = object;

/**
 * Generic callback type for middleware functions
 * @template ArgsType - The type of arguments passed to the callback
 */
export type ICallback<ArgsType> = (args: ArgsType) => Partial<ArgsType> | void;

/**
 * Callback type for error handling
 */
export type IErrorCallback = (error: any, context: ICallbackBeforeArgs) => void;

/**
 * Collection of middleware callbacks for an element
 * @interface IElementCallbacks
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
 * Core interface defining the structure and behavior of API elements
 * @interface IElement
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
        /** Rate limiting configuration, or false if rate limiting is disabled */
        rate: false | IRateLimitConfig;
        /** Request timeout configuration, or false if disabled */
        timeout: false | ITimeoutConfig;
	/** Reference to parent element name */
	parent?: string;
	/** HTTP method for routes */
	method?: string;
	/** Dynamic URL parameters */
	arguments: Set<string>;
	/** Response validation schema */
	schema?: any;
	/** Pagination configuration */
        pagination?: IPaginationConfig;

        /** Error handling callback */
        errorHandler: IErrorCallback | null;

	/** Adds before-request middleware */
	before(callback: ICallback<ICallbackBeforeArgs>): this;

	/** Adds after-request middleware */
	after(callback: ICallback<ICallbackAfterArgs>): this;

        /** Adds request lifecycle middleware */
        onCall(callback: ICallback<ICallbackCallArgs>): this;

        /** Adds an error handler */
        onError(callback: IErrorCallback): this;

	/** Enables response caching */
	withCache(duration?: number): this;

	/** Enables request retries */
	withRetry(maxRetries?: number): this;

	/** Configures pagination settings */
	withPagination(config?: IPaginationConfig): this;

        /** Enables rate limiting */
        withRate(config?: Partial<IRateLimitConfig>): this;

        /** Enables request timeout */
        withTimeout(duration?: number, message?: string): this;
}

/**
 * Default configuration for pagination
 * @constant DEFAULT_PAGINATION_CONFIG
 */
const DEFAULT_PAGINATION_CONFIG: IPaginationConfig = {
	page: 1,
	pageParam: 'page',
	limit: 10,
	limitParam: 'limit'
};

/**
 * Abstract base class implementing common functionality for API elements
 * @abstract
 * @class Element
 * @implements {IElement}
 */
export abstract class Element implements IElement {
	public type: "api" | "route" | "group";
	public name: string;
	public url: string;
	public headers: IHeaders;
	public parent?: string;
	public method?: string;
	public arguments: Set<string> = new Set<string>();
	public schema?: any;
	public pagination?: IPaginationConfig;

	public callbacks: IElementCallbacks = {
		before: null,
		after: null,
		call: null
	};

        public cache: false | number = false;
        public retry: false | number = false;
        public rate: false | IRateLimitConfig = false;
        public timeout: false | ITimeoutConfig = false;
        public errorHandler: IErrorCallback | null = null;

	/**
	 * Creates a new element with the specified properties
	 * @param {("api"|"route"|"group")} type - Element type identifier
	 * @param {string} name - Unique name for the element
	 * @param {string} url - Base URL or path segment
	 * @param {IHeaders} [headers={}] - HTTP headers for the element
	 */
	protected constructor(
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
	 * Adds a before-request middleware callback
	 * @param {ICallback<ICallbackBeforeArgs>} callback - Function to execute before the request
	 * @returns {this} The element instance for chaining
	 */
	public before(callback: ICallback<ICallbackBeforeArgs>): this {
		this.callbacks.before = callback;
		return this;
	}

	/**
	 * Adds an after-request middleware callback
	 * @param {ICallback<ICallbackAfterArgs>} callback - Function to execute after the response
	 * @returns {this} The element instance for chaining
	 */
	public after(callback: ICallback<ICallbackAfterArgs>): this {
		this.callbacks.after = callback;
		return this;
	}

	/**
	 * Adds a request lifecycle middleware callback
	 * @param {ICallback<ICallbackCallArgs>} callback - Function to execute during the request
	 * @returns {this} The element instance for chaining
	 */
        public onCall(callback: ICallback<ICallbackCallArgs>): this {
                this.callbacks.call = callback;
                return this;
        }

        /**
         * Adds an error handling callback
         * @param callback - Function executed when an error occurs
         */
        public onError(callback: IErrorCallback): this {
                this.errorHandler = callback;
                return this;
        }

	/**
	 * Enables response caching for this element
	 * @param {number} [duration=20] - Cache duration in seconds
	 * @returns {this} The element instance for chaining
	 */
	public withCache = (duration: number = 20): this => {
		this.cache = duration;
		return this;
	};

	/**
	 * Enables request retries for this element
	 * @param {number} [maxRetries=2] - Maximum number of retry attempts
	 * @returns {this} The element instance for chaining
	 */
	public withRetry = (maxRetries: number = 2): this => {
		this.retry = maxRetries;
		return this;
	};

	/**
	 * Configures pagination settings for this element
	 * @param {IPaginationConfig} [config={}] - Pagination configuration options
	 * @returns {this} The element instance for chaining
	 * @example
	 * ```typescript
	 * Route.get("listItems", "/items").withPagination({
	 *   page: 1,
	 *   pageParam: 'page',
	 *   limit: 20,
	 *   limitParam: 'size'
	 * });
	 * ```
	 */
	public withPagination(config: IPaginationConfig = {}): this {
		this.pagination = {
			...DEFAULT_PAGINATION_CONFIG,
			...config
		};
		return this;
	}

	/**
	 * Enables rate limiting for this element
	 * @param {Partial<IRateLimitConfig>} [config] - Rate limiting configuration options
	 * @returns {this} The element instance for chaining
	 * @example
	 * ```typescript
	 * Route.get("getUser", "/users/[id]").withRate({ limit: 5, duration: 10 });
	 * ```
	 */
        public withRate = (config: Partial<IRateLimitConfig> = {}): this => {
                this.rate = {
                        ...DEFAULT_RATE_LIMIT_CONFIG,
                        ...config
                };
                return this;
        };

        /**
         * Enables request timeout for this element
         * @param {number} [duration] - Timeout duration in seconds
         * @param {string} [message] - Custom error message
         * @returns {this} The element instance for chaining
         */
        public withTimeout = (
                duration: number = DEFAULT_TIMEOUT_CONFIG.duration,
                message: string = DEFAULT_TIMEOUT_CONFIG.message
        ): this => {
                this.timeout = { duration, message };
                return this;
        };
}