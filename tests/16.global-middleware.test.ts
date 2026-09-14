import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Klaim, Registry, resetGlobalMiddlewares, Route} from "../src";

const apiName = "globalMiddlewareApi";
const apiUrl = "https://jsonplaceholder.typicode.com";

const routeName = "globalMiddlewareRoute";
const routeUrl = "/todos/1";

const res = {
    userId: 1,
    id: 1,
    title: "delectus aut autem",
    completed: false
};

global.fetch = vi.fn(() =>
    Promise.resolve({json: () => Promise.resolve(res)})
) as unknown as typeof global.fetch;

beforeEach(() => {
    vi.clearAllMocks();
    Registry.i.reset();
    resetGlobalMiddlewares();
});

afterEach(() => {
    Registry.i.reset();
    resetGlobalMiddlewares();
});

describe("Global middleware", () => {
    it("exposes before/after registration functions on the Klaim object", () => {
        expect(Klaim.before).toBeInstanceOf(Function);
        expect(Klaim.after).toBeInstanceOf(Function);
    });

    it("runs a global before middleware for every route call", async () => {
        let calls = 0;

        Klaim.before(() => {
            calls++;
        });

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(calls).toEqual(1);
    });

    it("runs a global after middleware for every route call", async () => {
        let calls = 0;

        Klaim.after(() => {
            calls++;
        });

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(calls).toEqual(1);
    });

    it("stacks multiple global before middlewares in registration order", async () => {
        const order: string[] = [];

        Klaim.before(() => {
            order.push("global-1");
        });
        Klaim.before(() => {
            order.push("global-2");
        });

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl).before(() => {
                order.push("route");
            });
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(order).toEqual(["global-1", "global-2", "route"]);
    });

    it("stacks multiple global after middlewares in registration order, after the route after hook", async () => {
        const order: string[] = [];

        Klaim.after(() => {
            order.push("global-1");
        });
        Klaim.after(() => {
            order.push("global-2");
        });

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl).after(() => {
                order.push("route");
            });
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(order).toEqual(["route", "global-1", "global-2"]);
    });

    it("respects the full documented order: global before -> route before -> network -> route after -> global after", async () => {
        const order: string[] = [];

        Klaim.before(() => {
            order.push("global-before");
        });
        Klaim.after(() => {
            order.push("global-after");
        });

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl)
                .before(() => {
                    order.push("route-before");
                })
                .after(() => {
                    order.push("route-after");
                });
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(order).toEqual([
            "global-before",
            "route-before",
            "route-after",
            "global-after"
        ]);
    });

    it("allows a global before middleware to mutate the url used by the request", async () => {
        Klaim.before(({url}) => ({url: `${url}?traced=1`}));

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("traced=1"),
            expect.anything()
        );
    });

    it("allows a global after middleware to mutate the resolved data", async () => {
        Klaim.after(() => ({data: {overridden: true}}));

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await expect(Klaim[apiName][routeName]()).resolves.toEqual({overridden: true});
    });

    it("no longer runs global middlewares after resetGlobalMiddlewares() is called", async () => {
        let calls = 0;

        Klaim.before(() => {
            calls++;
        });

        resetGlobalMiddlewares();

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiName][routeName]();

        expect(calls).toEqual(0);
    });

    it("applies global middlewares to every registered API, not just one", async () => {
        const calls: string[] = [];
        Klaim.before(() => {
            calls.push("before");
        });

        const apiNameA = `${apiName}A`;
        const apiNameB = `${apiName}B`;

        Api.create(apiNameA, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });
        Api.create(apiNameB, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiNameA][routeName]();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await Klaim[apiNameB][routeName]();

        expect(calls).toEqual(["before", "before"]);
    });
});
