import {beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Klaim, Route} from "../src";

const apiName = "testApi";
const apiUrl = "https://myfakeapi.jardin-des-slimes.com";

const routeName = "testRoute";
const routeUrl = "/fake/1";

global.fetch = vi.fn(() =>
    Promise.reject(new Error("Network error"))
) as unknown as typeof global.fetch;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Retry", async () => {
    it("should just fail", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.post(routeName, routeUrl)
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                .onCall(() => a++);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(a).toEqual(1);
    });

    it("should retry api", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.post(routeName, routeUrl)
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                .onCall(() => a++);
        })
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            .onCall(() => a--) // Never call route > api
            .withRetry(3);

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            await Klaim[apiName][routeName]();
        } catch {
            // Dont care
        }
        expect(a).toEqual(4);
    });

    it("should retry route", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.post(routeName, routeUrl)
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                .onCall(() => a++)
                .withRetry(3);
        });

        try {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            await Klaim[apiName][routeName]();
        } catch {
            // Dont care
        }
        expect(a).toEqual(4);
    });
});
