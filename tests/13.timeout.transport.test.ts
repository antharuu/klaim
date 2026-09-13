// @vitest-environment node
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServer} from "node:http";
import type {Socket} from "node:net";
import {Api, Cache, Hook, Klaim, Registry, RetryExhaustedError, Route, TimeoutError} from "../src";
import fetchWithCache from "../src/tools/fetchWithCache";
import {runWithTimeout} from "../src/tools/timeout";

function deferred<T> () {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
    return {promise, resolve, reject};
}

function responseFixture (data: Promise<unknown>) {
    const read = vi.fn(() => data);
    const body = vi.fn(() => null);
    const response = {json: read, text: read, arrayBuffer: read, blob: read, formData: read,
        get body () { return body(); }} as unknown as Response;
    return {response, read, body};
}

function routeFor (cache: boolean) {
    let route!: ReturnType<typeof Route.get>;
    Api.create("transport", "http://localhost", () => {
        route = Route.get("slow", "/slow").withTimeout(0.05);
        if (cache) route.withCache(10);
    });
    return route;
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

describe.each([false, true])("timeout transport cache=%s", cache => {
    it("never publishes a body completed after timeout", async () => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        const body = deferred<unknown>();
        const fixture = responseFixture(body.promise);
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(fixture.response)));
        routeFor(cache);
        const set = vi.spyOn(Cache.i, "set");
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.read).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toBeInstanceOf(TimeoutError);
        body.resolve({late: true});
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.read).toHaveBeenCalledTimes(1);
        expect(fixture.body).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(Cache.i.size).toBe(0);
        expect(vi.getTimerCount()).toBe(timers);
    });

    it.each(["success", "sync", "network", "timeout"])("cleans timer and caller relay on %s", async outcome => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        const caller = new AbortController();
        const add = vi.spyOn(caller.signal, "addEventListener");
        const remove = vi.spyOn(caller.signal, "removeEventListener");
        const abort = vi.fn();
        const failure = new Error("network");
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
            init?.signal?.addEventListener("abort", abort);
            if (outcome === "sync") throw failure;
            if (outcome === "network") return Promise.reject(failure);
            if (outcome === "timeout") return new Promise<Response>(() => {});
            return Promise.resolve(responseFixture(Promise.resolve(42)).response);
        }));
        routeFor(cache).before(({config}) => ({config: {...config, signal: caller.signal}}));
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        const value = await result;
        if (outcome === "success") expect(value).toBe(42);
        else if (outcome === "timeout") expect(value).toBeInstanceOf(TimeoutError);
        else expect(value).toBe(failure);
        expect(abort).toHaveBeenCalledTimes(outcome === "timeout" ? 1 : 0);
        expect(add).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenCalledExactlyOnceWith("abort", add.mock.calls[0][1]);
        expect(vi.getTimerCount()).toBe(timers);
    });

    it("returns the winning TimeoutError rather than cooperative fetch AbortError", async () => {
        vi.useFakeTimers();
        let reason: unknown;
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
                reason = init.signal?.reason;
                reject(new DOMException("aborted", "AbortError"));
            });
        })));
        routeFor(cache);
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toBe(reason);
        expect(await result).toBeInstanceOf(TimeoutError);
    });

    it("guards late headers when AbortController is unavailable", async () => {
        vi.useFakeTimers();
        vi.stubGlobal("AbortController", undefined);
        const headers = deferred<Response>();
        const fixture = responseFixture(Promise.resolve(42));
        vi.stubGlobal("fetch", vi.fn(() => headers.promise));
        routeFor(cache);
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toBeInstanceOf(TimeoutError);
        headers.resolve(fixture.response);
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.read).not.toHaveBeenCalled();
        expect(fixture.body).not.toHaveBeenCalled();
        expect(Cache.i.size).toBe(0);
    });

    it("consumes a losing network rejection over three event-loop turns", async () => {
        vi.useFakeTimers();
        const pending = deferred<Response>();
        const unhandled = vi.fn();
        process.on("unhandledRejection", unhandled);
        try {
            vi.stubGlobal("fetch", vi.fn(() => pending.promise));
            routeFor(cache);
            const result = Klaim.transport.slow().catch((error: unknown) => error);
            await vi.advanceTimersByTimeAsync(50);
            expect(await result).toBeInstanceOf(TimeoutError);
            pending.reject(new Error("late rejection"));
            vi.useRealTimers();
            for (let i = 0; i < 3; i++) await new Promise<void>(resolve => setImmediate(resolve));
            expect(unhandled).not.toHaveBeenCalled();
        } finally {
            process.removeListener("unhandledRejection", unhandled);
        }
    });

    it.each([false, true])("preserves preabort and in-flight caller reasons, timeout=%s", async timeout => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        for (const preabort of [false, true]) {
            Registry.i.reset();
            Cache.i.clear();
            const caller = new AbortController();
            const reason = new Error("caller");
            if (preabort) caller.abort(reason);
            const signals: (AbortSignal | null | undefined)[] = [];
            vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
                const signal = init?.signal;
                signals.push(signal);
                if (signal?.aborted) reject(signal.reason);
                else signal?.addEventListener("abort", () => reject(signal.reason), {once: true});
            })));
            const route = routeFor(cache);
            if (!timeout) route.timeout = false;
            route.before(({config}) => ({config: {...config, signal: caller.signal}}));
            const result = Klaim.transport.slow().catch((error: unknown) => error);
            if (!preabort) caller.abort(reason);
            expect(await result).toBe(reason);
            expect(signals[0]?.reason).toBe(reason);
            if (timeout) expect(signals[0]).not.toBe(caller.signal);
            else expect(signals[0]).toBe(caller.signal);
            expect(vi.getTimerCount()).toBe(timers);
        }
    });

    it("does not turn caller abort into a terminal policy on deaf transport", async () => {
        vi.useFakeTimers();
        const caller = new AbortController();
        const headers = deferred<Response>();
        vi.stubGlobal("fetch", vi.fn(() => headers.promise));
        routeFor(cache).before(({config}) => ({config: {...config, signal: caller.signal}}));
        const result = Klaim.transport.slow();
        caller.abort(new Error("caller"));
        headers.resolve(responseFixture(Promise.resolve(42)).response);
        await expect(result).resolves.toBe(42);
    });

    it("aborts once and never reads late headers or runs success effects", async () => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        const headers = deferred<Response>();
        const fixture = responseFixture(Promise.resolve({late: true}));
        const abort = vi.fn();
        let signal: AbortSignal | null | undefined;
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
            signal = init?.signal;
            signal?.addEventListener("abort", abort);
            return headers.promise;
        }));
        const route = routeFor(cache);
        const after = vi.fn();
        const validate = vi.fn((value: unknown) => Promise.resolve(value));
        route.after(after);
        route.schema = {validate};
        const hook = vi.fn();
        Hook.subscribe("transport.slow", hook);
        const set = vi.spyOn(Cache.i, "set");
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        const error = await result;
        expect(error).toBeInstanceOf(TimeoutError);
        headers.resolve(fixture.response);
        await vi.advanceTimersByTimeAsync(0);
        expect(fixture.read).not.toHaveBeenCalled();
        expect(fixture.body).not.toHaveBeenCalled();
        expect(set).not.toHaveBeenCalled();
        expect(validate).not.toHaveBeenCalled();
        expect(after).not.toHaveBeenCalled();
        expect(hook).not.toHaveBeenCalled();
        expect(signal).toBeInstanceOf(AbortSignal);
        expect(signal?.reason).toBe(error);
        expect(abort).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(timers);
    });
});

