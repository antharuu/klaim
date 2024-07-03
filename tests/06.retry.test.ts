import { describe, expect, it } from "vitest";
import { Api, Klaim, Route } from "../src/index.ts";

const apiName = "testApi";
const apiUrl = "https://myfakeapi.jardin-des-slimes.com";

const routeName = "testRoute";
const routeUrl = "/fake/1";

await describe("Retry", async () => {
    it("should just fail", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.post(routeName, routeUrl)
                .onCall(() => a++);
        });

        expect(Klaim[apiName][routeName]()).rejects.toThrow();
        expect(a).toEqual(1);
    });

    it.only("should retry api", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.post(routeName, routeUrl)
                .onCall(() => a++);
        })
            .onCall(() => a--) // Never call route > api
            .withRetry(3);

        try {
            await Klaim[apiName][routeName]();
        } catch (error) {
            // Dont care
        }
        expect(a).toEqual(4);
    });

    it("should retry route", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.post(routeName, routeUrl)
                .onCall(() => a++)
                .withRetry(3);
        });

        try {
            await Klaim[apiName][routeName]();
        } catch (error) {
            // Dont care
        }
        expect(a).toEqual(4);
    });
});
