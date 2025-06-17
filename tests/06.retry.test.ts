import {describe, expect, it} from "vitest";
import {Api, Klaim, Route} from "../src";

const apiName = "testApi";
const apiUrl = "https://myfakeapi.jardin-des-slimes.com";

const routeName = "testRoute";
const routeUrl = "/fake/1";

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
		expect(Klaim[apiName][routeName]()).rejects.toThrow();
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
