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
            "simple-import-sort/exports": "error",
            "simple-import-sort/imports": [
                "error",
                {
                    "groups": [
                        ["^\u0000"],
                        ["^@?\\w"],
                        ["^/"],
                        ["/stores/"],
                        ["/utils/"],
                        ["/routes/"],
                        ["/types/"],
                        ["/pages-parts/"],
                        ["/layouts/"],
                        ["/components/"],
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
        }
    }
);

