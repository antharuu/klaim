import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Cache, Group, Klaim, Registry, Route} from "../src";
import {callApi} from "../src/core/Klaim";

const apiName = "testApi";
const apiUrl = "https://dummyjson.com";

beforeEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    vi.useFakeTimers();
    vi.setSystemTime(0);
    let sequence = 0;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({id: ++sequence}))));
});

afterEach(() => {
    Registry.i.reset();
    Cache.i.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("Group", async () => {
    it("should create a group instance with correct properties", () => {
        const groupName = "products";
        const routeName = "getAll";
        const routePath = "/products";

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Route.get(routeName, routePath);
            });
        });

        expect(Klaim[apiName][groupName]).toBeDefined();
        expect(Klaim[apiName][groupName][routeName]).toBeDefined();
    });

    it("should format group name to camelCase", () => {
        const groupName = "user-products";
        const expectedName = "userProducts";
        const routeName = "getAll";

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Route.get(routeName, "/products");
            });
        });

        expect(Klaim[apiName][expectedName]).toBeDefined();
    });

    it("should nest groups correctly", () => {
        const groupName = "users";
        const subGroupName = "products";
        const routeName = "getAll";

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Group.create(subGroupName, () => {
                    Route.get(routeName, "/users/1/products");
                });
            });
        });

        expect(Klaim[apiName][groupName][subGroupName]).toBeDefined();
        expect(Klaim[apiName][groupName][subGroupName][routeName]).toBeDefined();
    });

    it("should handle multiple routes in a group", async () => {
        const groupName = "users";

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Route.get("list", "/users");
                Route.get("getOne", "/users/[id]");
                Route.post("create", "/users/add", {});
            });
        });

        expect(Klaim[apiName][groupName].list).toBeDefined();
        expect(Klaim[apiName][groupName].getOne).toBeDefined();
        expect(Klaim[apiName][groupName].create).toBeDefined();
    });

    it("should handle multiple apis in a group", async () => {
        const apiName2 = "anotherApi";
        const apiUrl2 = "https://jsonplaceholder.typicode.com";
        const groupName = "posts";

        // Create the first API with a group and routes
        Group.create(groupName, () => {
            Api.create(apiName, apiUrl, () => {
                Route.get("getAll", "/products");
            });
        });

        // Create a second API with a group and routes
        Group.create(groupName, () => {
            Api.create(apiName2, apiUrl2, () => {
                Route.get("list", "/posts");
                Route.get("getOne", "/posts/[id]");
            });
        });

        // Validate that the route definitions are independent for each API
        expect(Klaim[groupName][apiName].getAll).toBeDefined();
        expect(Klaim[groupName][apiName2].list).toBeDefined();
        expect(Klaim[groupName][apiName2].getOne).toBeDefined();
    });

    it("should handle multiple apis and routes in a group", async () => {
        const apiName2 = "anotherApi";
        const apiUrl2 = "https://jsonplaceholder.typicode.com";
        const groupApiName = "posts";
        const groupRoutesName = "test";

        // Create the first API with a group and routes
        Group.create(groupApiName, () => {
            Api.create(apiName, apiUrl, () => {
                Route.get("getAll", "/products");
            });
        });

        // Create a second API with a group and routes
        Group.create(groupApiName, () => {
            Api.create(apiName2, apiUrl2, () => {
                Group.create(groupRoutesName, () => {
                    Route.get("list", "/posts");
                    Route.get("getOne", "/posts/[id]");
                });
            });
        });

        // Validate that the route definitions are independent for each API
        expect(Klaim[groupApiName][apiName].getAll).toBeDefined();
        expect(Klaim[groupApiName][apiName2][groupRoutesName].list).toBeDefined();
        expect(Klaim[groupApiName][apiName2][groupRoutesName].getOne).toBeDefined();
    });


    it("should handle groups with multiple subgroups correctly", () => {
        const parentGroup = "vehicles";
        const subGroup1 = "cars";
        const subGroup2 = "bikes";
        const routeName1 = "getAll";
        const routeName2 = "getOne";

        Api.create(apiName, apiUrl, () => {
            Group.create(parentGroup, () => {
                Group.create(subGroup1, () => {
                    Route.get(routeName1, "/vehicles/cars");
                    Route.get(routeName2, "/vehicles/cars/[id]");
                });

                Group.create(subGroup2, () => {
                    Route.get(routeName1, "/vehicles/bikes");
                    Route.get(routeName2, "/vehicles/bikes/[id]");
                });
            });
        });

        expect(Klaim[apiName][parentGroup][subGroup1][routeName1]).toBeDefined();
        expect(Klaim[apiName][parentGroup][subGroup1][routeName2]).toBeDefined();
        expect(Klaim[apiName][parentGroup][subGroup2][routeName1]).toBeDefined();
        expect(Klaim[apiName][parentGroup][subGroup2][routeName2]).toBeDefined();
    });

    it("should inherit cache settings from group", async () => {
        const groupName = "cachedProducts";
        let route!: ReturnType<typeof Route.get>;

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                route = Route.get("list", "/products");
                Route.get("getOne", "/products/[id]");
            }).withCache(30); // 30 seconds cache
        });

        const call = () => callApi(`${apiName}.${groupName}`, route);
        const firstCall = await call();
        vi.setSystemTime(30_000);
        const secondCall = await call();
        expect(firstCall).toEqual({id: 1});
        expect(firstCall).toEqual(secondCall);
        expect(fetch).toHaveBeenCalledTimes(1);
        vi.setSystemTime(30_001);
        expect(await call()).toEqual({id: 2});
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should handle route-specific cache overrides in groups", async () => {
        const groupName = "mixedCacheProducts";
        let explicit!: ReturnType<typeof Route.get>;
        let inherited!: ReturnType<typeof Route.get>;
        const api = Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                explicit = Route.get("list", "/products").withCache(60);
                inherited = Route.get("getOne", "/products");
            }).withCache(30);
        }).withCache(1);
        const parent = `${apiName}.${groupName}`;
        expect([api.cache, explicit.cache, inherited.cache]).toEqual([1, 60, 30]);
        expect(await callApi(parent, explicit)).toEqual({id: 1});
        expect(await callApi(parent, inherited)).toEqual({id: 2});
        vi.setSystemTime(30_000);
        expect(await callApi(parent, explicit)).toEqual({id: 1});
        expect(await callApi(parent, inherited)).toEqual({id: 2});
        expect(fetch).toHaveBeenCalledTimes(2);
        vi.setSystemTime(30_001);
        expect(await callApi(parent, inherited)).toEqual({id: 3});
        vi.setSystemTime(60_000);
        expect(await callApi(parent, explicit)).toEqual({id: 1});
        vi.setSystemTime(60_001);
        expect(await callApi(parent, explicit)).toEqual({id: 4});
        expect(fetch).toHaveBeenCalledTimes(4);
        expect([api.cache, explicit.cache, inherited.cache]).toEqual([1, 60, 30]);
    });

    it("keeps direct-only cache propagation to APIs without configuring their routes", () => {
        let api!: ReturnType<typeof Api.create>;
        let route!: ReturnType<typeof Route.get>;
        let nested!: ReturnType<typeof Group.create>;
        let deep!: ReturnType<typeof Api.create>;
        const group = Group.create("shared", () => {
            api = Api.create("api", apiUrl, () => { route = Route.get("list", "/products"); });
            nested = Group.create("nested", () => {
                deep = Api.create("deep", apiUrl, () => {});
            });
        }).withCache(30);
        expect([group.cache, api.cache, route.cache, nested.cache, deep.cache]).toEqual([30, 30, false, 30, false]);
    });

    it("isolates identical route names and requests across captured parent paths", async () => {
        let one!: ReturnType<typeof Route.get>;
        let two!: ReturnType<typeof Route.get>;
        Api.create(apiName, apiUrl, () => {
            Group.create("one", () => { one = Route.get("list", "/products").withCache(1); });
            Group.create("two", () => { two = Route.get("list", "/products").withCache(1); });
        });
        expect(await callApi(`${apiName}.one`, one)).toEqual({id: 1});
        expect(await callApi(`${apiName}.two`, two)).toEqual({id: 2});
        expect(await callApi(`${apiName}.one`, one)).toEqual({id: 1});
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should properly handle group-level middleware", async () => {
        const groupName = "products";
        let middlewareCalled = false;

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Route.get("list", "/products");
            }).before(() => {
                middlewareCalled = true;
            });
        });

        await Klaim[apiName][groupName].list();
        expect(middlewareCalled).toBe(true);
    });

    it("should maintain correct API hierarchy with nested groups", () => {
        const mainGroup = "shop";
        const subGroup1 = "products";
        const subGroup2 = "categories";

        Api.create(apiName, apiUrl, () => {
            Group.create(mainGroup, () => {
                Group.create(subGroup1, () => {
                    Route.get("list", "/products");
                });
                Group.create(subGroup2, () => {
                    Route.get("list", "/categories");
                });
            });
        });

        expect(Klaim[apiName][mainGroup][subGroup1].list).toBeDefined();
        expect(Klaim[apiName][mainGroup][subGroup2].list).toBeDefined();
    });
});
