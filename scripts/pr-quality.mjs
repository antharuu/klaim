import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCoverage, checkPack } from "./pr-quality-checks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const report = resolve(process.env.PR_QUALITY_REPORT_DIR || "");
assert.ok(process.env.PR_QUALITY_REPORT_DIR && !relative(root, report).split(sep).every(part => part !== ".."), "Reports must be outside checkout");
mkdirSync(report, { recursive: true });
const npm = process.env.npm_execpath;
assert.ok(npm && isAbsolute(npm) && /\.(?:c?js)$/.test(npm), "npm_execpath must be an absolute npm CLI JS path");
const env = {};
// Project processes never inherit agent/Actions tokens or user npm configuration.
for (const name of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "SYSTEMDRIVE", "NUMBER_OF_PROCESSORS", "PROCESSOR_ARCHITECTURE"]) {
    if (process.env[name]) env[name] = process.env[name];
}
const home = join(report, "private-home");
mkdirSync(home, { recursive: true });
for (const file of ["user.npmrc", "global.npmrc"]) writeFileSync(join(home, file), "");
Object.assign(env, {
    HOME: home, USERPROFILE: home, APPDATA: join(home, "appdata"), LOCALAPPDATA: join(home, "localappdata"),
    CI: "true", NODE_PATH: "", NODE_OPTIONS: "", npm_execpath: npm,
    npm_config_userconfig: join(home, "user.npmrc"), npm_config_globalconfig: join(home, "global.npmrc"),
    npm_config_cache: join(home, "npm-cache"), npm_config_ignore_scripts: "true", npm_config_engine_strict: "true",
    npm_config_audit: "false", npm_config_fund: "false", npm_config_registry: "https://registry.npmjs.org/"
});
const results = [];
const hash = file => createHash("sha256").update(readFileSync(file)).digest("hex");
function save(name, data) { writeFileSync(join(report, name), JSON.stringify(data, null, 2) + "\n"); }
function run(label, args, cwd = root) {
    const result = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8", timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
    writeFileSync(join(report, `${label}.stdout.log`), result.stdout || "");
    writeFileSync(join(report, `${label}.stderr.log`), result.stderr || "");
    results.push({ label, args, exit: result.status, error: result.error?.message });
    save("results.json", results);
    console.log(`${label}: exit ${result.status}`);
    if (result.error) throw result.error;
    assert.equal(result.status, 0, `${label} failed; see command logs`);
    return result.stdout;
}
function inputs(dir = root, prefix = "") {
    const found = {};
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if ([".git", "node_modules", "dist", "coverage", ".cache"].includes(entry.name)) continue;
        const path = join(dir, entry.name);
        const name = prefix + entry.name;
        assert.ok(!/^\.env(?:\.|$)/i.test(entry.name) && entry.name !== ".npmrc", `Forbidden input: ${name}`);
        assert.ok(!lstatSync(path).isSymbolicLink(), `Symlink input rejected: ${name}`);
        if (entry.isDirectory()) Object.assign(found, inputs(path, name + "/"));
        else found[name] = hash(path);
    }
    return found;
}

try {
    assert.equal(process.version, `v${process.env.PR_QUALITY_NODE}`);
    assert.ok(["24.21.0", "22.13.0"].includes(process.env.PR_QUALITY_NODE));
    assert.equal(process.env.PR_QUALITY_NPM, "11.19.0");
    assert.equal(run("npm-version", [npm, "--version"]).trim(), "11.19.0");
    assert.ok(!existsSync(join(root, "node_modules")), "C1 requires a fresh checkout without node_modules");
    assert.ok(!existsSync(join(root, "dist")) && !existsSync(join(root, "coverage")), "Build/coverage must be fresh");
    const before = inputs();
    save("input-sha256.json", before);
    save("versions.json", { node: process.version, npm: "11.19.0", platform: process.platform, arch: process.arch,
        sha: process.env.GITHUB_SHA || null, imageOS: process.env.ImageOS || null, imageVersion: process.env.ImageVersion || null,
        coverageThresholds: "proposed; Windows validated only until authorized Linux calibration" });
    run("C1-install", [npm, "ci", "--ignore-scripts", "--no-audit", "--no-fund"]);
    assert.deepEqual(inputs(), before, "C1 modified checkout inputs");
    run("C2-lint", [npm, "run", "lint"]);
    run("C3-test", [npm, "test", "--", "--run"]);
    run("C4-types", [join(root, "node_modules/typescript/bin/tsc"), "--noEmit", "-p", "tsconfig.json"]);
    run("C5-build", [npm, "run", "build"]);
    run("C6-coverage", [npm, "run", "test:cover", "--", "--run"]);
    for (const name of ["coverage-summary.json", "lcov.info", "index.html"]) {
        assert.ok(existsSync(join(root, "coverage", name)), `Missing coverage report ${name}`);
    }
    const summary = JSON.parse(readFileSync(join(root, "coverage/coverage-summary.json"), "utf8"));
    const evaluation = checkCoverage(summary);
    save("coverage-evaluation.json", evaluation);
    console.log(`Coverage informative (Linux calibration pending): ${JSON.stringify(evaluation)}`);
    const packed = run("C7-pack-dry", [npm, "pack", "--ignore-scripts", "--dry-run", "--json"]);
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const [inventory] = JSON.parse(packed);
    checkPack(inventory, manifest);
    save("pack-inventory.json", inventory);
    const [actual] = JSON.parse(run("C7-pack", [npm, "pack", "--ignore-scripts", "--json", "--pack-destination", report]));
    checkPack(actual, manifest);
    assert.deepEqual(actual.files, inventory.files, "Pack dry-run differs from real pack");
    save("tarball-sha256.json", { filename: actual.filename, sha256: hash(join(report, actual.filename)) });
    // R1 fixtures are deliberately preserved, including independent CJS types and negative TS1479.
    run("C8-C10-consumers", [npm, "run", "test:package"]);
    assert.deepEqual(inputs(), before, "Quality commands modified checkout inputs");
    save("success.json", { node: process.version, npm: "11.19.0", sha: process.env.GITHUB_SHA || null, result: "success" });
} catch (error) {
    save("failure.json", { message: error.message });
    console.error(error.message);
    process.exitCode = 1;
}