describe("attempt setup and cache isolation", () => {
    it("memorizes the identical guard error before abort and after cleanup", async () => {
        vi.useFakeTimers();
        let guard!: () => void;
        let observed: unknown;
        const result = runWithTimeout((signal, assertActive) => new Promise((_resolve, reject) => {
            guard = assertActive;
            signal?.addEventListener("abort", () => {
                try { guard(); } catch (error: unknown) { observed = error; }
                expect(observed).toBe(signal.reason);
                reject(new DOMException("aborted", "AbortError"));
            });
        }), {duration: 0.05, message: "winner"}).catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toBe(observed);
        let afterCleanup: unknown;
        try { guard(); } catch (error: unknown) { afterCleanup = error; }
        expect(afterCleanup).toBe(observed);
    });
    it.each(["constructor", "listener", "timer"])("cleans partial setup after %s throws", async phase => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        const caller = new AbortController();
        const remove = vi.spyOn(caller.signal, "removeEventListener");
        const failure = new Error("setup");
        if (phase === "constructor") {
            vi.stubGlobal("AbortController", class { constructor () { throw failure; } });
        } else if (phase === "listener") {
            const add = caller.signal.addEventListener.bind(caller.signal);
            vi.spyOn(caller.signal, "addEventListener").mockImplementation((...args) => { add(...args); throw failure; });
        } else {
            vi.spyOn(globalThis, "setTimeout").mockImplementation(() => { throw failure; });
        }
        const operation = vi.fn(() => Promise.resolve(42));
        await expect(runWithTimeout(operation, {duration: 1, message: "slow"}, caller.signal)).rejects.toBe(failure);
        expect(operation).not.toHaveBeenCalled();
        expect(remove).toHaveBeenCalledTimes(phase === "constructor" ? 0 : 1);
        expect(vi.getTimerCount()).toBe(timers);
    });

    it("consumes a platform abort exception without changing the timeout", async () => {
        vi.useFakeTimers();
        vi.spyOn(AbortController.prototype, "abort").mockImplementation(() => { throw new Error("platform"); });
        const result = runWithTimeout(() => new Promise(() => {}), {duration: 0.05, message: "winner"})
            .catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toMatchObject({name: "TimeoutError", message: "winner"});
    });

    it("does not abort an already caller-aborted controller a second time", async () => {
        vi.useFakeTimers();
        const caller = new AbortController();
        caller.abort(new Error("caller"));
        const abort = vi.spyOn(AbortController.prototype, "abort");
        const result = runWithTimeout(() => new Promise(() => {}), {duration: 0.05, message: "slow"}, caller.signal)
            .catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(50);
        expect(await result).toBeInstanceOf(TimeoutError);
        expect(abort).toHaveBeenCalledExactlyOnceWith(caller.signal.reason);
    });

    it("arms cache hits but neither fetches nor aborts, preserving signal-excluded identity", async () => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        const fetch = vi.fn(() => Promise.resolve(responseFixture(Promise.resolve(42)).response));
        vi.stubGlobal("fetch", fetch);
        const route = routeFor(true);
        route.timeout = false;
        await expect(Klaim.transport.slow()).resolves.toBe(42);
        fetch.mockClear();
        route.withTimeout(0.05);
        const Native = globalThis.AbortController;
        let controllers = 0;
        vi.stubGlobal("AbortController", class extends Native { constructor () { super(); controllers++; } });
        const abort = vi.spyOn(Native.prototype, "abort");
        const has = Cache.i.has.bind(Cache.i);
        vi.spyOn(Cache.i, "has").mockImplementation(key => {
            expect(controllers).toBe(1);
            expect(vi.getTimerCount()).toBe(timers + 1);
            return has(key);
        });
        await expect(Klaim.transport.slow()).resolves.toBe(42);
        expect(controllers).toBe(1);
        expect(fetch).not.toHaveBeenCalled();
        expect(abort).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(timers);
    });

    it("never lets the expired attempt overwrite the successful retry cache", async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
        const oldBody = deferred<unknown>();
        const signals: (AbortSignal | null | undefined)[] = [];
        const fetch = vi.fn((_input: unknown, init?: RequestInit) => {
            signals.push(init?.signal);
            return Promise.resolve(responseFixture(signals.length === 1 ? oldBody.promise : Promise.resolve("new")).response);
        });
        vi.stubGlobal("fetch", fetch);
        const route = routeFor(true).withRetry(1);
        const after = vi.fn();
        const validate = vi.fn((value: unknown) => Promise.resolve(value));
        const hook = vi.fn();
        route.after(after);
        route.schema = {validate};
        Hook.subscribe("transport.slow", hook);
        const set = vi.spyOn(Cache.i, "set");
        const result = Klaim.transport.slow();
        await vi.advanceTimersByTimeAsync(249);
        expect(fetch).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        await expect(result).resolves.toBe("new");
        oldBody.resolve("old");
        await vi.advanceTimersByTimeAsync(0);
        expect(set).toHaveBeenCalledTimes(1);
        expect(signals[0]).not.toBe(signals[1]);
        expect(after).toHaveBeenCalledTimes(1);
        expect(validate).toHaveBeenCalledTimes(1);
        expect(hook).toHaveBeenCalledTimes(1);
        await expect(Klaim.transport.slow()).resolves.toBe("new");
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("runs a guard immediately before cache insertion without an intervening await", async () => {
        let guarded = false;
        const set = vi.spyOn(Cache.i, "set").mockImplementation(() => { expect(guarded).toBe(true); });
        vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(responseFixture(Promise.resolve(42)).response)));
        await fetchWithCache("http://localhost", undefined, {namespace: "guard", assertActive: () => {
            guarded = true;
            queueMicrotask(() => { guarded = false; });
        }});
        expect(set).toHaveBeenCalledTimes(1);
    });

    it("gives concurrent attempts independent controllers and budgets", async () => {
        vi.useFakeTimers();
        const signals: (AbortSignal | null | undefined)[] = [];
        const bodies = [deferred<unknown>(), deferred<unknown>()];
        vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
            signals.push(init?.signal);
            return Promise.resolve(responseFixture(bodies[signals.length - 1].promise).response);
        }));
        const route = routeFor(false);
        const first = Klaim.transport.slow().catch((error: unknown) => error);
        route.withTimeout(1);
        const second = Klaim.transport.slow();
        await vi.advanceTimersByTimeAsync(50);
        expect(await first).toBeInstanceOf(TimeoutError);
        expect(signals[0]?.aborted).toBe(true);
        expect(signals[1]?.aborted).toBe(false);
        bodies[1].resolve(42);
        await expect(second).resolves.toBe(42);
    });
});

