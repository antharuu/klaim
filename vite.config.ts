import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import dts from "vite-plugin-dts";
import * as path from "path";
import { writeFile } from "node:fs/promises";

export default defineConfig({
    plugins: [
        dts({
            insertTypesEntry: true,
            rollupTypes: true,
            async afterBuild(emittedFiles) {
                const entry = [...emittedFiles].find(([file]) => path.basename(file) === "index.d.ts");
                if (!entry) throw new Error("Missing rolled-up index.d.ts declaration");
                // The rolled-up declaration is self-contained; .d.cts gives it CommonJS identity.
                await writeFile(entry[0].replace(/\.d\.ts$/, ".d.cts"), entry[1]);
            },
        }),
    ],
    build: {
        lib: {
            entry: path.resolve(__dirname, "src/index.ts"),
            name: "klaim",
            fileName: (format) => {
                if (format === "cjs") return `klaim.${format}`;
                return `klaim.${format}.js`;
            },
            formats: ["es", "cjs", "umd"],
        },
        rollupOptions: {
            external: [],
            output: {
                globals: {},
            },
        },
    },
    test: {
        globals: true,
        environment: "jsdom",
        exclude: [
            ...configDefaults.exclude,
            "tests/e2e/**",
        ],
        coverage: {
            provider: "v8",
            exclude: [
                "**/*.cjs",
                "index.ts",
                "mod.ts",
                "src/core/Registry.ts",
            ],
        },
    },
});
