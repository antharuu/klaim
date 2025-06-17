/**
 * A singleton cache implementation that provides in-memory storage with time-based expiration.
 *
 * The cache stores key-value pairs with optional time-to-live (TTL) durations.
 * When a TTL is specified, cached items will automatically expire after the specified duration.
 *
 * @example
 * ```typescript
 * const cache = Cache.i;
 * cache.set("key", "value", 60000); // Cache for 1 minute
 * const value = cache.get("key"); // Retrieves value if not expired
 * ```
 */
export class Cache {
    /**
     * The singleton instance of the Cache class.
     *
     * @private
     */
    private static _instance: Cache;

    /**
     * Internal storage for cached items.
     * Maps keys to objects containing the data and expiration timestamp.
     *
     * @private
     */
    private cache: Map<string, { data: any; expiry: number }>;

    /**
     * Private constructor to enforce singleton pattern.
     * Initializes an empty cache storage.
     *
     * @private
     */
    private constructor () {
        this.cache = new Map();
    }

    /**
     * Gets the singleton instance of the Cache.
     * Creates the instance if it doesn't exist.
     *
     * @returns The singleton Cache instance
     * @example
     * ```typescript
     * const cache = Cache.i;
     * ```
     */
    public static get i (): Cache {
        if (!Cache._instance) {
            Cache._instance = new Cache();
        }
        return Cache._instance;
    }

    /**
     * Stores a value in the cache with an optional time-to-live duration.
     *
     * @param key - Unique identifier for the cached item
     * @param value - The data to cache
     * @param ttl - Time to live in milliseconds. If 0 or not provided, the item won't expire
     * @example
     * ```typescript
     * // Cache a value for 5 minutes
     * Cache.i.set("userProfile", userData, 300000);
     *
     * // Cache without expiration
     * Cache.i.set("appConfig", configData);
     * ```
     */
    public set (key: string, value: any, ttl: number = 0): void {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { data: value, expiry });
    }

    /**
     * Checks if the cache contains a valid (non-expired) entry for the given key.
     * Automatically removes expired entries when encountered.
     *
     * @param key - The key to check in the cache
     * @returns true if a valid cache entry exists, false otherwise
     * @example
     * ```typescript
     * if (Cache.i.has("userProfile")) {
     *   // Handle cached data exists
     * }
     * ```
     */
    public has (key: string): boolean {
        const cacheEntry = this.cache.get(key);
        if (!cacheEntry) {
            return false;
        }

        if (Date.now() > cacheEntry.expiry) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Retrieves a value from the cache if it exists and hasn't expired.
     * Returns null for non-existent or expired entries.
     *
     * @param key - The key of the cached item to retrieve
     * @returns The cached value if valid, null otherwise
     * @example
     * ```typescript
     * const userData = Cache.i.get("userProfile");
     * if (userData) {
     *   // Use cached data
     * } else {
     *   // Handle cache miss
     * }
     * ```
     */
    public get (key: string): any | null {
        if (this.has(key)) {
            return this.cache.get(key)!.data;
        }
        return null;
    }

    /**
     * Removes a specific entry from the cache.
     *
     * @param key - The key of the cached item to delete
     * @example
     * ```typescript
     * Cache.i.delete("userProfile");
     * ```
     */
    public delete (key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clears all entries from the cache.
     *
     * @example
     * ```typescript
     * Cache.i.clear();
     * ```
     */
    public clear (): void {
        this.cache.clear();
    }
}
