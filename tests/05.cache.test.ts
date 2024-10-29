import { describe, expect, it } from "vitest";
import { Api, Klaim, Route } from "../src/index";

const apiName = "testApi";
const apiUrl = "https://lorem-json.com/api/";

const routeName = "testRoute";
const routeUrl = "/json";
const routeBody = {
	"name": "{{name()}}",
};

await describe("Cache", async () => {
	it("should not cache the API response", async () => {
		Api.create(apiName, apiUrl, () => {
			Route.post(routeName, routeUrl);
		});

		const { name: nameA } = await Klaim[apiName][routeName]({}, routeBody);
		const { name: nameB } = await Klaim[apiName][routeName]({}, routeBody);

		expect(nameA).not.toEqual(nameB);
	});

	it("should keep the API response in cache", async () => {
		Api.create(apiName, apiUrl, () => {
			Route.post(routeName, routeUrl);
		}).withCache();

		const { name: nameA } = await Klaim[apiName][routeName]({}, routeBody);
		const { name: nameB } = await Klaim[apiName][routeName]({}, routeBody);

		expect(nameA).toEqual(nameB);
	});

	it("should keep the route response in cache", async () => {
		Api.create(apiName, apiUrl, () => {
			Route.post(routeName, routeUrl).withCache();
		});

		const { name: nameA } = await Klaim[apiName][routeName]({}, routeBody);
		const { name: nameB } = await Klaim[apiName][routeName]({}, routeBody);

		expect(nameA).toEqual(nameB);
	});
});
