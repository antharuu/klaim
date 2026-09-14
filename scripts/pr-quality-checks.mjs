import assert from "node:assert/strict";

// Informative only until authorized Linux calibration and review; no enforcement switch.
export const thresholds = Object.freeze({ statements: 88.57, branches: 84.93, functions: 85.71, lines: 88.34 });

export function checkCoverage(summary) {
    const measured = {};
    const belowProposed = [];
    for (const [name, minimum] of Object.entries(thresholds)) {
        const metric = summary.total?.[name];
        assert.ok(metric && Number.isInteger(metric.total) && metric.total > 0, `Missing coverage: ${name}`);
        assert.ok(Number.isInteger(metric.covered) && metric.covered >= 0 && metric.covered <= metric.total, `Invalid coverage: ${name}`);
        // Istanbul truncates to two decimal places; compare integer hundredths, not a rounded float.
        const hundredths = Math.floor(metric.covered * 10000 / metric.total);
        measured[name] = hundredths / 100;
        if (hundredths < Math.round(minimum * 100)) belowProposed.push(name);
    }
    return { policy: "informative-pending-linux-calibration", enforced: false, measured, proposed: thresholds, belowProposed };
}

export function checkPack(pack, manifest) {
    assert.ok(Array.isArray(pack.files) && pack.files.length > 0, "Empty pack inventory");
    const paths = new Set();
    for (const file of pack.files) {
        const path = file.path;
        assert.equal(typeof path, "string");
        assert.ok(!path.startsWith("/") && !path.includes("\\") && !path.includes(":"), `Unsafe pack path: ${path}`);
        const parts = path.toLowerCase().split("/");
        assert.ok(!parts.some(part => !part || part === ".." || part === "."), `Unsafe pack path: ${path}`);
        assert.ok(!parts.some(part => /^(\.env(?:\..*)?|\.npmrc|\.ssh|\.aws|\.git|\.cache|\.verify|coverage|pr-quality-reports|credentials(?:\..*)?|id_rsa|id_ed25519)$/.test(part)), `Forbidden pack entry: ${path}`);
        assert.ok(!/\.(?:pem|key|p12|pfx|tgz|lcov|log)$/i.test(path), `Forbidden pack entry: ${path}`);
        assert.ok(!paths.has(path), `Duplicate pack entry: ${path}`);
        paths.add(path);
    }
    function target(value) {
        if (typeof value === "string") {
            const path = value.replace(/^\.\//, "");
            assert.ok(paths.has(path), `Missing declared target: ${value}`);
        } else if (value && typeof value === "object") {
            for (const child of Object.values(value)) target(child);
        } else {
            assert.equal(value, null, "Unsupported export target");
        }
    }
    for (const key of ["main", "module", "types", "exports"]) {
        assert.ok(manifest[key], `Missing ${key}`);
        target(manifest[key]);
    }
    return paths.size;
}
