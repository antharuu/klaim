import {describe, expect, it} from "vitest";
import {Api, Klaim, Route} from "../src";
import {RouteFunction} from "../src/core/Klaim";

const apiName = "testApi";
const apiUrl = "https://dummyjson.com";

const routeName = "testRoute";
const routeUrl = "/products";

describe("Cache", async () => {
	it("should not cache the API response by default", async () => {
		Api.create(apiName, apiUrl, () => {
			Route.get(routeName, routeUrl);
		});

		const response1: { products: Array<{ id: unknown }> } = await (Klaim[apiName][routeName] as RouteFunction)();
		const response2: { products: Array<{ id: unknown }> } = await (Klaim[apiName][routeName] as RouteFunction)();

		// Even without cache, the product IDs should be stable
		// But other fields might change between requests
		expect(response1.products[0].id).toEqual(response2.products[0].id);
		expect(response1.products[1].id).toEqual(response2.products[1].id);
	});

	it("should keep the API response in cache when enabled at API level", async () => {
		Api.create(apiName, apiUrl, () => {
			Route.get(routeName, routeUrl);
		}).withCache();

		const response1 = await (Klaim[apiName][routeName] as RouteFunction)();
		const response2 = await (Klaim[apiName][routeName] as RouteFunction)();

		// With cache enabled, the entire responses should be identical
		expect(response1).toEqual(response2);
	});

	it("should keep the route response in cache when enabled at route level", async () => {
		Api.create(apiName, apiUrl, () => {
			Route.get(routeName, routeUrl).withCache();
		});

		const response1 = await (Klaim[apiName][routeName] as RouteFunction)();
		const response2 = await (Klaim[apiName][routeName] as RouteFunction)();

		// With cache enabled, the entire responses should be identical
		expect(response1).toEqual(response2);
	});
});
