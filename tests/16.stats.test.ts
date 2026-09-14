import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Cache, Hook, Klaim, Registry, Route, Stats} from "../src";

const apiUrl = "https://example.com";
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function setup () {
    let route!: ReturnType<typeof Route.get>;
    const api = Api.create("statsApi", apiUrl, () => {
        route = Route.get("statsRoute", "/items");
    });
    return {api, route, call: Klaim.statsApi.statsRoute};
}

beforeEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    Stats.i.reset();
    Hook.unsubscribeAll();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({id: 1})));
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    Stats.i.reset();
    Hook.unsubscribeAll();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("Stats", () => {
    it("returns null for an unobserved route", () => {
        expect(Stats.i.get("nothing.here")).toBeNull();
    });

    it("counts successful calls and computes latency", async () => {
        const {call} = setup();
        await call();
        await call();
        const stats = Stats.i.get("statsApi.statsRoute");
        expect(stats).not.toBeNull();
        expect(stats!.calls).toBe(2);
        expect(stats!.errors).toBe(0);
        expect(stats!.errorRate).toBe(0);
        expect(stats!.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("tracks errors and error rate without interrupting the throw", async () => {
        const {call} = setup();
        fetchMock.mockImplementationOnce(async () => { throw new Error("boom"); });
        await expect(call()).rejects.toThrow("boom");
        await call();
        const stats = Stats.i.get("statsApi.statsRoute");
        expect(stats!.calls).toBe(2);
        expect(stats!.errors).toBe(1);
        expect(stats!.errorRate).toBe(0.5);
    });

    it("tracks cache hit rate", async () => {
        const {route, call} = setup();
        route.withCache(10);
        await call();
        await call();
        const stats = Stats.i.get("statsApi.statsRoute");
        expect(stats!.calls).toBe(2);
        expect(stats!.cacheHits).toBe(1);
        expect(stats!.cacheHitRate).toBe(0.5);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("getAll returns metrics for every observed route", async () => {
        const {call} = setup();
        Api.create("otherApi", apiUrl, () => {
            Route.get("otherRoute", "/others");
        });
        await call();
        await Klaim.otherApi.otherRoute();
        const all = Stats.i.getAll();
        expect(Object.keys(all).sort()).toEqual([ "otherApi.otherRoute", "statsApi.statsRoute" ]);
        expect(all["statsApi.statsRoute"].calls).toBe(1);
        expect(all["otherApi.otherRoute"].calls).toBe(1);
    });

    it("reset clears all collected metrics", async () => {
        const {call} = setup();
        await call();
        expect(Stats.i.get("statsApi.statsRoute")).not.toBeNull();
        Stats.i.reset();
        expect(Stats.i.get("statsApi.statsRoute")).toBeNull();
        expect(Stats.i.getAll()).toEqual({});
    });

    it("does not conflict with a user Hook.subscribe on the same route", async () => {
        const {call} = setup();
        let userHookCalls = 0;
        Hook.subscribe("statsApi.statsRoute", () => { userHookCalls++; });
        await call();
        await call();
        expect(userHookCalls).toBe(2);
        expect(Stats.i.get("statsApi.statsRoute")!.calls).toBe(2);
    });

    it("keeps p95 latency bounded and non-negative under many calls", async () => {
        const {call} = setup();
        for (let i = 0; i < 150; i++) {
            await call();
        }
        const stats = Stats.i.get("statsApi.statsRoute")!;
        expect(stats.calls).toBe(150);
        expect(stats.p95LatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("record() can be called directly without throwing on unknown routes", () => {
        Stats.i.record("manual.route", 42, true, false);
        const stats = Stats.i.get("manual.route")!;
        expect(stats.calls).toBe(1);
        expect(stats.avgLatencyMs).toBe(42);
    });
});
