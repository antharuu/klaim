import {describe, expect, it} from "vitest";
import {Hook} from "../src";

describe("Route", async () => {
	it("should subscribe to a hook", () => {
		let a = 1;

		Hook.subscribe("testHook", () => {
			a++;
		});

		Hook.run("testHook");
		expect(a).toBe(2);

		Hook.run("testHook");
		expect(a).toBe(3);
	});

	it("should not run a hook if it is not subscribed", () => {
		const a = 1;

		Hook.run("testHook");
		expect(a).toBe(1);
	});

	it("should not subscribe to a hook if no callback is provided", () => {
		const a = 1;
		Hook.subscribe("testHook", undefined);

		Hook.run("testHook");

		expect(a).toBe(1);
	});
});
