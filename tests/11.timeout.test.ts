import { describe, expect, it, vi, beforeEach } from "vitest";
import { Api, Klaim, Route } from "../src";

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Timeout", () => {
    it("should throw on timeout", async () => {
        global.fetch = vi.fn(() =>
            new Promise(resolve => {
                setTimeout(() => resolve({ json: () => Promise.resolve({ ok: true }) }), 200);
            })
        ) as any;

        const apiName = "timeoutApi";
        const apiUrl = "https://example.com";
        const routeName = "slow";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/slow").withTimeout(0.05);
        });

        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Request timed out/);
    });

    it("should use custom message", async () => {
        global.fetch = vi.fn(() =>
            new Promise(resolve => {
                setTimeout(() => resolve({ json: () => Promise.resolve({ ok: true }) }), 200);
            })
        ) as any;

        const apiName = "timeoutApi2";
        const apiUrl = "https://example.com";
        const routeName = "slow2";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/slow").withTimeout(0.05, "Too slow");
        });

        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Too slow/);
    });
});
