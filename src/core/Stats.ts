import { Hook } from "./Hook";

/**
 * Maximum number of recent latency samples kept per route for percentile estimation.
 * Bounded so memory usage never grows with call volume (sliding window, not an
 * ever-growing array).
 */
const LATENCY_WINDOW_SIZE = 100;

/**
 * Aggregated metrics tracked for a single route.
 */
export interface IRouteStats {
    /** Fully qualified route name, e.g. "api.users.list". */
    routeName: string;
    /** Total number of calls observed, successful or not. */
    calls: number;
    /** Number of calls that threw an error. */
    errors: number;
    /** Number of calls served from cache. */
    cacheHits: number;
    /** Cumulative running average latency in milliseconds across all calls. */
    avgLatencyMs: number;
    /** Approximate 95th percentile latency in milliseconds, from a bounded recent sample window. */
    p95LatencyMs: number;
    /** Error rate as a ratio between 0 and 1. */
    errorRate: number;
    /** Cache hit rate as a ratio between 0 and 1. */
    cacheHitRate: number;
}

/**
 * Internal, mutable per-route accumulator. Kept separate from the public
 * `IRouteStats` snapshot so hot-path updates stay minimal allocations.
 */
interface IRouteAccumulator {
    calls: number;
    errors: number;
    cacheHits: number;
    avgLatencyMs: number;
    /** Bounded sliding window of recent latencies, used only for p95 estimation. */
    latencyWindow: number[];
    /** Next write index in the sliding window (circular buffer). */
    windowIndex: number;
}

/**
 * A singleton, Hook-based observability module that collects lightweight,
 * non-blocking metrics for every Klaim route call: call count, running
 * average latency, an approximate p95 latency, error rate and cache hit rate.
 *
 * Stats subscribes through `Hook.onAny`, the multi-listener observation point,
 * so it never conflicts with a user's own `Hook.subscribe` callback on the
 * same route. All per-call work is O(1) (a running average update and a
 * bounded circular-buffer write), so it stays cheap in the hot request path.
 *
 * @example
 * ```typescript
 * // Read aggregated metrics for one route
 * const stats = Stats.i.get("api.users.list");
 *
 * // Read metrics for every observed route
 * const all = Stats.i.getAll();
 *
 * // Reset all collected metrics (e.g. between test runs)
 * Stats.i.reset();
 * ```
 */
export class Stats {
    /**
     * The singleton instance of the Stats class.
     *
     * @private
     */
    private static _instance: Stats;

    /**
     * Internal storage for per-route accumulators, keyed by fully qualified route name.
     *
     * @private
     */
    private routes: Map<string, IRouteAccumulator>;

    /**
     * Function that removes this instance's global Hook observer, used to
     * make `reset`/re-initialization safe against duplicate subscriptions.
     *
     * @private
     */
    private unsubscribe: () => void;

    /**
     * Private constructor to enforce singleton pattern.
     * Subscribes to every route call through `Hook.onAny`.
     *
     * @private
     */
    private constructor () {
        this.routes = new Map();
        this.unsubscribe = Hook.onAny((routeName, payload) => {
            this.record(routeName, payload.durationMs, payload.success, payload.cacheHit);
        });
    }

    /**
     * Gets the singleton instance of Stats.
     * Creates the instance, and its Hook subscription, if it doesn't exist yet.
     *
     * @returns The singleton Stats instance
     * @example
     * ```typescript
     * const stats = Stats.i;
     * ```
     */
    public static get i (): Stats {
        if (!Stats._instance) {
            Stats._instance = new Stats();
        }
        return Stats._instance;
    }

