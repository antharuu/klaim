import {describe, it, expect, vi, beforeEach} from "vitest";
import {Api, Klaim, Route} from "../src";

beforeEach(() => {
    vi.clearAllMocks();
    // Mock fetch to always reject
    global.fetch = vi.fn(() => Promise.reject(new Error("fail"))) as any;
});

describe("Error Handling", () => {
    it("should call route onError handler", async () => {
        const handler = vi.fn();
        Api.create("errApi", "https://example.com", () => {
            Route.get("fail", "/fail").onError(handler);
        });
        await expect(Klaim.errApi.fail()).rejects.toThrow();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should call global handler when none on route", async () => {
        const handler = vi.fn();
        Klaim.onError(handler);
        Api.create("errApi2", "https://example.com", () => {
            Route.get("fail", "/fail");
        });
        await expect(Klaim.errApi2.fail()).rejects.toThrow();
        expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should call api handler when none on route", async () => {
        const handler = vi.fn();
        Api.create("errApi3", "https://example.com", () => {
            Route.get("fail", "/fail");
        }).onError(handler);
        await expect(Klaim.errApi3.fail()).rejects.toThrow();
        expect(handler).toHaveBeenCalledTimes(1);
    });
});
