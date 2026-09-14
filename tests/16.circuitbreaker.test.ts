import { beforeEach, describe, expect, it, vi } from "vitest";
import { Api, Klaim, Route } from "../src";

// Mock fetch pour simuler les réponses API sans faire de vraies requêtes
let fetchImpl: () => Promise<unknown> = () => Promise.resolve({ success: true });
global.fetch = vi.fn(() => {
    const impl = fetchImpl;
    return Promise.resolve({
        json: () => Promise.resolve(impl())
    });
}) as unknown as typeof global.fetch;

function makeFailingFetch (): void {
    global.fetch = vi.fn(() => Promise.reject(new Error("network down"))) as unknown as typeof global.fetch;
}

function makeSucceedingFetch (): void {
    global.fetch = vi.fn(() =>
        Promise.resolve({
            json: () => Promise.resolve({ success: true })
        })
    ) as unknown as typeof global.fetch;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    makeSucceedingFetch();
});

describe("Circuit Breaker", () => {
    it("stays closed while failures are below the threshold", async () => {
        const apiName = "testBreakerApi1";
        const apiUrl = "https://example.com";
        const routeName = "testBreakerRoute1";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withBreaker({ failureThreshold: 3, resetTimeout: 10 });
        });

        makeFailingFetch();

        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();

        // Third call would open the circuit next attempt, but neither the first two
        // failures reached the threshold, so both went to the network.
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("opens the circuit after consecutive failures and fails fast without hitting the network", async () => {
        const apiName = "testBreakerApi2";
        const apiUrl = "https://example.com";
        const routeName = "testBreakerRoute2";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withBreaker({ failureThreshold: 2, resetTimeout: 10 });
        });

        makeFailingFetch();

        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(2);

        // Circuit is now open: the next call should fail fast with CircuitOpenError,
        // without calling fetch again.
        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Circuit breaker open/);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("moves to half-open after the reset timeout and closes again on a successful probe", async () => {
        vi.useFakeTimers();
        const apiName = "testBreakerApi3";
        const apiUrl = "https://example.com";
        const routeName = "testBreakerRoute3";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withBreaker({ failureThreshold: 1, resetTimeout: 5 });
        });

        makeFailingFetch();
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(1);

        // Circuit is open now; fail fast without touching fetch.
        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Circuit breaker open/);
        expect(fetch).toHaveBeenCalledTimes(1);

        // Advance past the reset timeout so the breaker allows a half-open probe.
        vi.advanceTimersByTime(5000 + 1);

        makeSucceedingFetch();
        await Klaim[apiName][routeName]();
        expect(fetch).toHaveBeenCalledTimes(1);

        // Circuit is closed again: subsequent calls flow normally.
        await Klaim[apiName][routeName]();
        expect(fetch).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
    });

    it("reopens the circuit when the half-open probe also fails", async () => {
        vi.useFakeTimers();
        const apiName = "testBreakerApi4";
        const apiUrl = "https://example.com";
        const routeName = "testBreakerRoute4";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withBreaker({ failureThreshold: 1, resetTimeout: 5 });
        });

        makeFailingFetch();
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(5000 + 1);

        // Probe also fails: circuit reopens.
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(2);

        // Immediately re-checking should fail fast again (circuit reopened).
        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Circuit breaker open/);
        expect(fetch).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
    });

    it("applies circuit breaker at the API level when the route has no config", async () => {
        const apiName = "testBreakerApi5";
        const apiUrl = "https://example.com";
        const routeName1 = "testBreakerRoute5A";
        const routeName2 = "testBreakerRoute5B";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName1, "/test1");
            Route.get(routeName2, "/test2");
        }).withBreaker({ failureThreshold: 2, resetTimeout: 10 });

        makeFailingFetch();

        // Failures on different routes of the same API count towards the same breaker.
        await expect(Klaim[apiName][routeName1]()).rejects.toThrow();
        await expect(Klaim[apiName][routeName2]()).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(2);

        // Third call, on either route, should fail fast.
        await expect(Klaim[apiName][routeName1]()).rejects.toThrow(/Circuit breaker open/);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("does not consume retry attempts while the circuit is open", async () => {
        const apiName = "testBreakerApi6";
        const apiUrl = "https://example.com";
        const routeName = "testBreakerRoute6";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withBreaker({ failureThreshold: 1, resetTimeout: 10 }).withRetry(3);
        });

        makeFailingFetch();

        // First call: retry is exhausted (4 attempts total: 1 + 3 retries), then breaker opens.
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(fetch).toHaveBeenCalledTimes(4);

        // Second call: circuit is open, fails fast without any retry attempt hitting fetch.
        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Circuit breaker open/);
        expect(fetch).toHaveBeenCalledTimes(4);
    });
});