    /**
     * Records a single call observation for a route. This is the hot-path entry
     * point: it only updates O(1) running aggregates and writes one slot in a
     * bounded circular buffer, so it never grows memory or blocks on heavy computation.
     *
     * @param routeName - The fully qualified route name (e.g., "api.users.list")
     * @param durationMs - The call duration in milliseconds
     * @param success - Whether the call completed without throwing
     * @param cacheHit - Whether the call was served from cache
     */
    public record (routeName: string, durationMs: number, success: boolean, cacheHit: boolean): void {
        let acc = this.routes.get(routeName);
        if (!acc) {
            acc = {
                calls: 0,
                errors: 0,
                cacheHits: 0,
                avgLatencyMs: 0,
                latencyWindow: [],
                windowIndex: 0
            };
            this.routes.set(routeName, acc);
        }

        acc.calls += 1;
        if (!success) acc.errors += 1;
        if (cacheHit) acc.cacheHits += 1;

        // Cumulative running average: avoids storing every latency sample.
        acc.avgLatencyMs += (durationMs - acc.avgLatencyMs) / acc.calls;

        // Bounded circular buffer for p95 estimation: fixed memory footprint.
        if (acc.latencyWindow.length < LATENCY_WINDOW_SIZE) {
            acc.latencyWindow.push(durationMs);
        } else {
            acc.latencyWindow[acc.windowIndex] = durationMs;
        }
        acc.windowIndex = (acc.windowIndex + 1) % LATENCY_WINDOW_SIZE;
    }

    /**
     * Retrieves aggregated metrics for a single route.
     *
     * @param routeName - The fully qualified route name (e.g., "api.users.list")
     * @returns The route's aggregated metrics, or null if no call was observed yet
     * @example
     * ```typescript
     * const stats = Stats.i.get("api.users.list");
     * if (stats) {
     *   console.log(stats.avgLatencyMs, stats.errorRate);
     * }
     * ```
     */
    public get (routeName: string): IRouteStats | null {
        const acc = this.routes.get(routeName);
        if (!acc) return null;
        return toSnapshot(routeName, acc);
    }

    /**
     * Retrieves aggregated metrics for every observed route.
     *
     * @returns A map of route name to its aggregated metrics
     * @example
     * ```typescript
     * for (const [route, metrics] of Object.entries(Stats.i.getAll())) {
     *   console.log(route, metrics.calls);
     * }
     * ```
     */
    public getAll (): Record<string, IRouteStats> {
        const result: Record<string, IRouteStats> = {};
        this.routes.forEach((acc, routeName) => {
            result[routeName] = toSnapshot(routeName, acc);
        });
        return result;
    }

    /**
     * Removes all collected metrics for every route.
     *
     * @example
     * ```typescript
     * Stats.i.reset();
     * ```
     */
    public reset (): void {
        this.routes.clear();
    }

    /**
     * Stops observing route calls by removing this instance's global Hook
     * subscription. Mainly useful for tests that need a clean teardown.
     *
     * @example
     * ```typescript
     * Stats.i.dispose();
     * ```
     */
    public dispose (): void {
        this.unsubscribe();
    }
}

/**
 * Builds an immutable public snapshot from an internal accumulator, computing
 * derived ratios and the p95 estimate on read rather than on every call.
 *
 * @param routeName - The fully qualified route name
 * @param acc - The internal accumulator to snapshot
 * @returns The computed, read-only route statistics
 */
function toSnapshot (routeName: string, acc: IRouteAccumulator): IRouteStats {
    return {
        routeName,
        calls: acc.calls,
        errors: acc.errors,
        cacheHits: acc.cacheHits,
        avgLatencyMs: acc.avgLatencyMs,
        p95LatencyMs: computeP95(acc.latencyWindow),
        errorRate: acc.calls > 0 ? acc.errors / acc.calls : 0,
        cacheHitRate: acc.calls > 0 ? acc.cacheHits / acc.calls : 0
    };
}

/**
 * Computes an approximate 95th percentile from a bounded sample window.
 *
 * @param samples - Recent latency samples in milliseconds
 * @returns The estimated p95 latency in milliseconds, or 0 if there are no samples
 */
function computeP95 (samples: number[]): number {
    if (samples.length === 0) return 0;
    const sorted = [ ...samples ].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
    return sorted[Math.max(0, index)];
}
