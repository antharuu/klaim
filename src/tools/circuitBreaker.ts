/**
 * Circuit breaker state machine, keyed per API/route like {@link module:tools/rateLimit}.
 *
 * Design choice: the breaker wraps the *whole* `fetchWithRetry` attempt budget, not
 * each individual retry attempt. A single call to a route is one "operation" from the
 * breaker's point of view: it is checked once before the retry loop starts, and only the
 * loop's final outcome (all attempts exhausted vs. at least one success) is recorded against
 * it. This mirrors the natural failure unit an operator cares about ("this endpoint is down")
 * and avoids opening the circuit prematurely from transient retry-internal failures that the
 * existing backoff/jitter logic is already designed to absorb. When the circuit is open, calls
 * fail fast before consuming any retry attempt or touching the network.
 */

/**
 * The three states of a circuit breaker.
 *
 * - `closed`: requests flow normally; consecutive failures are counted.
 * - `open`: requests are rejected immediately without hitting the network.
 * - `half-open`: a single probe request is allowed through to test recovery.
 */
export type CircuitBreakerState = "closed" | "open" | "half-open";

/**
 * Configuration interface for circuit breaker settings
 *
 * @interface ICircuitBreakerConfig
 * @property {number} failureThreshold - Number of consecutive failures before opening the circuit
 * @property {number} resetTimeout - Time in seconds to wait before moving from open to half-open
 */
export interface ICircuitBreakerConfig {
    failureThreshold: number;
    resetTimeout: number; // seconds
}

/**
 * Default configuration for the circuit breaker
 *
 * @constant DEFAULT_CIRCUIT_BREAKER_CONFIG
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: ICircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeout: 30 // seconds
};

/** Internal per-key breaker state. */
type BreakerRecord = {
    state: CircuitBreakerState;
    consecutiveFailures: number;
    openedAt: number | null;
    /** True while a half-open probe is in flight, to avoid letting concurrent calls race the probe. */
    probing: boolean;
};

// Global breaker state store, keyed by API/route identifier.
const breakerStates: Map<string, BreakerRecord> = new Map();

/**
 * Retrieves (creating if absent) the breaker record for a key.
 *
 * @param key - Unique identifier for the API/route combination
 * @returns The breaker record for that key
 */
function getRecord (key: string): BreakerRecord {
    let record = breakerStates.get(key);
    if (!record) {
        record = { state: "closed", consecutiveFailures: 0, openedAt: null, probing: false };
        breakerStates.set(key, record);
    }
    return record;
}

/**
 * Computes the milliseconds remaining before an open circuit may move to half-open.
 *
 * @param record - Breaker record
 * @param config - Circuit breaker configuration
 * @returns Milliseconds remaining, or 0 if none
 */
function timeUntilHalfOpen (record: BreakerRecord, config: ICircuitBreakerConfig): number {
    if (record.state !== "open" || record.openedAt === null) return 0;
    const elapsed = Date.now() - record.openedAt;
    const remaining = config.resetTimeout * 1000 - elapsed;
    return Math.max(0, remaining);
}

/**
 * Determines whether a call is currently allowed to proceed, transitioning `open` to
 * `half-open` once the reset timeout has elapsed. Call this once per operation, before the
 * retry loop, not once per retry attempt.
 *
 * @param key - Unique identifier for the API/route combination
 * @param config - Circuit breaker configuration
 * @returns `{ allowed: true }` if the call may proceed, or `{ allowed: false, retryAfterMs }`
 * if the circuit is open and the call should fail fast
 */
export function checkCircuitBreaker (
    key: string,
    config: ICircuitBreakerConfig
): { allowed: true } | { allowed: false; retryAfterMs: number } {
    const record = getRecord(key);

    if (record.state === "open") {
        const remaining = timeUntilHalfOpen(record, config);
        if (remaining > 0) {
            return { allowed: false, retryAfterMs: remaining };
        }
        // Reset timeout elapsed: allow a single probe through as half-open.
        record.state = "half-open";
        record.probing = true;
        return { allowed: true };
    }

    if (record.state === "half-open") {
        // A probe is already in flight (or was just allowed); block concurrent callers
        // from also hitting the network until the probe settles.
        if (record.probing) {
            return { allowed: false, retryAfterMs: 0 };
        }
        record.probing = true;
        return { allowed: true };
    }

    return { allowed: true };
}

/**
 * Records the outcome of a completed operation (i.e. the whole retry-attempt budget, not a
 * single attempt), updating the breaker's state accordingly.
 *
 * @param key - Unique identifier for the API/route combination
 * @param config - Circuit breaker configuration
 * @param success - Whether the operation ultimately succeeded
 */
export function reportCircuitBreakerResult (
    key: string,
    config: ICircuitBreakerConfig,
    success: boolean
): void {
    const record = getRecord(key);

    if (success) {
        // Any success, whether from closed or from a half-open probe, fully resets the breaker.
        record.state = "closed";
        record.consecutiveFailures = 0;
        record.openedAt = null;
        record.probing = false;
        return;
    }

    if (record.state === "half-open") {
        // Failed probe: reopen immediately and restart the reset timeout.
        record.state = "open";
        record.openedAt = Date.now();
        record.probing = false;
        return;
    }

    record.consecutiveFailures++;
    if (record.consecutiveFailures >= config.failureThreshold) {
        record.state = "open";
        record.openedAt = Date.now();
    }
}

/**
 * Returns the current state of a breaker without mutating it.
 *
 * @param key - Unique identifier for the API/route combination
 * @returns Current circuit breaker state, defaulting to `closed` when never used
 */
export function getCircuitBreakerState (key: string): CircuitBreakerState {
    return breakerStates.get(key)?.state ?? "closed";
}

/**
 * Resets a breaker's state entirely, mainly intended for tests.
 *
 * @param key - Unique identifier for the API/route combination
 */
export function resetCircuitBreaker (key: string): void {
    breakerStates.delete(key);
}
