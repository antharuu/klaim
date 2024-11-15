// @ts-check
import stylistic from "@stylistic/eslint-plugin";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import JSdoc from "eslint-plugin-jsdoc";


import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            "@stylistic": stylistic,
            "simple-import-sort": simpleImportSort,
            "jsdoc": JSdoc
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
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/consistent-indexed-object-style": "error",
            "@typescript-eslint/no-unused-expressions": "error",

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
            // ---------------------- JSdoc
            // ----------------------------------------
            "jsdoc/check-access": "error",
            "jsdoc/check-alignment": "error",
            "jsdoc/check-param-names": "error",
            "jsdoc/check-property-names": "error",
            "jsdoc/check-tag-names": "error",
            "jsdoc/check-types": "error",
            "jsdoc/check-values": "error",
            "jsdoc/empty-tags": "error",
            "jsdoc/implements-on-classes": "error",
            "jsdoc/multiline-blocks": "error",
            "jsdoc/no-defaults": "error",
            "jsdoc/no-multi-asterisks": "error",
            "jsdoc/require-jsdoc": [
                "error",
                {
                    "require": {
                        "FunctionDeclaration": true,
                        "MethodDefinition": true,
                        "ClassDeclaration": true,
                        "ArrowFunctionExpression": true,
                        "FunctionExpression": true
                    }
                }
            ],
            "jsdoc/require-param": "error",
            "jsdoc/require-param-description": "error",
            "jsdoc/require-param-name": "error",
            "jsdoc/require-property": "error",
            "jsdoc/require-property-description": "error",
            "jsdoc/require-property-name": "error",
            "jsdoc/require-returns": "error",
            "jsdoc/require-returns-check": "error",
            "jsdoc/require-returns-description": "error",
            "jsdoc/require-yields": "error",
            "jsdoc/require-yields-check": "error",
            "jsdoc/tag-lines": [
                "error",
                "never",
                {
                    "applyToEndTag": false,
                    "count": 1,
                    "startLines": 1,
                    "endLines": 0
                }
            ],
            "jsdoc/valid-types": "error",

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
            "func-style": ["error", "declaration"],
            "no-unused-expressions": "off",
        }
    }
);

