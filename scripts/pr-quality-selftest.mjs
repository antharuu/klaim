import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCoverage, checkPack, thresholds } from "./pr-quality-checks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sandbox = mkdtempSync(join(tmpdir(), "klaim-pr-negative-"));
const npm = process.env.npm_execpath;
assert.ok(npm && /\.(?:c?js)$/.test(npm), "npm CLI required");
const env = {};
for (const key of ["PATH", "Path", "SystemRoot", "SYSTEMROOT", "WINDIR", "ComSpec", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR"]) {
    if (process.env[key]) env[key] = process.env[key];
}
writeFileSync(join(sandbox, "user.npmrc"), "");
writeFileSync(join(sandbox, "global.npmrc"), "");
Object.assign(env, { HOME: sandbox, USERPROFILE: sandbox, CI: "true", NODE_PATH: "", NODE_OPTIONS: "",
    npm_config_userconfig: join(sandbox, "user.npmrc"), npm_config_globalconfig: join(sandbox, "global.npmrc"),
    npm_config_cache: join(sandbox, "cache"), npm_config_engine_strict: "true", npm_config_ignore_scripts: "true",
    npm_config_audit: "false", npm_config_fund: "false" });
const results = [];
function run(label, args, cwd, diagnostic) {
    const p = spawnSync(process.execPath, args, { cwd, env, encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    if (p.error) throw p.error;
    const output = (p.stdout || "") + (p.stderr || "");
    const passed = diagnostic ? p.status !== 0 && output.includes(diagnostic) : p.status === 0;
    results.push({ label, exit: p.status, passed, output });
    assert.ok(passed, `${label}: ${output}`);
    return p.stdout;
}
function check(label, fn) { fn(); results.push({ label, passed: true }); }
try {
    const good = { total: Object.fromEntries(Object.keys(thresholds).map(key => [key, { covered: 10000, total: 10000 }])) };
    check("coverage positive", () => {
        const result = checkCoverage(good);
        assert.equal(result.enforced, false);
        assert.deepEqual(result.belowProposed, []);
        assert.deepEqual(result.proposed, thresholds);
    });
    for (const [metric, threshold] of Object.entries(thresholds)) {
        const exact = structuredClone(good);
        exact.total[metric].covered = Math.round(threshold * 100);
        check(`coverage ${metric} exact boundary`, () => assert.deepEqual(checkCoverage(exact).belowProposed, []));
        exact.total[metric].covered--;
        check(`coverage ${metric} regression reported without failure`, () => {
            const result = checkCoverage(exact);
            assert.equal(result.enforced, false);
            assert.deepEqual(result.belowProposed, [metric]);
            assert.equal(result.measured[metric], exact.total[metric].covered / 100);
        });
        exact.total[metric].covered = 0;
        check(`coverage ${metric} zero informative`, () => assert.deepEqual(checkCoverage(exact).belowProposed, [metric]));
        exact.total[metric].covered = -1;
        check(`coverage ${metric} invalid rejected`, () => assert.throws(() => checkCoverage(exact), /Invalid/));
    }
    check("missing coverage rejected", () => assert.throws(() => checkCoverage({}), /Missing/));
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const [pack] = JSON.parse(run("pack fresh", [npm, "pack", "--ignore-scripts", "--json", "--pack-destination", sandbox], root));
    check("real pack accepted", () => checkPack(pack, manifest));
    for (const name of [".env.production", "nested/.npmrc", "coverage/index.html", ".cache/report.json", "secret.pem", "../escape", "pr-quality-reports/success.json"]) {
        check(`pack rejects ${name}`, () => assert.throws(() => checkPack({ files: [...pack.files, { path: name }] }, manifest)));
    }
    const consumer = join(sandbox, "commonjs");
    mkdirSync(consumer);
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "commonjs" }));
    run("install fresh local tarball", [npm, "install", "--ignore-scripts", "--package-lock=false", join(sandbox, pack.filename)], consumer);
    writeFileSync(join(consumer, "index.ts"), 'import { Klaim } from "klaim"; export const api: unknown = Klaim;\n');
    writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: "Node16", moduleResolution: "Node16", target: "ES2022", types: [] }, files: ["index.ts"] }));
    const tsc = join(root, "node_modules/typescript/bin/tsc");
    const typeArgs = [tsc, "-p", "tsconfig.json"];
    const runtimeArgs = ["--input-type=commonjs", "-e", 'require("klaim")'];
    run("CJS types positive", typeArgs, consumer);
    run("CJS runtime positive", runtimeArgs, consumer);
    const installed = join(consumer, "node_modules/klaim/package.json");
    const original = readFileSync(installed, "utf8");
    const mutated = JSON.parse(original);
    mutated.exports["."].require.default = "./dist/does-not-exist.cjs";
    writeFileSync(installed, JSON.stringify(mutated));
    run("CJS runtime negative", runtimeArgs, consumer, "MODULE_NOT_FOUND");
    run("CJS types independent of runtime failure", typeArgs, consumer);
    mutated.exports["."].require.default = manifest.exports["."].require.default;
    mutated.exports["."].require.types = "./dist/index.d.ts";
    writeFileSync(installed, JSON.stringify(mutated));
    run("CJS types negative", typeArgs, consumer, "TS1479");
    run("CJS runtime independent of type failure", runtimeArgs, consumer);
    writeFileSync(installed, original);
    run("CJS types restored", typeArgs, consumer);
    writeFileSync(join(consumer, "index.ts"), 'export const broken: number = "not a number";\n');
    run("TS negative", typeArgs, consumer, "TS2322");

    // Exercise the actual required job shell, not a parallel JS approximation of its policy.
    const workflow = readFileSync(join(root, ".github/workflows/pr-quality.yml"), "utf8");
    const required = workflow.split("\n  required:\n")[1];
    assert.ok(required?.includes("if: ${{ always() }}"));
    const script = required.split("        run: |\n")[1].split("\n").map(line => line.slice(10)).join("\n");
    const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
    for (const [label, node24, node22, expected] of [
        ["success", "success", "success", 0],
        ["failure", "failure", "success", 1],
        ["skipped", "skipped", "success", 1],
        ["cancelled", "cancelled", "success", 1],
        ["missing leg", "success", "", 1]
    ]) {
        const p = spawnSync(bash, ["--noprofile", "--norc", "-c", script], {
            env: { ...env, NODE24_RESULT: node24, NODE22_RESULT: node22 }, encoding: "utf8"
        });
        if (p.error) throw p.error;
        assert.equal(p.status, expected, `${label}: ${p.stderr}`);
        results.push({ label: `required ${label}`, exit: p.status, passed: true });
    }
} finally {
    if (process.env.PR_QUALITY_REPORT_DIR) writeFileSync(join(process.env.PR_QUALITY_REPORT_DIR, "negative-controls.json"), JSON.stringify(results, null, 2));
    rmSync(sandbox, { recursive: true, force: true });
}
console.log(`${results.length} contract controls passed`);
