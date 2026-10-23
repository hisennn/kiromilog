import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAudit, parseAuditResult } from "./audit-dependencies.mjs";

const advisoryUrl = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const beforeExpiry = Date.parse("2026-11-05T23:59:59.999Z");

function fixture() {
  const chain = {
    braces: { name: "braces", dependency: "braces", url: advisoryUrl, severity: "high" },
    micromatch: "braces",
    "fast-glob": "micromatch",
    "@next/eslint-plugin-next": "fast-glob",
    "eslint-config-next": "@next/eslint-plugin-next",
    "find-yarn-workspace-root": "micromatch",
    "patch-package": "find-yarn-workspace-root",
  };
  const vulnerabilities = Object.fromEntries(Object.entries(chain).map(([name, via]) => [name, {
    name,
    severity: "high",
    nodes: [`node_modules/${name}`],
    via: [via],
  }]));
  const report = { auditReportVersion: 2, vulnerabilities, metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 7, critical: 0, total: 7 },
  } };
  const lock = { packages: Object.fromEntries(Object.keys(chain).map((name) => [
    `node_modules/${name}`, { dev: true, version: name === "braces" ? "3.0.3" : "1.0.0" },
  ])) };
  return { report, lock };
}

const parse = (report, status = 1) => parseAuditResult({ status, stdout: JSON.stringify(report) });

test("a clean npm audit passes even after the exception expires", () => {
  const report = { auditReportVersion: 2, vulnerabilities: {}, metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 },
  } };
  assert.doesNotThrow(() => evaluateAudit(parse(report, 0), { packages: {} }, Date.parse("2026-11-06")));
});

test("only the seven known development findings pass before expiry", () => {
  const { report, lock } = fixture();
  assert.doesNotThrow(() => evaluateAudit(parse(report), lock, beforeExpiry));
});

test("another direct advisory on braces blocks the check", () => {
  const { report, lock } = fixture();
  report.vulnerabilities.braces.via.push({ url: "https://github.com/advisories/GHSA-new" });
  assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
});

test("a new indirect advisory on a known parent blocks the check", () => {
  const { report, lock } = fixture();
  report.vulnerabilities.micromatch.via.push("another-package");
  assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
});

test("a critical reclassification of the accepted advisory requires review", () => {
  const { report, lock } = fixture();
  report.vulnerabilities.braces.severity = "critical";
  report.vulnerabilities.braces.via[0].severity = "critical";
  report.metadata.vulnerabilities.high = 6;
  report.metadata.vulnerabilities.critical = 1;
  assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
});

test("a finding in production or without explicit dev metadata blocks the check", () => {
  for (const dev of [false, undefined]) {
    const { report, lock } = fixture();
    lock.packages["node_modules/micromatch"].dev = dev;
    assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
  }
});

test("changed braces versions require review", () => {
  const { report, lock } = fixture();
  lock.packages["node_modules/braces"].version = "3.0.4";
  assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
});

test("the exception blocks at the start of 6 November UTC", () => {
  const { report, lock } = fixture();
  assert.throws(() => evaluateAudit(parse(report), lock, Date.parse("2026-11-06T00:00:00Z")), /expired/);
});

test("unknown or additional installation nodes are rejected", () => {
  for (const nodes of [["node_modules/other/braces"], ["node_modules/braces", "node_modules/other/braces"]]) {
    const { report, lock } = fixture();
    report.vulnerabilities.braces.nodes = nodes;
    assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
  }
});

test("missing dependency links and cycles cannot qualify for the exception", () => {
  for (const change of ["missing", "cycle"]) {
    const { report, lock } = fixture();
    if (change === "missing") {
      delete report.vulnerabilities.braces;
      report.metadata.vulnerabilities.high = 6;
      report.metadata.vulnerabilities.total = 6;
    } else report.vulnerabilities.micromatch.via = ["fast-glob"];
    assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
  }
});

test("new packages block even if they refer to the accepted advisory", () => {
  const { report, lock } = fixture();
  report.vulnerabilities.other = { name: "other", severity: "high", via: ["braces"], nodes: ["node_modules/other"] };
  report.metadata.vulnerabilities.high = 8;
  report.metadata.vulnerabilities.total = 8;
  lock.packages["node_modules/other"] = { dev: true };
  assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
});

test("audit errors, invalid JSON and incomplete reports fail closed", () => {
  for (const result of [
    { status: 1, stdout: '{"error":{"code":"ENETUNREACH"}}' },
    { status: 1, stdout: "not JSON" },
    { status: 0, stdout: "{}" },
    { status: 2, stdout: "{}" },
    { status: null, stdout: "", error: new Error("network error") },
    { status: 1, stdout: "{}", signal: "SIGTERM" },
  ]) assert.throws(() => parseAuditResult(result));
});

test("inconsistent metadata and exit status cannot hide findings", () => {
  const { report } = fixture();
  assert.throws(() => parse(report, 0));
  report.metadata.vulnerabilities.total = 0;
  assert.throws(() => parse(report));
  report.metadata.vulnerabilities.total = 7;
  delete report.metadata.vulnerabilities.high;
  assert.throws(() => parse(report));
});

test("a missing lockfile node or invalid date blocks the exception", () => {
  const { report, lock } = fixture();
  assert.throws(() => evaluateAudit(parse(report), lock, NaN));
  delete lock.packages["node_modules/braces"];
  assert.throws(() => evaluateAudit(parse(report), lock, beforeExpiry));
});
