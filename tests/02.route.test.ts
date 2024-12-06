import { describe, expect, it } from "vitest";
import { Api, Klaim, Registry, Route } from "../src";

const apiName = "testApi";
const apiUrl = "https://jsonplaceholder.typicode.com";

describe("Route", async () => {
    it("should create an route instance with correct properties", () => {
        const name = "testRoute";
        const routePath = "/posts";

        Api.create(apiName, apiUrl, () => {
            Route.get(name, routePath);
        });

        expect(Registry.i.getRoute(apiName, name)).toBeDefined();
    });

    it("should format the path correctly", () => {
        const name = "testRoute";
        const routePath = "/posts/";
        const waitingPath = "posts";

        Api.create(apiName, apiUrl, () => {
            Route.get(name, routePath);
        });

        expect(Registry.i.getRoute(apiName, name).url).toBe(waitingPath);
    });

    it("should format the name to camelCase", () => {
        const name = "test-route";
        const waitingName = "testRoute";

        Api.create(apiName, apiUrl, () => {
            Route.get(name, "/posts");
        });

        expect(Registry.i.getRoute(apiName, waitingName)).toBeDefined();
    });

    it("should access the route instance from Klaim", () => {
        const name = "testRoute";

        Api.create(apiName, apiUrl, () => {
            Route.get(name, "/posts");
        });

        expect(Klaim[apiName][name]).toBeDefined();
    });

    it("should set the headers correctly", () => {
        const name = "testRoute";
        const routePath = "/posts";
        const headers = {
            "Authorization": "Bearer token 123",
        };

        Api.create(apiName, apiUrl, () => {
            Route.get(name, routePath, headers);
        });

        expect(Registry.i.getRoute(apiName, name).headers).toEqual(headers);
    });

    describe("Methods", () => {
        it("should create a GET route instance with correct properties", () => {
            const name = "testRoute";
            const routePath = "/posts";

            Api.create(apiName, apiUrl, () => {
                Route.get(name, routePath);
            });

            expect(Registry.i.getRoute(apiName, name)).toBeDefined();
        });

        it("should create a POST route instance with correct properties", () => {
            const name = "testRoute";
            const routePath = "/posts";

            Api.create(apiName, apiUrl, () => {
                Route.post(name, routePath);
            });

            expect(Registry.i.getRoute(apiName, name)).toBeDefined();
        });

        it("should create a PUT route instance with correct properties", () => {
            const name = "testRoute";
            const routePath = "/posts";

            Api.create(apiName, apiUrl, () => {
                Route.put(name, routePath);
            });

            expect(Registry.i.getRoute(apiName, name)).toBeDefined();
        });

        it("should create a DELETE route instance with correct properties", () => {
            const name = "testRoute";
            const routePath = "/posts";

            Api.create(apiName, apiUrl, () => {
                Route.delete(name, routePath);
            });

            expect(Registry.i.getRoute(apiName, name)).toBeDefined();
        });

        it("should create a PATCH route instance with correct properties", () => {
            const name = "testRoute";
            const routePath = "/posts";

            Api.create(apiName, apiUrl, () => {
                Route.patch(name, routePath);
            });

            expect(Registry.i.getRoute(apiName, name)).toBeDefined();
        });

        it("should create a OPTIONS route instance with correct properties", () => {
            const name = "testRoute";
            const routePath = "/posts";

            Api.create(apiName, apiUrl, () => {
                Route.options(name, routePath);
            });

            expect(Registry.i.getRoute(apiName, name)).toBeDefined();
        });
    });

    describe("Arguments", () => {
        it("should set the arguments correctly", () => {
            const name = "testRoute";
            const routePath = "/post/[id]";
            const args = new Set(["id"]);

            Api.create(apiName, apiUrl, () => {
                Route.get(name, routePath, {});
            });

            expect(Registry.i.getRoute(apiName, name).arguments).toEqual(args);
        });

        it("should set the arguments correctly with multiple arguments", () => {
            const name = "testRoute";
            const routePath = "/post/[id]/[name]";
            const args = new Set(["id", "name"]);

            Api.create(apiName, apiUrl, () => {
                Route.get(name, routePath, {});
            });

            expect(Registry.i.getRoute(apiName, name).arguments).toEqual(args);
        });
    });

    await describe("Middlewares", async () => {
        it("should set the before middleware correctly", () => {
            const name = "testRoute";
            const routePath = "/posts";
            const before = () => {};

            Api.create(apiName, apiUrl, () => {
                Route.get(name, routePath, {}).before(before);
            });

            expect(Registry.i.getRoute(apiName, name).callbacks.before)
                .toEqual(before);
        });
        it("should set the after middleware correctly", () => {
            const name = "testRoute";
            const routePath = "/posts";
            const after = () => {};

            Api.create(apiName, apiUrl, () => {
                Route.get(name, routePath, {}).after(after);
            });

            expect(Registry.i.getRoute(apiName, name).callbacks.after)
                .toEqual(after);
        });
    });
});
