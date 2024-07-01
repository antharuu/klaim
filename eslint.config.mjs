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

            // ----------------------------------------
            // ---------------------- Stylistic
            // ----------------------------------------
            "@stylistic/array-bracket-spacing": ["error", "always"],
            "@stylistic/function-paren-newline": ["error", "multiline"],
            "@stylistic/multiline-ternary": ["error", "always-multiline"],
            "@stylistic/quotes": [
                "error",
                "double",
                {
                    "avoidEscape": true, "allowTemplateLiterals": true
                }
            ],
            "@stylistic/semi": [
                "error",
                "always",
                {
                    "omitLastInOneLineBlock": true, "omitLastInOneLineClassBody": true
                }
            ],
            "@stylistic/space-before-function-paren": ["error", "always"],
            "@stylistic/space-in-parens": ["error", "never"],
            "@stylistic/space-infix-ops": ["error", {"int32Hint": false}],
            "@stylistic/space-before-blocks": ["error", "always"],
            "@stylistic/space-unary-ops": ["error", {"words": true, "nonwords": false}],
            "@stylistic/keyword-spacing": ["error", {"before": true, "after": true}],
            "@stylistic/block-spacing": ["error", "always"],
            "@stylistic/comma-dangle": ["error", "never"],
            "@stylistic/array-bracket-newline": ["error", {"multiline": true}],
            "@stylistic/array-element-newline": ["error", {"multiline": true, "minItems": 3}],
            "@stylistic/object-curly-newline": ["error", {"multiline": true, "consistent": true}],
            "@stylistic/max-len": [
                "error",
                {
                    "code": 120,
                    "tabWidth": 4,
                    "ignoreComments": true,
                    "ignoreUrls": true,
                    "ignoreStrings": true,
                    "ignoreTemplateLiterals": true,
                    "ignoreRegExpLiterals": true,
                    "ignorePattern": "d=.*"
                }
            ],
            "@stylistic/padded-blocks": ["error", "never"],
            "@stylistic/no-multiple-empty-lines": ["error", {"max": 1, "maxEOF": 0}],
            "@stylistic/eol-last": ["error", "always"],
            "@stylistic/lines-between-class-members": ["error", "always"],
            "@stylistic/brace-style": [
                "error",
                "1tbs",
                {"allowSingleLine": true}
            ],
            "@stylistic/object-curly-spacing": ["error", "always"],
            "@stylistic/arrow-spacing": ["error", {"before": true, "after": true}],
            "@stylistic/implicit-arrow-linebreak": ["error", "beside"],
            "@stylistic/arrow-parens": ["error", "as-needed"],
            "@stylistic/no-trailing-spaces": ["error"],
            "@stylistic/no-tabs": ["error"],
            "@stylistic/no-whitespace-before-property": ["error"],
            "@stylistic/template-curly-spacing": ["error", "never"],
            "@stylistic/rest-spread-spacing": ["error", "never"],
            "@stylistic/operator-linebreak": ["error", "before"],
            "@stylistic/type-annotation-spacing": [
                "error",
                {
                    "before": false, "after": true, "overrides": {
                        "arrow": {
                            "before": true, "after": true
                        }
                    }
                }
            ],
            "@stylistic/type-generic-spacing": ["error"],
            "@stylistic/type-named-tuple-spacing": ["error"],

            // ----------------------------------------
            // ---------------------- General
            // ----------------------------------------

            "no-void": "off",
            "no-undef": "off",
            "indent": ["error", 4],
            "no-console": [
                "error",
                {
                    allow: [
                        "warn",
                        "error",
                        "info",
                        "table"
                    ]
                }
            ],
            "camelcase": [
                "error",
                {
                    "properties": "never", "ignoreDestructuring": true, "allow": ["^_[a-z]+_[a-z]+$"]
                }
            ],
            "dot-notation": "off",
            "no-underscore-dangle": "off",
            "func-style": ["error", "declaration"]

        }
    }
);

