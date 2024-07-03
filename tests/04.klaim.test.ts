import { describe, expect, it } from "vitest";
import { Api, Klaim, Registry, Route } from "../src/index.ts";

const apiName = "testApi";
const apiUrl = "https://jsonplaceholder.typicode.com";

const routeName = "testRoute";
const routeUrl = "/todos/1";
const routeUrlWithArg = "/todos/[id]";
const res = {
    userId: 1,
    id: 1,
    title: "delectus aut autem",
    completed: false,
};

const res2 = {
    userId: 1,
    id: 2,
    title: "quis ut nam facilis et officia qui",
    completed: false,
};

await describe("Route", async () => {
    it("should call the API", async () => {
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        expect(Klaim[apiName]).toBeDefined();
        expect(Klaim[apiName][routeName]).toBeDefined();
        expect(Klaim[apiName][routeName]).toBeInstanceOf(Function);
        expect(Klaim[apiName][routeName]()).toBeInstanceOf(Promise);
        expect(Klaim[apiName][routeName]()).resolves.toEqual(res);
    });

    it("should have a body if post but not if get", async () => {
        const apiNameA = `${apiName}A`;
        const routeNameA = `${routeName}A`;

        const apiNameB = `${apiName}B`;
        const routeNameB = `${routeName}B`;

        Api.create(apiNameA, apiUrl, () => {
            Route.get(routeNameA, routeUrl);
        });

        Api.create(apiNameB, apiUrl, () => {
            Route.post(routeNameB, routeUrl);
        });

        expect(Klaim[apiNameA][routeNameA]()).resolves.toEqual(res);
        expect(Klaim[apiNameB][routeNameB]()).resolves.toEqual({});
    });

    it("should can have arguments", async () => {
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrlWithArg);
        });

        expect(Klaim[apiName][routeName]({ id: 1 })).resolves.toEqual(res);
        expect(Klaim[apiName][routeName]({ id: 2 })).resolves.toEqual(res2);
        // if pass no argument, it should fail
        expect(Klaim[apiName][routeName]()).rejects.toThrow();
    });

    it("should call the before and after hooks", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl)
                .before(() => {
                    a = 1;
                });
        });

        expect(a).toEqual(0);
        Klaim[apiName][routeName]();
        expect(a).toEqual(1);
    });

    it("should call the after hook", async () => {
        let a = 0;
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl)
                .after(() => {
                    a = 1;
                });
        });

        expect(a).toEqual(0);
        Klaim[apiName][routeName]();
        expect(a).toEqual(0);
        await Klaim[apiName][routeName]();
        expect(a).toEqual(1);
    });
});
