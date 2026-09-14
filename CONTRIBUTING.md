# Contributing to Klaim

Thank you for your interest in contributing to Klaim! We welcome contributions from everyone. By participating in this project, you agree to abide by our Code of Conduct.

## Contributor Tooling

Use **npm 11.19.0** and the committed **package-lock.json (lockfileVersion 3)**
for contributor and CI installations. The reference tooling environment is
Node **24.21.0** on Windows. Node **22.13.0** with npm **11.19.0** is a second
target pending validation of the integrated changes; Linux and macOS are not
certified by this baseline. These tooling versions do not redefine the library's
public runtime support for Node, Bun, or Deno/JSR.

In a clean, disposable checkout without publication credentials or `.env` files,
use an empty temporary npm user configuration and set `CI=true`,
`npm_config_ignore_scripts=true`, `npm_config_engine_strict=true`,
`npm_config_audit=false`, and `npm_config_fund=false`. Then run:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test -- --run
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
npm run build
npm run test:cover -- --run
```

Point `npm_config_userconfig` at that empty temporary file before running these
commands. Check `node --version` and `npm --version` first; `packageManager`
records the convention but does not install or enforce the npm version.
Installation must leave `package.json` and `package-lock.json` byte-identical.
Do not regenerate the lock to conceal an installation failure. Dependency
updates require a separate, reviewed change; do not use `npm audit fix --force`.
Although automatic lifecycle scripts are disabled, explicit lint/test/build
commands still execute project and dependency code. Never run release scripts
as part of this verification.

`yarn.lock`, `bun.lock`, and `bun.lockb` are removed from version control and
ignored to avoid competing contributor dependency graphs. Previously,
`bun.lockb` was both tracked and ignored; its removal resolves that divergence.
`deno.lock` is retained unchanged. Removing Bun installation locks does not
remove Bun runtime support or change Deno/JSR publication policy.

The normalization alone is not a fully green baseline: project typechecking
currently reports TS5107, and CommonJS runtime/type consumer checks have known
packaging failures handled separately. Record these failures rather than
suppressing them. A successful build does not prove that the packed library is
consumable; independent ESM/CommonJS runtime and strict Node16 type checks of
the locally built tarball are required before integration.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an issue describing the problem, steps to reproduce it, and any relevant information such as your environment and version.

### Suggesting Enhancements

If you have an idea for a new feature or improvement, please open an issue to discuss it before submitting a pull request. This helps us coordinate efforts and ensure the feature aligns with the project's goals.

### Pull Requests

1. Fork the repository and create your branch from `main`.
2. If you've added code, make sure it is covered by tests.
3. Ensure the test suite passes.
4. Submit your pull request, linking to the issue it addresses.

## Code Style

Please adhere to the coding standards used in the project. This includes following the existing style and using TypeScript for type definitions.

## Commit Messages

Write clear and concise commit messages. Follow the convention:
