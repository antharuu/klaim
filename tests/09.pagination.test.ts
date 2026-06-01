import {Api, Klaim, Route} from "../src";
import {beforeEach, describe, expect, it, vi} from "vitest";

const limit = 3;

type Pokemon = {
    name: string;
}

const allPokemon = [
    {name: "bulbasaur"}, {name: "ivysaur"}, {name: "venusaur"},
    {name: "charmander"}, {name: "charmeleon"}, {name: "charizard"},
    {name: "squirtle"}, {name: "wartortle"}, {name: "blastoise"},
];

global.fetch = vi.fn((url: string | URL | Request) => {
    const urlObj = new URL(url.toString());
    const offset = Number(urlObj.searchParams.get("offset") ?? "0");
    const pageLimit = Number(urlObj.searchParams.get("limit") ?? String(limit));
    const results = allPokemon.slice(offset, offset + pageLimit);
    return Promise.resolve({json: () => Promise.resolve({results})});
}) as unknown as typeof global.fetch;

beforeEach(() => {
    vi.clearAllMocks();
});

// Tests
describe("Pagination Feature", () => {
    it("should fetch with success", async () => {
        Api.create("pokemon", "https://pokeapi.co/api/v2", () => {
            Route.get("list", "/pokemon").withPagination({limit, pageParam: "offset"});
        });

        const pokemons = (await Klaim.pokemon.list()) as { results?: Pokemon[] };

        expect(pokemons).toBeDefined();
        expect(pokemons).toHaveProperty("results");
        expect(Array.isArray(pokemons.results)).toBe(true);
        expect(pokemons.results.length).toBe(limit);
    });

    it("should fetch with default page", async () => {
        Api.create("pokemon", "https://pokeapi.co/api/v2", () => {
            Route.get("list", "/pokemon").withPagination({limit, pageParam: "offset"});
        });

        const pokemons = (await Klaim.pokemon.list()) as { results?: Pokemon[] };

        const firstPokemon = pokemons.results?.[0];

        expect(firstPokemon).toBeDefined();
        expect(firstPokemon).toHaveProperty("name");
        expect(firstPokemon.name).toBe("bulbasaur");
    });

    it("should fetch with specified page", async () => {
        Api.create("pokemon", "https://pokeapi.co/api/v2", () => {
            Route.get("list", "/pokemon").withPagination({limit, pageParam: "offset"});
        });

        const pokemons = (await Klaim.pokemon.list(6)) as { results?: Pokemon[] };

        const firstPokemon = pokemons.results?.[0];

        expect(firstPokemon).toBeDefined();
        expect(firstPokemon).toHaveProperty("name");
        expect(firstPokemon.name).toBe("squirtle");
    });
});