describe("retry timeout contract", () => {
    it("reports a final timeout cause after an earlier network rejection", async () => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
        const network = new Error("network");
        vi.stubGlobal("fetch", vi.fn()
            .mockRejectedValueOnce(network)
            .mockImplementation(() => new Promise<Response>(() => {})));
        routeFor(false).withRetry(1);
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(250);
        const error = await result as RetryExhaustedError;
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect(error.attempts).toBe(2);
        expect(error.cause).toBeInstanceOf(TimeoutError);
        expect(error.cause).not.toBe(network);
    });
    it("allocates three complete attempt budgets and reports the last TimeoutError cause", async () => {
        vi.useFakeTimers();
        const timers = vi.getTimerCount();
        vi.spyOn(Math, "random").mockReturnValue(0);
        const signals: (AbortSignal | null | undefined)[] = [];
        const fetch = vi.fn((_input: unknown, init?: RequestInit) => {
            signals.push(init?.signal);
            return new Promise<Response>(() => {});
        });
        vi.stubGlobal("fetch", fetch);
        const onCall = vi.fn();
        routeFor(false).withRetry(2).onCall(onCall);
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        for (const [advance, calls] of [[49, 1], [200, 1], [1, 2], [49, 2], [400, 2], [1, 3], [49, 3]]) {
            await vi.advanceTimersByTimeAsync(advance);
            expect(fetch).toHaveBeenCalledTimes(calls);
        }
        expect(signals[2]?.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        const error = await result;
        expect(error).toBeInstanceOf(RetryExhaustedError);
        expect(error).toMatchObject({attempts: 3, message: "Failed to fetch http://localhost/slow after 3 attempts"});
        expect((error as RetryExhaustedError).cause).toBe(signals[2]?.reason);
        expect((error as RetryExhaustedError).cause).toBeInstanceOf(TimeoutError);
        expect(new Set(signals).size).toBe(3);
        expect(onCall).toHaveBeenCalledTimes(3);
        expect(vi.getTimerCount()).toBe(timers);
    });

    it.each([[false, false], [false, true], [true, false], [true, true]])("retains caller signal and full backoff, timeout=%s preabort=%s", async (timeout, preabort) => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
        const caller = new AbortController();
        const reason = new Error("caller");
        if (preabort) caller.abort(reason);
        const add = vi.spyOn(caller.signal, "addEventListener");
        const remove = vi.spyOn(caller.signal, "removeEventListener");
        const signals: (AbortSignal | null | undefined)[] = [];
        const fetch = vi.fn((_input: unknown, init?: RequestInit) => {
            signals.push(init?.signal);
            return Promise.reject(init?.signal?.aborted ? init.signal.reason : new Error("network"));
        });
        vi.stubGlobal("fetch", fetch);
        const route = routeFor(false).withRetry(2);
        if (!timeout) route.timeout = false;
        route.before(({config}) => ({config: {...config, signal: caller.signal}}));
        const result = Klaim.transport.slow().catch((error: unknown) => error);
        await vi.advanceTimersByTimeAsync(0);
        if (!preabort) caller.abort(reason); // Backoff is not interrupted.
        await vi.advanceTimersByTimeAsync(199);
        expect(fetch).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(399);
        expect(fetch).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(await result).toMatchObject({name: "RetryExhaustedError", attempts: 3, cause: reason});
        expect(signals[2]?.reason).toBe(reason);
        expect(add).toHaveBeenCalledTimes(timeout ? 3 : 0);
        expect(remove.mock.calls).toEqual(add.mock.calls);
        if (timeout) expect(new Set(signals).size).toBe(3);
        else expect(signals).toEqual([caller.signal, caller.signal, caller.signal]);
    });
});

