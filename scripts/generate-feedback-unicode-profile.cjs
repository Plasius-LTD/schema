#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PROFILE_ID = "unicode-15.1.0-nfkc-v1";
const SOURCE_PACKAGE = "@unicode/unicode-15.1.0";
const SOURCE_VERSION = "1.6.17";
const SOURCE_PROPERTY = "General_Category/Unassigned";
const EXPECTED_RANGE_COUNT = 707;
const EXPECTED_ENDPOINT_COUNT = EXPECTED_RANGE_COUNT * 2;
const EXPECTED_CODE_POINT_COUNT = 824_718;
const EXPECTED_ENDPOINT_SHA256 =
  "591e457524d6b4b988aa7c7687e76c95a78370fea38bbd1b09085be7fd935ef3";
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../unicode/feedback-unicode-15.1.0-unassigned.json",
);

function parseArguments(argv) {
  if (argv.length === 0) {
    return { mode: "write" };
  }
  if (argv.length === 1 && argv[0] === "--check") {
    return { mode: "check" };
  }
  if (argv.length === 1 && argv[0] === "--print") {
    return { mode: "print" };
  }
  throw new Error(
    "Usage: generate-feedback-unicode-profile.cjs [--check|--print]",
  );
}

function loadPinnedSource() {
  const packageJsonPath = require.resolve(`${SOURCE_PACKAGE}/package.json`);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (
    packageJson.name !== SOURCE_PACKAGE ||
    packageJson.version !== SOURCE_VERSION
  ) {
    throw new Error(
      `Expected ${SOURCE_PACKAGE}@${SOURCE_VERSION}; found ` +
        `${String(packageJson.name)}@${String(packageJson.version)}.`,
    );
  }

  const rangesPath = require.resolve(
    `${SOURCE_PACKAGE}/${SOURCE_PROPERTY}/ranges.js`,
  );
  const ranges = require(rangesPath);
  if (!Array.isArray(ranges)) {
    throw new Error("Pinned Unicode source did not export a range array.");
  }
  return ranges;
}

function collectEndpoints(ranges) {
  const endpoints = [];
  let previousEnd = -1;
  let codePointCount = 0;

  for (const range of ranges) {
    const start = range?.begin;
    const end = range?.end;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      start <= previousEnd ||
      end <= start ||
      end > 0x110000
    ) {
      throw new Error("Pinned Unicode source contains an invalid range.");
    }
    endpoints.push(start, end);
    codePointCount += end - start;
    previousEnd = end;
  }

  return { endpoints, codePointCount };
}

function digestEndpoints(endpoints) {
  const encoded = Buffer.allocUnsafe(endpoints.length * 4);
  for (let index = 0; index < endpoints.length; index += 1) {
    encoded.writeUInt32BE(endpoints[index], index * 4);
  }
  return crypto.createHash("sha256").update(encoded).digest("hex");
}

function encodeUnsignedLeb128(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("ULEB128 input must be a non-negative safe integer.");
  }
  const bytes = [];
  let remaining = value;
  do {
    let byte = remaining % 128;
    remaining = Math.floor(remaining / 128);
    if (remaining > 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (remaining > 0);
  return bytes;
}

function encodeEndpointDeltas(endpoints) {
  const bytes = [];
  let previousEndpoint = 0;
  for (const endpoint of endpoints) {
    const delta = endpoint - previousEndpoint;
    if (delta <= 0) {
      throw new Error("Endpoint deltas must be strictly positive.");
    }
    bytes.push(...encodeUnsignedLeb128(delta));
    previousEndpoint = endpoint;
  }
  return Buffer.from(bytes).toString("base64url");
}

function renderArtifact(encodedPayload) {
  return [
    "{",
    `  "profileId": "${PROFILE_ID}",`,
    '  "unicodeVersion": "15.1.0",',
    `  "sourcePackage": "${SOURCE_PACKAGE}",`,
    `  "sourcePackageVersion": "${SOURCE_VERSION}",`,
    `  "sourceProperty": "${SOURCE_PROPERTY}",`,
    '  "rangeEncoding": "flat-half-open-delta-uleb128-base64url-v1",',
    `  "rangeCount": ${EXPECTED_RANGE_COUNT},`,
    `  "endpointCount": ${EXPECTED_ENDPOINT_COUNT},`,
    `  "codePointCount": ${EXPECTED_CODE_POINT_COUNT},`,
    `  "endpointSha256": "${EXPECTED_ENDPOINT_SHA256}",`,
    `  "payload": "${encodedPayload}"`,
    "}",
    "",
  ].join("\n");
}

function main() {
  const { mode } = parseArguments(process.argv.slice(2));
  const ranges = loadPinnedSource();
  const { endpoints, codePointCount } = collectEndpoints(ranges);
  const endpointSha256 = digestEndpoints(endpoints);
  const encodedPayload = encodeEndpointDeltas(endpoints);

  if (
    ranges.length !== EXPECTED_RANGE_COUNT ||
    endpoints.length !== EXPECTED_ENDPOINT_COUNT ||
    codePointCount !== EXPECTED_CODE_POINT_COUNT ||
    endpointSha256 !== EXPECTED_ENDPOINT_SHA256
  ) {
    throw new Error(
      "Pinned Unicode source does not match the reviewed feedback corpus.",
    );
  }

  const rendered = renderArtifact(encodedPayload);
  if (mode === "check") {
    const existing = fs.readFileSync(OUTPUT_PATH, "utf8");
    if (existing !== rendered) {
      throw new Error(
        "Unicode feedback corpus is stale; run npm run unicode:generate.",
      );
    }
    console.log(
      `Unicode feedback corpus verified (${ranges.length} ranges; ` +
        `${codePointCount} code points; ${endpointSha256}).`,
    );
    return;
  }
  if (mode === "print") {
    process.stdout.write(rendered);
    return;
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, rendered, "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}.`);
}

try {
  main();
} catch (error) {
  console.error(`Unicode feedback corpus generation failed: ${error.message}`);
  process.exitCode = 1;
}
