import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Cache, Group, Hook, Klaim, RateLimitError, Registry, Route, TimeoutError} from "../src";
import {withTimeout} from "../src/tools/timeout";

beforeEach(() => {
    vi.clearAllMocks();
    Registry.i.reset();
    Cache.i.clear();
    Hook.unsubscribeAll();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Registry.i.reset();
    Cache.i.clear();
    Hook.unsubscribeAll();
});

describe("Timeout", () => {
    it("captures the helper message when the timeout is armed", async () => {
        const config = {duration: 0.05, message: "original"};
        const result = withTimeout(new Promise(() => {}), config).catch((error: unknown) => error);
        config.message = "changed";
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toMatchObject({name: "TimeoutError", message: "original"});
    });
    it("cleans the public helper timer after success", async () => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        await expect(withTimeout(Promise.resolve(42), {duration: 1, message: "slow"})).resolves.toBe(42);
        expect(vi.getTimerCount()).toBe(timers);
    });
    it("cleans the public helper on rejection and preserves the original error", async () => {
        const timers = vi.getTimerCount();
        const failure = new Error("network");
        await expect(withTimeout(Promise.reject(failure), {duration: 1, message: "slow"})).rejects.toBe(failure);
        expect(vi.getTimerCount()).toBe(timers);
    });

    it("keeps timeout disabled by default without controllers or timers", async () => {
        const timers = vi.getTimerCount();
        const construct = vi.fn();
        vi.stubGlobal("AbortController", class { constructor () { construct(); } });
        vi.stubGlobal("fetch", vi.fn(async () => ({json: async () => 42})));
        Api.create("timeout", "http://localhost", () => Route.get("slow", "/slow"));
        await expect(Klaim.timeout.slow()).resolves.toBe(42);
        expect(construct).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(timers);
    });

    it.each(["default", "route", "api"])("keeps seconds, defaults, message and precedence: %s", async scope => {
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        const api = Api.create("timeout", "http://localhost", () => {
            const route = Route.get("slow", "/slow");
            if (scope === "default") route.withTimeout();
            if (scope === "route") route.withTimeout(0.05, "Too slow");
        });
        if (scope === "route") api.withTimeout(10, "API");
        if (scope === "api") api.withTimeout(0.05, "Too slow");
        const settled = vi.fn();
        const result = Klaim.timeout.slow().catch((error: unknown) => { settled(); return error; });
        await vi.advanceTimersByTimeAsync(scope === "default" ? 4999 : 49);
        expect(settled).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(await result).toBeInstanceOf(TimeoutError);
        expect(await result).toMatchObject({name: "TimeoutError", message: scope === "default" ? "Request timed out" : "Too slow"});
    });

    it("preserves timeout propagation to existing direct group children", () => {
        let inherited!: ReturnType<typeof Route.get>;
        let explicit!: ReturnType<typeof Route.get>;
        Api.create("timeout", "http://localhost", () => {
            Group.create("group", () => {
                inherited = Route.get("inherited", "/inherited");
                explicit = Route.get("explicit", "/explicit").withTimeout(2);
            }).withTimeout(1);
        });
        expect(inherited.timeout).toEqual({duration: 1, message: "Request timed out"});
        expect(explicit.timeout).toEqual({duration: 2, message: "Request timed out"});
    });

    it("does not arm timeout when rate limiting rejects before the attempt", async () => {
        const timers = vi.getTimerCount();
        const construct = vi.fn();
        vi.stubGlobal("AbortController", class { constructor () { construct(); } });
        const fetch = vi.fn();
        vi.stubGlobal("fetch", fetch);
        Api.create("timeoutRate", "http://localhost", () => {
            Route.get("slow", "/slow").withRate({limit: 0, duration: 1}).withTimeout(1);
        });
        await expect(Klaim.timeoutRate.slow()).rejects.toBeInstanceOf(RateLimitError);
        expect(fetch).not.toHaveBeenCalled();
        expect(construct).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(timers);
    });

    it("starts after before/onCall and cleans before validation/after/Hook", async () => {
        const timers = vi.getTimerCount();
        let finish!: (value: unknown) => void;
        const validation = new Promise<unknown>(resolve => { finish = resolve; });
        const checkOutside = vi.fn(() => {
            expect(vi.getTimerCount()).toBe(timers);
            vi.advanceTimersByTime(1000);
        });
        vi.stubGlobal("fetch", vi.fn(async () => {
            expect(vi.getTimerCount()).toBe(timers + 1);
            return {json: async () => 42};
        }));
        Api.create("timeout", "http://localhost", () => {
            const route = Route.get("slow", "/slow").withTimeout(0.05)
                .before(checkOutside).onCall(checkOutside).after(checkOutside);
            route.schema = {validate: () => { checkOutside(); return validation; }};
        });
        Hook.subscribe("timeout.slow", checkOutside);
        const result = Klaim.timeout.slow();
        await vi.advanceTimersByTimeAsync(0);
        await vi.advanceTimersByTimeAsync(5000);
        finish(42);
        await expect(result).resolves.toBe(42);
        expect(checkOutside).toHaveBeenCalledTimes(5);
    });
});
