import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Cache, Klaim, Registry, Route} from "../src";
import fetchWithCache from "../src/tools/fetchWithCache";
import hashStr from "../src/tools/hashStr";

const apiUrl = "https://example.com";
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

function setup() {
    let route!: ReturnType<typeof Route.get>;
    const api = Api.create("testApi", apiUrl, () => {
        route = Route.get("testRoute", "/products");
    });
    return {api, route, call: Klaim.testApi.testRoute};
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return {promise, resolve, reject};
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

describe("Cache", () => {
    it.each([false, 0, -0, NaN] as const)("falls back to API seconds for route %s", async value => {
        const {api, route, call} = setup();
        api.withCache(1);
        route.cache = value;
        expect(await call()).toEqual({id: 1});
        vi.setSystemTime(1000);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        vi.setSystemTime(1001);
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(route.cache).toBe(value);
    });

    it.each([false, 0, -0, NaN] as const)("bypasses cache for falsy %s without an API fallback", async value => {
        const {api, route, call} = setup();
        api.cache = value;
        route.cache = value;
        const has = vi.spyOn(Cache.i, "has");
        const set = vi.spyOn(Cache.i, "set");
        expect(await call()).toEqual({id: 1});
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(has).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
    });

    it("preserves fractional seconds without rounding", async () => {
        const {route, call} = setup();
        route.withCache(0.0015);
        const now = vi.spyOn(Date, "now").mockReturnValue(0);
        expect(await call()).toEqual({id: 1});
        now.mockReturnValue(1.5);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        now.mockReturnValue(1.6);
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([-5, -Infinity, Infinity, Number.MAX_VALUE])("keeps route %s unbounded even with an API TTL", async value => {
        const {api, route, call} = setup();
        api.withCache(1);
        route.withCache(value);
        expect(await call()).toEqual({id: 1});
        vi.setSystemTime(1_000_000);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("shares the unbounded TTL key across non-positive and infinite durations", async () => {
        const {route, call} = setup();
        route.withCache(-5);
        expect(await call()).toEqual({id: 1});
        route.withCache(Infinity);
        expect(await call()).toEqual({id: 1});
        route.withCache(Number.MAX_VALUE);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("starts absolute TTL at decoded insertion, not request start or reads", async () => {
        const {route, call} = setup();
        route.withCache(1);
        const body = deferred<unknown>();
        const started = deferred<void>();
        const response = new Response();
        vi.spyOn(response, "json").mockImplementation(() => { started.resolve(); return body.promise; });
        fetchMock.mockResolvedValueOnce(response);
        const pending = call();
        await started.promise;
        vi.setSystemTime(5000);
        expect(Cache.i.size).toBe(0);
        body.resolve({id: "slow"});
        expect(await pending).toEqual({id: "slow"});
        vi.setSystemTime(5500);
        expect(await call()).toEqual({id: "slow"});
        vi.setSystemTime(6000);
        expect(await call()).toEqual({id: "slow"});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        vi.setSystemTime(6001);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("captures TTL and policy after before and before onCall/retries", async () => {
        const {api, route, call} = setup();
        api.withCache(1);
        route.before(() => { route.withCache(2).withResponsePolicy("http"); });
        route.withRetry(1).onCall(() => { route.withCache(9).withResponsePolicy("legacy"); });
        fetchMock.mockRejectedValueOnce(new Error("retry"));
        const pending = call();
        await vi.advanceTimersByTimeAsync(300);
        expect(await pending).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        route.callbacks.before = null;
        route.callbacks.call = null;
        route.withCache(2).withResponsePolicy("http");
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        vi.setSystemTime(3000);
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it.each(["ttl", "policy"] as const)("captures concurrent %s policies independently", async dimension => {
        const {route, call} = setup();
        route.withCache(1).withResponsePolicy("legacy");
        await call();
        const [input, init] = fetchMock.mock.calls[0];
        // Concurrent identical calls are now coalesced by request-level dedup
        // (see src/tools/dedupe.ts); exercise the cache layer directly here so
        // this test keeps validating that cache identity captures ttl/policy
        // independently of later route mutations, unaffected by dedup. A
        // dedicated namespace keeps this isolated from the warmup call above.
        const namespace = "direct-cache-policy-test";
        const first = deferred<Response>();
        fetchMock.mockImplementationOnce(() => first.promise);
        const pending = fetchWithCache(input, init, {ttl: 1000, namespace, policy: "legacy"});
        const secondCallOptions = dimension === "ttl"
            ? {ttl: 2000, namespace, policy: "legacy" as const}
            : {ttl: 1000, namespace, policy: "http" as const};
        expect(await fetchWithCache(input, init, secondCallOptions)).toEqual({id: 2});
        first.resolve(new Response(JSON.stringify({id: "first"})));
        expect(await pending).toEqual({id: "first"});
        expect(await fetchWithCache(input, init, secondCallOptions)).toEqual({id: 2});
        expect(await fetchWithCache(input, init, {ttl: 1000, namespace, policy: "legacy"})).toEqual({id: "first"});
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(Cache.i.size).toBe(3);
    });

    it("does not coalesce cache misses at the cache layer, and the last successful write wins", async () => {
        const {route, call} = setup();
        route.withCache(1);
        await call();
        const [input, init] = fetchMock.mock.calls[0];
        // Bypasses request-level dedup on purpose: this validates the cache
        // layer's own concurrent-miss handling, independently of the newer
        // GET request coalescing added in src/tools/dedupe.ts. A dedicated
        // namespace keeps this isolated from the warmup call above.
        const namespace = "direct-cache-miss-test";
        const first = deferred<Response>();
        const second = deferred<Response>();
        fetchMock.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
        const a = fetchWithCache(input, init, {ttl: 1000, namespace});
        const b = fetchWithCache(input, init, {ttl: 1000, namespace});
        expect(fetchMock).toHaveBeenCalledTimes(3);
        second.resolve(new Response(JSON.stringify({id: "B"})));
        expect(await b).toEqual({id: "B"});
        first.resolve(new Response(JSON.stringify({id: "A"})));
        expect(await a).toEqual({id: "A"});
        expect(await fetchWithCache(input, init, {ttl: 1000, namespace})).toEqual({id: "A"});
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("does not replace a successful concurrent entry on decode rejection", async () => {
        const {route, call} = setup();
        route.withCache(1);
        await call();
        const [input, init] = fetchMock.mock.calls[0];
        // Bypasses request-level dedup on purpose: identical concurrent Klaim
        // calls would now be coalesced, which would prevent exercising this
        // cache-layer decode-rejection race at all. A dedicated namespace
        // keeps this isolated from the warmup call above.
        const namespace = "direct-cache-decode-rejection-test";
        const first = deferred<Response>();
        fetchMock.mockImplementationOnce(() => first.promise);
        const failed = expect(fetchWithCache(input, init, {ttl: 1000, namespace})).rejects.toBeInstanceOf(SyntaxError);
        expect(await fetchWithCache(input, init, {ttl: 1000, namespace})).toEqual({id: 2});
        first.resolve(new Response("not JSON"));
        await failed;
        expect(await fetchWithCache(input, init, {ttl: 1000, namespace})).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("isolates different init values", async () => {
        const {route, call} = setup();
        route.withCache(1);
        expect(await call()).toEqual({id: 1});
        route.before(({config}) => ({config: {...config, headers: {"X-Test": "other"}}}));
        expect(await call()).toEqual({id: 2});
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each([undefined, {method: "GET"}])("preserves direct helper number/absent/object legacy keys with init %s", async init => {
        const key = hashStr(`${apiUrl}${JSON.stringify(init)}`);
        expect(await fetchWithCache(apiUrl, init, 5000)).toEqual({id: 1});
        expect(Cache.i.get(key)).toEqual({id: 1});
        vi.setSystemTime(5000);
        expect(await fetchWithCache(apiUrl, init, {ttl: 5000})).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        vi.setSystemTime(5001);
        expect(await fetchWithCache(apiUrl, init)).toEqual({id: 2});
        vi.setSystemTime(1_000_000);
        expect(await fetchWithCache(apiUrl, init, {})).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("applies object TTL milliseconds without namespace and preserves historical signals", async () => {
        const init = {signal: new AbortController().signal};
        expect(await fetchWithCache(apiUrl, init, {ttl: 10})).toEqual({id: 1});
        expect(Cache.i.get(hashStr(`${apiUrl}${JSON.stringify(init)}`))).toEqual({id: 1});
        vi.setSystemTime(10);
        expect(await fetchWithCache(apiUrl, init)).toEqual({id: 1});
        vi.setSystemTime(11);
        expect(await fetchWithCache(apiUrl, init)).toEqual({id: 2});
        expect(await fetchWithCache(apiUrl)).toEqual({id: 3});
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("leaves Cache.set milliseconds and zero-without-expiry unchanged", () => {
        Cache.i.set("finite", "one", 1);
        Cache.i.set("unbounded", "two", 0);
        vi.setSystemTime(1);
        expect(Cache.i.get("finite")).toBe("one");
        vi.setSystemTime(2);
        expect(Cache.i.get("finite")).toBeNull();
        vi.setSystemTime(1_000_000);
        expect(Cache.i.get("unbounded")).toBe("two");
    });

    it("isolates aliases with identical URLs and init", async () => {
        Api.create("testApi", apiUrl, () => {
            Route.get("one", "/products").withCache(1);
            Route.get("two", "/products").withCache(1);
        });
        expect(await Klaim.testApi.one()).toEqual({id: 1});
        expect(await Klaim.testApi.two()).toEqual({id: 2});
        expect(await Klaim.testApi.one()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("isolates a route's TTL changes", async () => {
        const {route, call} = setup();
        route.withCache(1);
        expect(await call()).toEqual({id: 1});
        route.withCache(2);
        expect(await call()).toEqual({id: 2});
        route.withCache(1);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("resolves policy route then API then legacy into distinct entries", async () => {
        const {api, route, call} = setup();
        route.withCache(1);
        expect(await call()).toEqual({id: 1});
        api.withResponsePolicy("http");
        expect(await call()).toEqual({id: 2});
        route.withResponsePolicy("legacy");
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("excludes only signal from v2 identity and preserves transport init", async () => {
        const {route, call} = setup();
        route.withCache(1);
        expect(await call()).toEqual({id: 1});
        const signal = new AbortController().signal;
        route.before(({config}) => ({config: {...config, signal}}));
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        Cache.i.clear();
        expect(await call()).toEqual({id: 2});
        expect(fetchMock.mock.calls[1][1]?.signal).toBe(signal);
    });

    it("uses the exact v2 key for an explicitly empty namespace", async () => {
        const init = {method: "GET", signal: new AbortController().signal};
        const options = {ttl: 500, namespace: "", policy: "http" as const};
        expect(await fetchWithCache(apiUrl, init, options)).toEqual({id: 1});
        const key = hashStr(JSON.stringify([
            "klaim-cache-v2", "", 500, "http", apiUrl, JSON.stringify({method: "GET"})
        ]));
        expect(Cache.i.get(key)).toEqual({id: 1});
        expect(fetchMock.mock.calls[0][1]).toBe(init);
    });

    it("keeps Klaim entries separate from direct historical helper calls", async () => {
        const {route, call} = setup();
        route.withCache(1);
        expect(await call()).toEqual({id: 1});
        const [input, init] = fetchMock.mock.calls[0];
        expect(await fetchWithCache(input, init, 1000)).toEqual({id: 2});
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not access cache by default", async () => {
        const {call} = setup();
        const has = vi.spyOn(Cache.i, "has");
        const set = vi.spyOn(Cache.i, "set");
        expect(await call()).toEqual({id: 1});
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(has).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
    });

    it.each(["api", "route"] as const)("uses a 20 second default at %s level", async level => {
        const fixture = setup();
        fixture[level].withCache();
        expect(await fixture.call()).toEqual({id: 1});
        vi.setSystemTime(19_999);
        expect(await fixture.call()).toEqual({id: 1});
        vi.setSystemTime(20_000);
        expect(await fixture.call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        vi.setSystemTime(20_001);
        expect(await fixture.call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it.each(["api", "route"] as const)("expires %s cache strictly after one second", async level => {
        const fixture = setup();
        fixture[level].withCache(1);
        expect(await fixture.call()).toEqual({id: 1});
        vi.setSystemTime(1000);
        expect(await fixture.call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        vi.setSystemTime(1001);
        expect(await fixture.call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("prefers the route TTL over the API without mutating either", async () => {
        const {api, route, call} = setup();
        api.withCache(1);
        route.withCache(2);
        expect(await call()).toEqual({id: 1});
        vi.setSystemTime(2000);
        expect(await call()).toEqual({id: 1});
        expect(fetchMock).toHaveBeenCalledTimes(1);
        vi.setSystemTime(2001);
        expect(await call()).toEqual({id: 2});
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect([api.cache, route.cache]).toEqual([1, 2]);
    });
});
