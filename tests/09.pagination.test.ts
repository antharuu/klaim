import {Api, Route, Klaim} from "../src";
import {describe, it, expect} from "vitest";

const limit = 3;

type Pokemon = {
	name: string;
}

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
