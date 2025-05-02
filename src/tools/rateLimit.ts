/**
 * Configuration interface for rate limiting settings
 * @interface IRateLimitConfig
 * @property {number} limit - Maximum number of requests allowed in the given duration
 * @property {number} duration - Time window in seconds for the rate limit
 */
export interface IRateLimitConfig {
    limit: number;
    duration: number;
}

/**
 * Default configuration for rate limiting
 * @constant DEFAULT_RATE_LIMIT_CONFIG
 */
export const DEFAULT_RATE_LIMIT_CONFIG: IRateLimitConfig = {
    limit: 5,
    duration: 10 // seconds
};

// Store request timestamps for rate limiting
type RequestLog = {
    timestamps: number[]; // Timestamps of requests
};

// Global request log
const requestLogs: Map<string, RequestLog> = new Map();

/**
 * Checks if a request should be rate limited
 * 
 * @param key - Unique identifier for the API/route combination
 * @param config - Rate limiting configuration
 * @returns True if the request should be allowed, false if it should be rate limited
 */
export function checkRateLimit(key: string, config: IRateLimitConfig): boolean {
    const now = Date.now();
    const timeWindow = config.duration * 1000; // Convert to milliseconds
    
    // Get or initialize request log for this key
    let requestLog = requestLogs.get(key);
    if (!requestLog) {
        requestLog = { timestamps: [] };
        requestLogs.set(key, requestLog);
    }
    
    // Clean up old timestamps outside the current time window
    const validTimestamps = requestLog.timestamps.filter(
        time => now - time < timeWindow
    );
    
    // Check if we've hit the rate limit
    if (validTimestamps.length >= config.limit) {
        return false; // Rate limited
    }
    
    // Add current timestamp and update the log
    validTimestamps.push(now);
    requestLog.timestamps = validTimestamps;
    
    return true; // Request allowed
}

/**
 * Calculates time remaining until the next request is allowed
 * 
 * @param key - Unique identifier for the API/route combination
 * @param config - Rate limiting configuration
 * @returns Time in milliseconds until the next request is allowed, or 0 if not rate limited
 */
export function getTimeUntilNextRequest(key: string, config: IRateLimitConfig): number {
    const requestLog = requestLogs.get(key);
    if (!requestLog || requestLog.timestamps.length < config.limit) {
        return 0; // Not rate limited
    }
    
    const now = Date.now();
    const timeWindow = config.duration * 1000;
    
    // Sort timestamps in ascending order
    const sortedTimestamps = [...requestLog.timestamps].sort((a, b) => a - b);
    
    // Oldest timestamp + timeWindow = when it will expire
    const oldestValidTime = sortedTimestamps[0];
    const timeUntilExpiry = (oldestValidTime + timeWindow) - now;
    
    return Math.max(0, timeUntilExpiry);
} 