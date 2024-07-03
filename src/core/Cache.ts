/**
 * A simple cache implementation that stores key-value pairs with a time-to-live (TTL) in milliseconds.
 */
export class Cache {
    private static _instance: Cache;

    private cache: Map<string, { data: any; expiry: number }>;

    /**
     * Private constructor to prevent instantiation from outside the class.
     */
    private constructor () {
        this.cache = new Map();
    }

    /**
     * Provides access to the singleton instance of the class.
     *
     * @returns The singleton instance of Cache.
     */
    public static get i (): Cache {
        if (!Cache._instance) {
            Cache._instance = new Cache();
        }
        return Cache._instance;
    }

    /**
     * Sets the cache for a specific key.
     *
     * @param key The key to cache the value under.
     * @param value The value to be cached.
     * @param ttl Time to live in milliseconds.
     */
    public set (key: string, value: any, ttl: number): void {
        const expiry = Date.now() + ttl;
        this.cache.set(key, { data: value, expiry });
    }

    /**
     * Checks if the cache has a valid entry for the given key.
     *
     * @param key The key to check in the cache.
     * @returns True if a valid cache entry exists, otherwise false.
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
     * Gets the cached value for the given key.
     *
     * @param key The key to retrieve from the cache.
     * @returns The cached value or null if not found or expired.
     */
    public get (key: string): any | null {
        if (this.has(key)) {
            return this.cache.get(key)!.data;
        }
        return null;
    }
}
