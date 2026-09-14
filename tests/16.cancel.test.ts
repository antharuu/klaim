import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, CancelledError, Cache, Hook, Klaim, Registry, Route, TimeoutError} from "../src";

function deferred<T> () {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

beforeEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    Hook.unsubscribeAll();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    Hook.unsubscribeAll();
    Cache.i.clear();
    Registry.i.reset();
});

describe("Cancellation", () => {
    it("exposes a .cancel() method on the returned promise", async () => {
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow"));
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        const call = Klaim.cancel.slow();
        expect(typeof call.cancel).toBe("function");
        call.cancel();
        await expect(call).rejects.toBeInstanceOf(CancelledError);
    });

    it("rejects with a CancelledError when cancelled before the transport is armed", async () => {
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow"));
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        const call = Klaim.cancel.slow();
        call.cancel();
        await expect(call).rejects.toBeInstanceOf(CancelledError);
    });

    it("rejects with a custom reason when one is supplied", async () => {
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow"));
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        const call = Klaim.cancel.slow();
        const reason = new Error("custom reason");
        call.cancel(reason);
        await expect(call).rejects.toBe(reason);
    });

    it("aborts the underlying transport signal when a timeout budget is active", async () => {
        vi.useFakeTimers();
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow").withTimeout(5));
        let signal: AbortSignal | null | undefined;
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
            signal = init?.signal;
            signal?.addEventListener("abort", () => reject(signal?.reason));
        })));
        const call = Klaim.cancel.slow();
        await vi.advanceTimersByTimeAsync(0);
        call.cancel();
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal?.aborted).toBe(true);
        await expect(call).rejects.toBeInstanceOf(CancelledError);
    });

    it("only cancels the specific call, leaving concurrent calls to the same route unaffected", async () => {
        const bodies = [deferred<unknown>(), deferred<unknown>()];
        const signals: (AbortSignal | null | undefined)[] = [];
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow/[id]"));
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
            signals.push(init?.signal);
            const index = signals.length - 1;
            return Promise.resolve({json: () => bodies[index].promise});
        }));
        const first = Klaim.cancel.slow({id: 1});
        const second = Klaim.cancel.slow({id: 2});
        first.cancel();
        bodies[1].resolve(42);
        await expect(first).rejects.toBeInstanceOf(CancelledError);
        await expect(second).resolves.toBe(42);
    });

    it("has no effect when called after the call has already settled", async () => {
        Api.create("cancel", "http://localhost", () => Route.get("fast", "/fast"));
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({json: () => Promise.resolve(42)})));
        const call = Klaim.cancel.fast();
        await expect(call).resolves.toBe(42);
        expect(() => call.cancel()).not.toThrow();
    });

    it("has no effect when called twice, keeping the first reason", async () => {
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow"));
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        const call = Klaim.cancel.slow();
        const first = new Error("first");
        const second = new Error("second");
        call.cancel(first);
        call.cancel(second);
        await expect(call).rejects.toBe(first);
    });

    it("cooperatively rejects at the next checkpoint without AbortController support", async () => {
        vi.stubGlobal("AbortController", undefined);
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow"));
        const headers = deferred<{json: () => Promise<unknown>}>();
        vi.stubGlobal("fetch", vi.fn(() => headers.promise));
        const call = Klaim.cancel.slow();
        call.cancel();
        headers.resolve({json: () => Promise.resolve(42)});
        await expect(call).rejects.toBeInstanceOf(CancelledError);
    });

    it("still allows the runner to time out normally when a call is never cancelled", async () => {
        vi.useFakeTimers();
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow").withTimeout(0.05));
        vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
        const call = Klaim.cancel.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        expect(await call).toBeInstanceOf(TimeoutError);
    });

    it("preserves a custom cancellation reason instead of TimeoutError, even under a timeout", async () => {
        vi.useFakeTimers();
        Api.create("cancel", "http://localhost", () => Route.get("slow", "/slow").withTimeout(5));
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        })));
        const call = Klaim.cancel.slow();
        await vi.advanceTimersByTimeAsync(0);
        const reason = new Error("user cancelled");
        call.cancel(reason);
        await expect(call).rejects.toBe(reason);
    });

    it("does not collide with an externally supplied config.signal", async () => {
        Api.create("cancel", "http://localhost", () => {
            Route.get("slow", "/slow").before(({config}) => {
                const caller = new AbortController();
                return {config: {...config, signal: caller.signal}};
            });
        });
        const abort = vi.fn();
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
            init?.signal?.addEventListener("abort", abort);
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
            });
        }));
        const call = Klaim.cancel.slow();
        call.cancel();
        await expect(call).rejects.toBeInstanceOf(CancelledError);
    });
});
