import {describe, expect, it} from "vitest";
import {Api, Group, Klaim, Route} from "../src";

const apiName = "testApi";
const apiUrl = "https://dummyjson.com";

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

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Route.get("list", "/products");
                Route.get("getOne", "/products/[id]");
            }).withCache(30); // 30 seconds cache
        });

        const firstCall = await Klaim[apiName][groupName].list();
        const secondCall = await Klaim[apiName][groupName].list();
        expect(firstCall).toEqual(secondCall);
    });

    it("should handle route-specific cache overrides in groups", async () => {
        const groupName = "mixedCacheProducts";

        Api.create(apiName, apiUrl, () => {
            Group.create(groupName, () => {
                Route.get("list", "/products").withCache(60);
                Route.get("getOne", "/products/[id]");
            }).withCache(30);
        });

        const route = Klaim[apiName][groupName].list;
        expect(route).toBeDefined();
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
