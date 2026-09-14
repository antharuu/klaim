import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Api, Klaim, Route, ValidationError, zodAdapter } from "../src";

const apiName = "testApiZod";
const apiUrl = "https://jsonplaceholder.typicode.com";

const routeName = "testRouteZod";
const routeUrl = "todos/[id]";

const schema = z.object({
    userId: z.number(),
    id: z.number().min(1).max(10),
    title: z.string(),
    completed: z.boolean()
});

global.fetch = vi.fn((url: string | URL | Request) => {
    const urlStr = url.toString();
    if (urlStr.includes("/todos/15")) {
        return Promise.resolve({ json: () => Promise.resolve({ userId: 1, id: 15, title: "any title", completed: false }) });
    }
    return Promise.resolve({ json: () => Promise.resolve({ userId: 1, id: 1, title: "delectus aut autem", completed: false }) });
}) as unknown as typeof global.fetch;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Validate Zod", () => {
    it("should not fail when the response matches the schema", async () => {
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl).validate(zodAdapter(schema));
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        expect(await Klaim[apiName][routeName]({ id: 1 })).toStrictEqual({
            userId: 1,
            id: 1,
            title: "delectus aut autem",
            completed: false
        });
    });

    it("should fail with a ValidationError when the response violates the schema", async () => {
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl).validate(zodAdapter(schema));
        });

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await expect(Klaim[apiName][routeName]({ id: 15 })).rejects.toThrow();
    });

    it("should throw a ValidationError carrying the zod issues as cause", async () => {
        const adapter = zodAdapter(schema);

        await expect(adapter.validate({ userId: 1, id: 15, title: "x", completed: false }))
            .rejects.toSatisfy((error: unknown) => {
                expect(error).toBeInstanceOf(ValidationError);
                expect((error as ValidationError).name).toBe("ValidationError");
                expect((error as ValidationError).cause).toBeDefined();
                return true;
            });
    });

    it("should resolve with the parsed data on success", async () => {
        const adapter = zodAdapter(schema);
        const data = { userId: 1, id: 5, title: "hello", completed: true };

        await expect(adapter.validate(data)).resolves.toStrictEqual(data);
    });
});
