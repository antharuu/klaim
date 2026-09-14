import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Run through npm (npm run test:package) after a clean build.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.env.npm_execpath;
assert.ok(npm, "Run this smoke with npm run test:package");
const sandbox = mkdtempSync(join(tmpdir(), "klaim-package-"));
const results = [];
const env = { ...process.env, NODE_PATH: "", NODE_OPTIONS: "", npm_config_ignore_scripts: "true" };
const npmrc = join(sandbox, "empty.npmrc");
writeFileSync(npmrc, "");

function run(args, cwd) {
    const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8" });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout, output: `${result.stdout}${result.stderr}` };
}

function npmRun(args, cwd) {
    const result = run([npm, ...args, "--ignore-scripts", "--userconfig", npmrc, "--no-audit", "--no-fund"], cwd);
    assert.equal(result.status, 0, result.output);
    return result.stdout;
}

function check(name, result, expectedError) {
    const passed = expectedError
        ? result.status !== 0 && result.output.includes(expectedError)
        : result.status === 0;
    results.push({ name, passed, ...result });
    console.log(`${passed ? "PASS" : "FAIL"} ${name}\n${result.output}`);
}

const names = [
    "Api", "Cache", "Group", "Hook", "InvalidPathError", "Klaim", "KlaimError",
    "MissingArgumentError", "RateLimitError", "Registry", "RetryExhaustedError", "Route", "TimeoutError"
];
const assertions = `
import assert from "node:assert/strict";
assert.deepEqual(Object.keys(klaim).sort(), ${JSON.stringify([...names].sort())});
for (const name of ${JSON.stringify(names.filter(name => name !== "Klaim"))}) {
    assert.equal(typeof klaim[name], "function", name);
}
assert.equal(typeof klaim.Klaim, "object");
klaim.Cache.i.set("package-smoke", 42);
assert.equal(klaim.Cache.i.get("package-smoke"), 42);
klaim.Cache.i.clear();
`;
const types = `import { ${names.join(", ")} } from "klaim";
import type {
    IArgs, IBody, ICallbackAfterArgs, ICallbackBeforeArgs, ICallbackCallArgs,
    IElement, IHeaders, IPaginationConfig, IRateLimitConfig, ITimeoutConfig
} from "klaim";
export const values = { ${names.join(", ")} };
export type PublicTypes = [IArgs, IBody, ICallbackAfterArgs, ICallbackBeforeArgs,
    ICallbackCallArgs, IElement, IHeaders, IPaginationConfig, IRateLimitConfig, ITimeoutConfig];
export const api: IElement = Api.create("smoke", "https://example.invalid", () => {
    Route.get("list", "/items");
});
export const headers: IHeaders = { Accept: "application/json" };
`;

try {
    // Pack the installed compiler too: consumers use a local, identical tsc without network resolution.
    const [packed] = JSON.parse(npmRun(["pack", "--json", "--pack-destination", sandbox], root));
    const [compiler] = JSON.parse(npmRun(["pack", "--json", "--pack-destination", sandbox], join(root, "node_modules/typescript")));
    console.log(`Node ${process.version}; sandbox ${sandbox}; package ${packed.filename}`);
    for (const mode of ["module", "commonjs"]) {
        const consumer = join(sandbox, mode);
        mkdirSync(consumer);
        writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: mode }));
        npmRun(["install", "--package-lock=false", join(sandbox, packed.filename), join(sandbox, compiler.filename)], consumer);
        writeFileSync(join(consumer, "index.ts"), types);
        const tsconfig = {
            compilerOptions: { strict: true, noEmit: true, module: "Node16", moduleResolution: "Node16", types: [] },
            files: ["index.ts"]
        };
        writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify(tsconfig));
        const tsc = join(consumer, "node_modules/typescript/bin/tsc");
        // Always execute types independently, even when the runtime entry is broken.
        check(`types ${mode} Node16`, run([tsc, "-p", "tsconfig.json"], consumer));
        const runtime = mode === "module"
            ? `import * as klaim from "klaim";\n${assertions}`
            : `const klaim = require("klaim");\n${assertions.replace('import assert from "node:assert/strict";', 'const assert = require("node:assert/strict");')}`;
        const entry = mode === "module" ? "smoke.mjs" : "smoke.cjs";
        writeFileSync(join(consumer, entry), runtime);
        check(`runtime ${mode}`, run([entry], consumer));
        if (mode === "module") {
            check("types bundler", run([tsc, "-p", "tsconfig.json", "--module", "ESNext", "--moduleResolution", "Bundler"], consumer));
        } else {
            check("runtime legacy main", run(["--input-type=commonjs", "-e",
                `const klaim = require("./node_modules/klaim");\n${assertions.replace('import assert from "node:assert/strict";', 'const assert = require("node:assert/strict");')}`
            ], consumer));
            const manifestPath = join(consumer, "node_modules/klaim/package.json");
            const original = readFileSync(manifestPath, "utf8");
            const manifest = JSON.parse(original);
            manifest.exports["."].require.types = "./dist/index.d.ts";
            try {
                writeFileSync(manifestPath, JSON.stringify(manifest));
                check("negative legacy CJS types", run([tsc, "-p", "tsconfig.json"], consumer), "TS1479");
            } finally {
                writeFileSync(manifestPath, original);
            }
            check("types commonjs restored", run([tsc, "-p", "tsconfig.json"], consumer));
        }
    }
    assert.ok(results.every(result => result.passed), "Package smoke failed");
} finally {
    rmSync(sandbox, { recursive: true, force: true });
}
