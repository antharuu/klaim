# Package smoke

Run `npm run build && npm run test:package` after installing the locked development dependencies. No package is published.

`test:package` packs the current build with lifecycle scripts disabled, creates two temporary consumers outside the checkout (`type:module` and `type:commonjs`), and installs the new tarball by file path. Both consumers import `klaim` by package name. The smoke checks all public runtime exports and a cache round trip.

Each consumer also installs a tarball of the checkout's installed TypeScript compiler (no version lookup or upgrade). It compiles imports of all public values and types using its own `tsc`, `strict`, `noEmit`, `module:Node16`, and `moduleResolution:Node16`. No `skipLibCheck`, suppression, source alias, or checkout type fallback is used. An ESM/bundler check runs separately.

Runtime and type checks run independently and all failures are reported before the command fails. The CommonJS negative control temporarily restores the old ESM `require.types` target in the installed consumer and requires TS1479, then restores the manifest and recompiles successfully. Temporary consumers and archives are removed on exit.

The smoke uses the Node executable running it, and npm's `npm_execpath`. For a second installed Node version, invoke that executable on `scripts/smoke-package.mjs` with `npm_execpath` pointing to the npm CLI JavaScript entry. Build with that Node version first. This does not certify unsupported platforms or replace the repository typecheck, lint, and unit tests.

The build emits `index.d.cts` after declaration rollup, beside the self-contained `index.d.ts`. Keep this generation in the Vite plugin hook so direct builds and watch rebuilds use the same contract. Any future declaration imports must remain compatible with both module identities; the strict consumer checks guard this boundary.
