/**
 * Maximum number of entries the cache can hold before evicting the oldest.
 */
const DEFAULT_MAX_SIZE = 1000;

/**
 * A singleton cache implementation that provides in-memory storage with time-based expiration
 * and LRU eviction policy.
 *
 * The cache stores key-value pairs with optional time-to-live (TTL) durations.
 * When a TTL is specified, cached items will automatically expire after the specified duration.
 * When the cache reaches its maximum size, the least recently used entry is evicted.
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
     * Map insertion order is used for LRU eviction.
     *
     * @private
     */
    private cache: Map<string, { data: unknown; expiry: number }>;

    /**
     * Maximum number of entries allowed in the cache.
     *
     * @private
     */
    private maxSize: number;

    /**
     * Private constructor to enforce singleton pattern.
     * Initializes an empty cache storage.
     *
     * @param maxSize - Maximum cache entries before eviction
     * @private
     */
    private constructor (maxSize: number = DEFAULT_MAX_SIZE) {
        this.cache = new Map();
        this.maxSize = maxSize;
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
     * Evicts the least recently used entry if the cache is full.
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
    public set (key: string, value: unknown, ttl: number = 0): void {
        // Delete first so re-insertion moves to end (most recent)
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Evict oldest entry if at capacity
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey !== undefined) {
                this.cache.delete(oldestKey);
            }
        }

        const expiry = ttl > 0 ? Date.now() + ttl : Infinity;
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
     * Moves the accessed entry to the most recent position (LRU).
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
    public get (key: string): unknown | null {
        if (this.has(key)) {
            const entry = this.cache.get(key)!;
            // Move to end (most recently used) for LRU
            this.cache.delete(key);
            this.cache.set(key, entry);
            return entry.data;
        }
        return null;
    }

    /**
     * Removes all entries from the cache.
     *
     * @example
     * ```typescript
     * Cache.i.clear();
     * ```
     */
    public clear (): void {
        this.cache.clear();
    }

    /**
     * Returns the number of entries currently in the cache.
     *
     * @returns The number of cached entries
     */
    public get size (): number {
        return this.cache.size;
    }
}
