import { beforeEach, describe, expect, it, vi } from "vitest";
import { Api, Klaim, Route } from "../src";

// Mock fetch to control resolution timing and count invocations.
let fetchCallCount = 0;
let resolvers: Array<(value: unknown) => void> = [];

global.fetch = vi.fn(() => {
    fetchCallCount++;
    return new Promise(resolve => {
        resolvers.push(resolve as (value: unknown) => void);
    });
}) as unknown as typeof global.fetch;

/** Resolves the next pending fetch call with the given JSON body. */
function resolveNextFetch (body: unknown): void {
    const resolve = resolvers.shift();
    resolve?.({ json: () => Promise.resolve(body) });
}

/** Rejects the next pending fetch call. */
function rejectNextFetch (error: unknown): void {
    const resolve = resolvers.shift();
    // The mock's promise only exposes resolve, so reject via a rejecting json().
    resolve?.({ json: () => Promise.reject(error) });
}

beforeEach(() => {
    vi.clearAllMocks();
    fetchCallCount = 0;
    resolvers = [];
});

describe("Request Deduplication", () => {
    it("coalesces concurrent identical GET requests into a single fetch", async () => {
        const apiName = "testDedupApi1";
        Api.create(apiName, "https://example.com", () => {
            Route.get("users", "/users");
        });

        const p1 = Klaim[apiName].users();
        const p2 = Klaim[apiName].users();
        const p3 = Klaim[apiName].users();

        expect(fetchCallCount).toBe(1);

        resolveNextFetch({ id: 1 });

        const [ r1, r2, r3 ] = await Promise.all([ p1, p2, p3 ]);

        expect(r1).toEqual({ id: 1 });
        expect(r2).toEqual({ id: 1 });
        expect(r3).toEqual({ id: 1 });
        expect(fetchCallCount).toBe(1);
    });

    it("does not dedupe GET requests with different params", async () => {
        const apiName = "testDedupApi2";
        Api.create(apiName, "https://example.com", () => {
            Route.get("item", "/items/[id]");
        });

        const p1 = Klaim[apiName].item({ id: 1 });
        const p2 = Klaim[apiName].item({ id: 2 });

        expect(fetchCallCount).toBe(2);

        resolveNextFetch({ id: 1 });
        resolveNextFetch({ id: 2 });

        const [ r1, r2 ] = await Promise.all([ p1, p2 ]);
        expect(r1).toEqual({ id: 1 });
        expect(r2).toEqual({ id: 2 });
        expect(fetchCallCount).toBe(2);
    });

    it("does not dedupe mutating requests (POST/PUT/DELETE)", async () => {
        const apiName = "testDedupApi3";
        Api.create(apiName, "https://example.com", () => {
            Route.post("create", "/items");
            Route.put("update", "/items/1");
            Route.delete("remove", "/items/1");
        });

        const pPost1 = Klaim[apiName].create({}, { name: "a" });
        const pPost2 = Klaim[apiName].create({}, { name: "a" });
        const pPut = Klaim[apiName].update({}, { name: "b" });
        const pDelete = Klaim[apiName].remove();

        // Each mutating call must hit the network, even with identical payloads.
        expect(fetchCallCount).toBe(4);

        resolveNextFetch({ ok: true });
        resolveNextFetch({ ok: true });
        resolveNextFetch({ ok: true });
        resolveNextFetch({ ok: true });

        await Promise.all([ pPost1, pPost2, pPut, pDelete ]);
        expect(fetchCallCount).toBe(4);
    });

    it("cleans up after a failure so subsequent calls hit the network again", async () => {
        const apiName = "testDedupApi4";
        Api.create(apiName, "https://example.com", () => {
            Route.get("flaky", "/flaky");
        });

        const p1 = Klaim[apiName].flaky();
        const p2 = Klaim[apiName].flaky();

        expect(fetchCallCount).toBe(1);

        rejectNextFetch(new Error("boom"));

        await expect(p1).rejects.toThrow("boom");
        await expect(p2).rejects.toThrow("boom");

        // In-flight entry must have been cleared: a new call performs a new fetch.
        const p3 = Klaim[apiName].flaky();
        expect(fetchCallCount).toBe(2);

        resolveNextFetch({ recovered: true });
        await expect(p3).resolves.toEqual({ recovered: true });
    });

    it("issues a fresh request once the previous in-flight call has settled", async () => {
        const apiName = "testDedupApi5";
        Api.create(apiName, "https://example.com", () => {
            Route.get("users", "/users");
        });

        const p1 = Klaim[apiName].users();
        expect(fetchCallCount).toBe(1);
        resolveNextFetch({ id: "first" });
        await expect(p1).resolves.toEqual({ id: "first" });

        const p2 = Klaim[apiName].users();
        expect(fetchCallCount).toBe(2);
        resolveNextFetch({ id: "second" });
        await expect(p2).resolves.toEqual({ id: "second" });
    });
});