describe.each([false, true])("native Node fetch cache=%s", cache => {
    it.each([false, true])("closes the server stream before any voluntary end, headers=%s", async sendHeaders => {
        vi.useRealTimers();
        const received = deferred<void>();
        const closed = deferred<void>();
        const reading = deferred<void>();
        const nativeJson = Response.prototype.json;
        const json = vi.spyOn(Response.prototype, "json").mockImplementation(function (this: Response) {
            reading.resolve();
            return nativeJson.call(this);
        });
        const otherReads = ["text", "arrayBuffer", "blob", "formData"] as const;
        const readers = otherReads.map(method => vi.spyOn(Response.prototype, method));
        const body = vi.spyOn(Response.prototype, "body", "get");
        const sockets = new Set<Socket>();
        let voluntaryEnd = false;
        let closedBeforeEnd = false;
        const server = createServer((_request, response) => {
            response.on("close", () => {
                closedBeforeEnd = !voluntaryEnd;
                closed.resolve();
            });
            if (sendHeaders) {
                response.writeHead(200, {"Content-Type": "application/json"});
                response.flushHeaders();
                response.write('{"open":');
            }
            received.resolve();
            // Intentionally no response.end(): client cancellation must close this stream.
        });
        server.on("connection", socket => {
            sockets.add(socket);
            socket.on("close", () => sockets.delete(socket));
        });
        let watchdog: ReturnType<typeof setTimeout> | undefined;
        try {
            await new Promise<void>((resolve, reject) => {
                server.once("error", reject);
                server.listen(0, "127.0.0.1", resolve);
            });
            const address = server.address();
            if (!address || typeof address === "string") throw new Error("Missing ephemeral port");
            Api.create("native", `http://127.0.0.1:${address.port}`, () => {
                const route = Route.get("slow", "/slow").withTimeout(0.3);
                if (cache) route.withCache(10);
            });
            const set = vi.spyOn(Cache.i, "set");
            const result = Klaim.native.slow().catch((error: unknown) => error);
            const bounded = new Promise<never>((_resolve, reject) => {
                watchdog = setTimeout(() => reject(new Error("Transport did not close")), 5000);
            });
            await Promise.race([received.promise, bounded]);
            if (sendHeaders) await Promise.race([reading.promise, bounded]);
            expect(await Promise.race([result, bounded])).toBeInstanceOf(TimeoutError);
            await Promise.race([closed.promise, bounded]);
            expect(closedBeforeEnd).toBe(true);
            expect(set).not.toHaveBeenCalled();
            expect(Cache.i.size).toBe(0);
            expect(json).toHaveBeenCalledTimes(sendHeaders ? 1 : 0);
            for (const reader of readers) expect(reader).not.toHaveBeenCalled();
            expect(body).not.toHaveBeenCalled();
        } finally {
            voluntaryEnd = true;
            clearTimeout(watchdog);
            for (const socket of sockets) socket.destroy();
            await new Promise<void>(resolve => server.close(() => resolve()));
        }
    }, 10000);
});
