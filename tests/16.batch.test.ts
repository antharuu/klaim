import { describe, expect, it, vi } from "vitest";
import { Api, batch, Klaim, Route } from "../src";

const apiName = "batchApi";
const apiUrl = "https://jsonplaceholder.typicode.com";

const todo = { id: 1, title: "todo", completed: false };
const user = { id: 1, name: "user" };

Api.create(apiName, apiUrl, () => {
    Route.get("listTodos", "/todos");
    Route.get("getUser", "/users/[id]");
    Route.get("failing", "/fail");
});

global.fetch = vi.fn((url: string | URL | Request) => {
    const href = url.toString();
    if (href.includes("/fail")) {
        return Promise.reject(new Error("network down"));
    }
    if (href.includes("/users/")) {
        return Promise.resolve({ json: () => Promise.resolve(user) });
    }
    return Promise.resolve({ json: () => Promise.resolve(todo) });
}) as unknown as typeof global.fetch;

describe("batch", () => {
    it("should resolve all entries when every call succeeds (object form)", async () => {
        const result = await batch({
            todos: () => Klaim[apiName].listTodos(),
            user: () => Klaim[apiName].getUser({ id: 1 })
        });

        expect(result.todos).toEqual({ status: "fulfilled", value: todo });
        expect(result.user).toEqual({ status: "fulfilled", value: user });
    });

    it("should resolve all entries when every call succeeds (array form)", async () => {
        const [todosResult, userResult] = await batch([
            () => Klaim[apiName].listTodos(),
            () => Klaim[apiName].getUser({ id: 1 })
        ]);

        expect(todosResult).toEqual({ status: "fulfilled", value: todo });
        expect(userResult).toEqual({ status: "fulfilled", value: user });
    });

    it("should isolate a partial failure without rejecting the whole batch (object form)", async () => {
        const result = await batch({
            todos: () => Klaim[apiName].listTodos(),
            broken: () => Klaim[apiName].failing()
        });

        expect(result.todos).toEqual({ status: "fulfilled", value: todo });
        expect(result.broken.status).toBe("rejected");
        if (result.broken.status === "rejected") {
            expect(result.broken.reason).toBeInstanceOf(Error);
        }
    });

    it("should isolate a partial failure without rejecting the whole batch (array form)", async () => {
        const [todosResult, brokenResult] = await batch([
            () => Klaim[apiName].listTodos(),
            () => Klaim[apiName].failing()
        ]);

        expect(todosResult).toEqual({ status: "fulfilled", value: todo });
        expect(brokenResult.status).toBe("rejected");
    });

    it("should report every entry as rejected on total failure", async () => {
        const result = await batch({
            a: () => Klaim[apiName].failing(),
            b: () => Klaim[apiName].failing()
        });

        expect(result.a.status).toBe("rejected");
        expect(result.b.status).toBe("rejected");
    });

    it("should support an empty batch", async () => {
        expect(await batch({})).toEqual({});
        expect(await batch([])).toEqual([]);
    });

    it("should accept already-started promises, not only thunks", async () => {
        const result = await batch({
            todos: Klaim[apiName].listTodos()
        });

        expect(result.todos).toEqual({ status: "fulfilled", value: todo });
    });
});
