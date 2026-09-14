import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Cache, Klaim, Registry, Route} from "../src";

const apiUrl = "https://example.com";
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function setup() {
    let route!: ReturnType<typeof Route.get>;
    const api = Api.create("testApi", apiUrl, () => {
        route = Route.get("testRoute", "/products/[id]");
        Route.get("otherRoute", "/other");
    });
    return {api, route, call: Klaim.testApi.testRoute, other: Klaim.testApi.otherRoute};
}

beforeEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let sequence = 0;
    fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({id: ++sequence})));
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("Cache.invalidate", () => {
    it("removes every cached variant sharing a route's namespace", async () => {
        const {route, call} = setup();
        route.withCache(60);
        expect(await call({id: "1"})).toEqual({id: 1});
        expect(await call({id: "2"})).toEqual({id: 2});
        // Both are cached: no new fetch
        expect(await call({id: "1"})).toEqual({id: 1});
        expect(await call({id: "2"})).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const removed = Cache.i.invalidate("testApi.testRoute");
        expect(removed).toBe(2);

        expect(await call({id: "1"})).toEqual({id: 3});
        expect(await call({id: "2"})).toEqual({id: 4});
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it("does not affect other routes' cached entries", async () => {
        const {route, call, other} = setup();
        route.withCache(60);
        Registry.i.getRoute("testApi", "otherRoute")!.cache = 60;

        expect(await call({id: "1"})).toEqual({id: 1});
        expect(await other()).toEqual({id: 2});

        Cache.i.invalidate("testApi.testRoute");

        expect(await call({id: "1"})).toEqual({id: 3});
        expect(await other()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("matches an exact namespace but not an unrelated route with a shared prefix", async () => {
        Cache.i.set("keyA", "a", 60000, "hello.getTodo");
        Cache.i.set("keyB", "b", 60000, "hello.getTodoList");

        const removed = Cache.i.invalidate("hello.getTodo");

        expect(removed).toBe(1);
        expect(Cache.i.get("keyA")).toBeNull();
        expect(Cache.i.get("keyB")).toBe("b");
    });

    it("invalidates every namespace nested under a parent pattern", () => {
        Cache.i.set("keyA", "a", 60000, "hello.getTodo");
        Cache.i.set("keyB", "b", 60000, "hello.listTodos");
        Cache.i.set("keyC", "c", 60000, "other.route");

        const removed = Cache.i.invalidate("hello");

        expect(removed).toBe(2);
        expect(Cache.i.get("keyA")).toBeNull();
        expect(Cache.i.get("keyB")).toBeNull();
        expect(Cache.i.get("keyC")).toBe("c");
    });

    it("ignores entries stored without a namespace", () => {
        Cache.i.set("legacyKey", "value", 60000);

        const removed = Cache.i.invalidate("legacyKey");

        expect(removed).toBe(0);
        expect(Cache.i.get("legacyKey")).toBe("value");
    });

    it("returns 0 when no entry matches the pattern", () => {
        Cache.i.set("keyA", "a", 60000, "hello.getTodo");

        expect(Cache.i.invalidate("nothing.here")).toBe(0);
        expect(Cache.i.get("keyA")).toBe("a");
    });

    it("exposes an invalidate() method directly on the route handler", async () => {
        const {route, call} = setup();
        route.withCache(60);
        expect(await call({id: "1"})).toEqual({id: 1});
        expect(await call({id: "1"})).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const removed = Klaim.testApi.testRoute.invalidate();
        expect(removed).toBe(1);

        expect(await call({id: "1"})).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("route.invalidate() is a no-op when nothing was cached", () => {
        const {call} = setup();
        expect(call.invalidate()).toBe(0);
    });
});
