import {beforeEach, describe, expect, it, vi} from "vitest";
import {Api, Klaim, Route} from "../src";

// Mock fetch pour simuler les réponses API sans faire de vraies requêtes
global.fetch = vi.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({success: true}),
    })
) as unknown as typeof global.fetch;

// Réinitialiser les mocks entre chaque test
beforeEach(() => {
    vi.clearAllMocks();
});

describe("Rate Limiting", () => {
    it("should allow requests within the rate limit", async () => {
        const apiName = "testRateApi";
        const apiUrl = "https://example.com";
        const routeName = "testRateRoute";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withRate({limit: 3, duration: 10});
        });

        // Devrait permettre 3 requêtes successives sans problème
        await Klaim[apiName][routeName]();
        await Klaim[apiName][routeName]();
        await Klaim[apiName][routeName]();

        // Vérifier que fetch a été appelé 3 fois
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("should block requests that exceed the rate limit", async () => {
        const apiName = "testRateApi2";
        const apiUrl = "https://example.com";
        const routeName = "testRateRoute2";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName, "/test").withRate({limit: 2, duration: 10});
        });

        // Les deux premières requêtes devraient réussir
        await Klaim[apiName][routeName]();
        await Klaim[apiName][routeName]();

        // La troisième requête devrait être bloquée
        await expect(Klaim[apiName][routeName]()).rejects.toThrow(/Rate limit exceeded/);

        // Vérifier que fetch n'a été appelé que 2 fois
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should apply rate limits at the API level", async () => {
        const apiName = "testRateApi3";
        const apiUrl = "https://example.com";
        const routeName1 = "testRateRoute3A";
        const routeName2 = "testRateRoute3B";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName1, "/test1");
            Route.get(routeName2, "/test2");
        }).withRate({limit: 3, duration: 10});

        // Différentes routes mais même API - devrait compter pour la même limite
        await Klaim[apiName][routeName1]();
        await Klaim[apiName][routeName1]();
        await Klaim[apiName][routeName2]();

        // La quatrième requête devrait être bloquée
        await expect(Klaim[apiName][routeName1]()).rejects.toThrow(/Rate limit exceeded/);

        // Vérifier que fetch n'a été appelé que 3 fois
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it("should respect route-specific rate limits over API-level limits", async () => {
        const apiName = "testRateApi4";
        const apiUrl = "https://example.com";
        const routeName1 = "testRateRoute4A";
        const routeName2 = "testRateRoute4B";

        Api.create(apiName, apiUrl, () => {
            Route.get(routeName1, "/test1").withRate({limit: 1, duration: 10}); // Limite plus stricte
            Route.get(routeName2, "/test2"); // Utilise la limite de l'API
        }).withRate({limit: 5, duration: 10});

        // La première route a une limite de 1
        await Klaim[apiName][routeName1]();
        await expect(Klaim[apiName][routeName1]()).rejects.toThrow(/Rate limit exceeded/);

        // La deuxième route utilise la limite de l'API (5)
        await Klaim[apiName][routeName2]();
        await Klaim[apiName][routeName2]();
        await Klaim[apiName][routeName2]();
        await Klaim[apiName][routeName2]();
        await Klaim[apiName][routeName2]();
        await expect(Klaim[apiName][routeName2]()).rejects.toThrow(/Rate limit exceeded/);

        // Vérifier que fetch a été appelé 6 fois (1 + 5)
        expect(fetch).toHaveBeenCalledTimes(6);
    });
}); 