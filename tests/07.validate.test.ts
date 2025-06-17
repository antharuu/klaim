import {describe, expect, it} from "vitest";
import {Api, Klaim, Route} from "../src";
import * as yup from "yup";

const apiName = "testApi";
const apiUrl = "https://jsonplaceholder.typicode.com";

const routeName = "testRoute";
const routeUrl = "todos/[id]";

const schema = yup.object().shape({
    userId: yup.number().required(),
    id: yup.number().min(1).max(10).required(),
    title: yup.string().required(),
    completed: yup.boolean().required()
});

describe("Validate Yup", async () => {
    it("should not fail", async () => {
        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, routeUrl);
        });

        // Expect the validation to not fail the promise
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        expect(await Klaim[apiName][routeName]({id: 1})).toStrictEqual({
            userId: 1,
            id: 1,
            title: "delectus aut autem",
            completed: false
        });
    });

    it("should fail", async () => {
        Api.create(apiName, apiUrl, () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            Route.get(routeName, routeUrl).validate(schema);
        });

        // Expect the validation to fail the promise
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        await expect(Klaim[apiName][routeName]({id: 15})).rejects.toThrow();
    });

    it("should reformat if possible", async () => {
        Api.create(apiName, apiUrl, () => {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            Route.get(routeName, routeUrl).validate(yup.object().shape({
                    userId: yup.number().required(),
                    id: yup.string().required(),
                    title: yup.string().required(),
                    completed: yup.boolean().required()
                })
            );
        });

        // Expect the id to be a string
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        expect(await Klaim[apiName][routeName]({id: "1"})).toStrictEqual({
            userId: 1,
            id: "1",
            title: "delectus aut autem",
            completed: false
        });
    });
});
