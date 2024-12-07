import { describe, expect, it } from "vitest";
import { Api, Klaim, Registry } from "../src";

describe("Api", () => {
    it("should create an API instance with correct properties", () => {
        const name = "testApi";
        const url = "https://dummyjson.com";

        const api = Api.create(name, url, () => {});

        expect(Registry.i.getApi(name)).toBe(api);
    });

    it("should format the URL correctly", () => {
        const name = "testApi";
        const url = "https://dummyjson.com/";
        const waitingUrl = "https://dummyjson.com";

        const api = Api.create(name, url, () => {});

        expect(api.url).toBe(waitingUrl);
    });

    it("should format the name to camelCase", () => {
        const name = "test-api";
        const waitingName = "testApi";

        const api = Api.create(
            name,
            "https://dummyjson.com",
            () => {},
        );

        expect(api.name).toBe(waitingName);
    });

    it("should access the API instance from Klaim", () => {
        const name = "testApi";

        Api.create(name, "https://dummyjson.com", () => {});

        expect(Klaim[name]).toBeDefined();
    });

    it("should set the headers correctly", () => {
        const name = "testApi";
        const headers = {
            "Authorization": "Bearer token 123",
        };

        const api = Api.create(
            name,
            "https://dummyjson.com",
            () => {},
            headers,
        );

        expect(api.headers).toBe(headers);
    });
});
