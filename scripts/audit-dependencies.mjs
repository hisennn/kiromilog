import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const advisoryUrl = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const exceptionExpiresAt = Date.parse("2026-11-06T00:00:00Z");
const acceptedChain = new Map([
  ["braces", advisoryUrl],
  ["micromatch", "braces"],
  ["fast-glob", "micromatch"],
  ["@next/eslint-plugin-next", "fast-glob"],
  ["eslint-config-next", "@next/eslint-plugin-next"],
  ["find-yarn-workspace-root", "micromatch"],
  ["patch-package", "find-yarn-workspace-root"],
]);
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function parseAuditResult(result) {
  if (result.error || result.signal || ![0, 1].includes(result.status)) {
    throw new Error("npm audit did not complete successfully.");
  }
  const report = JSON.parse(result.stdout);
  if (!isRecord(report) || report.error || report.auditReportVersion !== 2 ||
      !isRecord(report.vulnerabilities) || !isRecord(report.metadata?.vulnerabilities)) {
    throw new Error("npm audit returned an incomplete or unsupported report.");
  }
  const findings = Object.values(report.vulnerabilities);
  const counts = report.metadata.vulnerabilities;
  for (const severity of ["info", "low", "moderate", "high", "critical"]) {
    if (!Number.isInteger(counts[severity]) || counts[severity] < 0 ||
        counts[severity] !== findings.filter((finding) => finding?.severity === severity).length) {
      throw new Error("npm audit returned inconsistent severity counts.");
    }
  }
  if (counts.total !== findings.length ||
      ["info", "low", "moderate", "high", "critical"].reduce((sum, key) => sum + counts[key], 0) !== counts.total ||
      result.status !== (findings.length ? 1 : 0)) {
    throw new Error("npm audit returned inconsistent findings or exit status.");
  }
  return report;
}

export function evaluateAudit(report, lock, now = Date.now()) {
  if (!isRecord(lock?.packages) || !Number.isFinite(now)) {
    throw new Error("Cannot validate the lockfile or exception date.");
  }
  const findings = Object.entries(report.vulnerabilities);
  if (!findings.length) return;
  if (now >= exceptionExpiresAt) {
    throw new Error("The temporary braces exception expired after 2026-11-05 UTC; review it before proceeding.");
  }
  for (const [name, finding] of findings) {
    const node = `node_modules/${name}`;
    const expectedVia = acceptedChain.get(name);
    if (!expectedVia || !isRecord(finding) || finding.name !== name || finding.severity !== "high" ||
        !Array.isArray(finding.nodes) || finding.nodes.length !== 1 || finding.nodes[0] !== node ||
        lock.packages[node]?.dev !== true || !Array.isArray(finding.via) || finding.via.length !== 1) {
      throw new Error(`Unaccepted audit finding or production dependency: ${name}`);
    }
    const via = finding.via[0];
    if (name === "braces") {
      if (lock.packages[node].version !== "3.0.3" || !isRecord(via) || via.url !== advisoryUrl ||
          via.name !== "braces" || via.dependency !== "braces" || via.severity !== "high") {
        throw new Error("The braces finding differs from the accepted advisory and version.");
      }
    } else if (via !== expectedVia || !Object.hasOwn(report.vulnerabilities, expectedVia)) {
      throw new Error(`The audit dependency chain changed: ${name}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!process.env.npm_execpath) throw new Error("Run this check with npm run audit:security.");
    const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const report = parseAuditResult(result);
    const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
    evaluateAudit(report, lock);
    if (Object.keys(report.vulnerabilities).length) {
      console.warn("WARNING: temporary dev-only exception for GHSA-vfj7-8cjw-p6xm in braces 3.0.3, valid through 2026-11-05 UTC.");
      console.warn("The vulnerability remains present. Remove this exception when an upstream fix is available; all other findings block CI.");
    }
  } catch (error) {
    console.error(`Dependency audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
