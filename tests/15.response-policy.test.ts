import {afterEach, beforeEach, describe, expect, expectTypeOf, it} from "vitest";
import {Api, Group, Registry, Route} from "../src";
import type {IElement, ResponsePolicy} from "../src";

beforeEach(() => Registry.i.reset());
afterEach(() => Registry.i.reset());

describe("ResponsePolicy configuration", () => {
    it("copies to direct APIs and groups without recursing or touching siblings", () => {
        let api!: ReturnType<typeof Api.create>;
        let nested!: ReturnType<typeof Group.create>;
        let apiRoute!: ReturnType<typeof Route.get>;
        let nestedApi!: ReturnType<typeof Api.create>;
        const sibling = Api.create("sibling", "https://example.com", () => {});
        const group = Group.create("shared", () => {
            api = Api.create("api", "https://example.com", () => {
                apiRoute = Route.get("list", "/items");
            });
            nested = Group.create("nested", () => {
                nestedApi = Api.create("deep", "https://example.com", () => {});
            });
        });
        group.withResponsePolicy("legacy");
        expect(api.responsePolicy).toBe("legacy");
        expect(nested.responsePolicy).toBe("legacy");
        expect(apiRoute.responsePolicy).toBeUndefined();
        expect(nestedApi.responsePolicy).toBeUndefined();
        expect(sibling.responsePolicy).toBeUndefined();
        expect(api.withResponsePolicy("http")).toBe(api);
        expect(api.responsePolicy).toBe("http");
        expect(apiRoute.responsePolicy).toBeUndefined();
    });

    it("does not configure future children until the group setter is called again", () => {
        const group = Group.create("shared", () => {}).withResponsePolicy("http");
        Registry.i.setCurrentParent(Registry.i.getFullPath(group));
        const late = Api.create("late", "https://example.com", () => {});
        Registry.i.clearCurrentParent();
        expect(late.responsePolicy).toBeUndefined();
        group.withResponsePolicy("legacy");
        expect(late.responsePolicy).toBe("legacy");
    });

    it("accepts structural children without the optional fluent method", () => {
        const group = Group.create("shared", () => {});
        const route = new Route("structural", "/items");
        const child: IElement = {
            type: route.type, name: route.name, url: route.url, headers: route.headers,
            callbacks: route.callbacks, cache: route.cache, retry: route.retry,
            rate: route.rate, timeout: route.timeout, arguments: route.arguments,
            before: route.before, after: route.after, onCall: route.onCall,
            withCache: route.withCache, withRetry: route.withRetry,
            withPagination: route.withPagination, withRate: route.withRate,
            withTimeout: route.withTimeout
        };
        Registry.i.setCurrentParent(Registry.i.getFullPath(group));
        Registry.i.registerElement(child);
        Registry.i.clearCurrentParent();
        group.withResponsePolicy("http");
        expect(child.responsePolicy).toBe("http");
        expect(child.withResponsePolicy).toBeUndefined();
    });

    it("copies group policy only to unconfigured existing direct children", () => {
        const children: IElement[] = [];
        let group!: ReturnType<typeof Group.create>;
        Api.create("api", "https://example.com", () => {
            group = Group.create("shared", () => {
                children.push(Route.get("unset", "/unset"));
                children.push(Route.get("legacy", "/legacy").withResponsePolicy("legacy"));
                children.push(Route.get("http", "/http").withResponsePolicy("http"));
            });
        });
        expect(group.responsePolicy).toBeUndefined();
        expect(group.withResponsePolicy("http")).toBe(group);
        expect(group.responsePolicy).toBe("http");
        expect(children.map(child => child.responsePolicy)).toEqual(["http", "legacy", "http"]);
        group.withResponsePolicy("legacy");
        expect(group.responsePolicy).toBe("legacy");
        expect(children.map(child => child.responsePolicy)).toEqual(["http", "legacy", "http"]);
    });

    it("keeps policy unset by default and configures routes fluently", () => {
        const route = new Route("list", "/items");
        expect(route.responsePolicy).toBeUndefined();
        expect(route.withResponsePolicy("http")).toBe(route);
        expect(route.responsePolicy).toBe("http");
        expect(route.withResponsePolicy("legacy")).toBe(route);
        expect(route.responsePolicy).toBe("legacy");
        expectTypeOf(route.withResponsePolicy("http")).toEqualTypeOf<Route>();
        expectTypeOf<ResponsePolicy>().toEqualTypeOf<"legacy" | "http">();
        expectTypeOf<IElement["responsePolicy"]>().toEqualTypeOf<ResponsePolicy | undefined>();
        expectTypeOf<Pick<IElement, "responsePolicy" | "withResponsePolicy">>().toMatchTypeOf<{
            responsePolicy?: ResponsePolicy;
            withResponsePolicy?: (policy: ResponsePolicy) => IElement;
        }>();
        const compatible: Pick<IElement, "responsePolicy" | "withResponsePolicy"> = {};
        expect(compatible.withResponsePolicy).toBeUndefined();
    });
});
