// @ts-check
import stylistic from "@stylistic/eslint-plugin";
import simpleImportSort from "eslint-plugin-simple-import-sort";

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            "@stylistic": stylistic,
            "simple-import-sort": simpleImportSort
        },
        files: ["src/**/*.ts"],
        rules: {
            // ----------------------------------------
            // ---------------------- Simple Import Sort
            // ----------------------------------------
            "simple-import-sort/exports": "error",
            "simple-import-sort/imports": [
                "error",
                {
                    "groups": [
                        ["^\u0000"],
                        ["^@?\\w"],
                        ["^/"],
                        ["^\\.\\.(?!/?$)", "^\\.\\./?$"],
                        [
                            "^\\./(?=.*/)(?!/?$)",
                            "^\\.(?!/?$)",
                            "^\\./?$"
                        ],
                        ["^.+\\.s?css$"]
                    ]
                }
            ],
            // ----------------------------------------
            // ---------------------- TypeScript
            // ----------------------------------------
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/ban-ts-comment": "off",
            "@typescript-eslint/no-dynamic-delete": "off",
            "@typescript-eslint/no-namespace": "off",
            "@typescript-eslint/ban-types": "error",
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/consistent-indexed-object-style": "error",
        }
    }
);

