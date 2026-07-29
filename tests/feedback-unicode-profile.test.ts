import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import profileArtifact from "../unicode/feedback-unicode-15.1.0-unassigned.json" with {
  type: "json",
};
import {
  FEEDBACK_UNICODE_PROFILE_ENDPOINT_SHA256,
  FEEDBACK_UNICODE_PROFILE_ID,
  containsFeedbackUnicodeProfileUnsupportedText,
  isFeedbackUnicodeProfileUnassigned,
} from "../src/feedback-unicode-profile.js";
import {
  decodeFeedbackUnicodeProfileArtifact,
  type FeedbackUnicodeProfileExpectation,
} from "../src/feedback-unicode-profile.codec.js";

const SURROGATE_START = 0xd800;
const SURROGATE_END = 0xdfff;
const MAX_UNICODE_CODE_POINT = 0x10ffff;
const REVIEWED_EXPECTATION = {
  profileId: FEEDBACK_UNICODE_PROFILE_ID,
  unicodeVersion: "15.1.0",
  sourcePackage: "@unicode/unicode-15.1.0",
  sourcePackageVersion: "1.6.17",
  sourceProperty: "General_Category/Unassigned",
  rangeEncoding: "flat-half-open-delta-uleb128-base64url-v1",
  rangeCount: 707,
  endpointCount: 1_414,
  codePointCount: 824_718,
  endpointSha256: FEEDBACK_UNICODE_PROFILE_ENDPOINT_SHA256,
} as const satisfies FeedbackUnicodeProfileExpectation;

const REVIEWED_ENDPOINTS = decodeFeedbackUnicodeProfileArtifact(
  profileArtifact,
  REVIEWED_EXPECTATION,
);
if (REVIEWED_ENDPOINTS === undefined) {
  throw new Error("The checked-in Unicode feedback profile is invalid.");
}

const encodeUnsignedLeb128 = (value: number): number[] => {
  const bytes: number[] = [];
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
};

const encodePayload = (bytes: readonly number[]): string =>
  Buffer.from(bytes).toString("base64url");

const SYNTHETIC_EXPECTATION = {
  profileId: "synthetic-profile",
  unicodeVersion: "synthetic-version",
  sourcePackage: "synthetic-package",
  sourcePackageVersion: "synthetic-package-version",
  sourceProperty: "synthetic-property",
  rangeEncoding: "flat-half-open-delta-uleb128-base64url-v1",
  rangeCount: 1,
  endpointCount: 2,
  codePointCount: 2,
  endpointSha256: "synthetic-endpoint-digest",
} as const satisfies FeedbackUnicodeProfileExpectation;

const syntheticArtifact = (
  payload: string,
  expectation: FeedbackUnicodeProfileExpectation = SYNTHETIC_EXPECTATION,
) => ({
  ...expectation,
  payload,
});

describe("feedback Unicode 15.1 profile", () => {
  it("ships the complete upstream MIT and Unicode License V3 notices", () => {
    const notices = readFileSync(
      new URL("../THIRD_PARTY_NOTICES.md", import.meta.url),
      "utf8",
    )
      .replace(/\s+/gu, " ")
      .trim();
    for (const requiredNotice of [
      "Copyright Mathias Bynens <https://mathiasbynens.be/>",
      "Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction",
      "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.",
      "THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED",
      "UNICODE LICENSE V3",
      "COPYRIGHT AND PERMISSION NOTICE",
      "Copyright © 2016-2025 Unicode, Inc.",
      "NOTICE TO USER: Carefully read the following legal agreement.",
      "Permission is hereby granted, free of charge, to any person obtaining a copy of data files and any associated documentation (the \"Data Files\")",
      "THE DATA FILES AND SOFTWARE ARE PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND",
      "IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE BE LIABLE FOR ANY CLAIM",
      "Except as contained in this notice, the name of a copyright holder shall not be used in advertising",
      "SPDX-License-Identifier: Unicode-3.0",
    ]) {
      expect(notices).toContain(requiredNotice);
    }
  });

  it("binds the language-neutral corpus to its reviewed source and digest", () => {
    expect(profileArtifact).toMatchObject({
      profileId: FEEDBACK_UNICODE_PROFILE_ID,
      unicodeVersion: "15.1.0",
      sourcePackage: "@unicode/unicode-15.1.0",
      sourcePackageVersion: "1.6.17",
      sourceProperty: "General_Category/Unassigned",
      rangeEncoding: "flat-half-open-delta-uleb128-base64url-v1",
      rangeCount: 707,
      endpointCount: 1_414,
      codePointCount: 824_718,
      endpointSha256: FEEDBACK_UNICODE_PROFILE_ENDPOINT_SHA256,
    });
    expect(REVIEWED_ENDPOINTS).toHaveLength(profileArtifact.endpointCount);

    const encodedEndpoints = Buffer.alloc(
      REVIEWED_ENDPOINTS.length * 4,
    );
    REVIEWED_ENDPOINTS.forEach((endpoint, index) => {
      encodedEndpoints.writeUInt32BE(endpoint, index * 4);
    });
    expect(
      createHash("sha256").update(encodedEndpoints).digest("hex"),
    ).toBe(FEEDBACK_UNICODE_PROFILE_ENDPOINT_SHA256);
  });

  it("keeps every generated half-open range sorted and non-overlapping", () => {
    let previousEnd = -1;
    let codePointCount = 0;

    for (
      let index = 0;
      index < REVIEWED_ENDPOINTS.length;
      index += 2
    ) {
      const start = REVIEWED_ENDPOINTS[index];
      const end = REVIEWED_ENDPOINTS[index + 1];
      expect(start).toBeTypeOf("number");
      expect(end).toBeTypeOf("number");
      expect(start).toBeGreaterThan(previousEnd);
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(MAX_UNICODE_CODE_POINT + 1);
      codePointCount += (end ?? 0) - (start ?? 0);
      previousEnd = end ?? previousEnd;
    }

    expect(codePointCount).toBe(profileArtifact.codePointCount);
  });

  it("matches the pinned corpus exhaustively for every Unicode code point", () => {
    const mismatches: number[] = [];
    let endpointIndex = 0;
    let unsupportedCount = 0;

    for (
      let codePoint = 0;
      codePoint <= MAX_UNICODE_CODE_POINT;
      codePoint += 1
    ) {
      while (
        endpointIndex < REVIEWED_ENDPOINTS.length &&
        codePoint >= (REVIEWED_ENDPOINTS[endpointIndex + 1] ?? 0)
      ) {
        endpointIndex += 2;
      }
      const start =
        REVIEWED_ENDPOINTS[endpointIndex] ??
        MAX_UNICODE_CODE_POINT + 1;
      const end =
        REVIEWED_ENDPOINTS[endpointIndex + 1] ??
        MAX_UNICODE_CODE_POINT + 1;
      const corpusUnassigned = codePoint >= start && codePoint < end;
      const surrogate =
        codePoint >= SURROGATE_START && codePoint <= SURROGATE_END;
      const expectedUnsupported = corpusUnassigned || surrogate;
      const actual = isFeedbackUnicodeProfileUnassigned(codePoint);
      if (actual) {
        unsupportedCount += 1;
      }
      if (actual !== expectedUnsupported && mismatches.length < 20) {
        mismatches.push(codePoint);
      }
    }

    expect(mismatches).toEqual([]);
    expect(unsupportedCount).toBe(
      profileArtifact.codePointCount +
        (SURROGATE_END - SURROGATE_START + 1),
    );
  });

  it("handles every range boundary and fails closed for invalid values", () => {
    for (
      let index = 0;
      index < REVIEWED_ENDPOINTS.length;
      index += 2
    ) {
      const start = REVIEWED_ENDPOINTS[index] ?? 0;
      const end = REVIEWED_ENDPOINTS[index + 1] ?? 0;
      expect(isFeedbackUnicodeProfileUnassigned(start)).toBe(true);
      expect(isFeedbackUnicodeProfileUnassigned(end - 1)).toBe(true);
      if (
        start > 0 &&
        (start - 1 < SURROGATE_START || start - 1 > SURROGATE_END)
      ) {
        expect(isFeedbackUnicodeProfileUnassigned(start - 1)).toBe(false);
      }
      if (
        end <= MAX_UNICODE_CODE_POINT &&
        (end < SURROGATE_START || end > SURROGATE_END)
      ) {
        expect(isFeedbackUnicodeProfileUnassigned(end)).toBe(false);
      }
    }

    for (const unsupported of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1,
      1.5,
      SURROGATE_START,
      SURROGATE_END,
      MAX_UNICODE_CODE_POINT + 1,
    ]) {
      expect(isFeedbackUnicodeProfileUnassigned(unsupported)).toBe(true);
    }
  });

  it("rejects non-canonical, truncated, overflowing, or trailing payloads", () => {
    const validPayload = encodePayload([1, 2]);
    expect(
      decodeFeedbackUnicodeProfileArtifact(
        syntheticArtifact(validPayload),
        SYNTHETIC_EXPECTATION,
      ),
    ).toEqual(new Uint32Array([1, 3]));

    const invalidPayloads = [
      "",
      "A",
      "AQ==",
      "AR",
      encodePayload([0, 2]),
      encodePayload([0x81]),
      encodePayload([0x81, 0x00, 0x02]),
      encodePayload([1]),
      encodePayload([1, 2, 1]),
      encodePayload([0xff, 0xff, 0xff, 0xff, 0x7f, 1]),
      encodePayload([
        ...encodeUnsignedLeb128(MAX_UNICODE_CODE_POINT + 2),
        1,
      ]),
    ];
    for (const payload of invalidPayloads) {
      expect(
        decodeFeedbackUnicodeProfileArtifact(
          syntheticArtifact(payload),
          SYNTHETIC_EXPECTATION,
        ),
      ).toBeUndefined();
    }
    for (const invalidArtifact of [
      null,
      [],
      { ...syntheticArtifact(validPayload), payload: 1 },
      syntheticArtifact("A".repeat(8_193)),
    ]) {
      expect(
        decodeFeedbackUnicodeProfileArtifact(
          invalidArtifact,
          SYNTHETIC_EXPECTATION,
        ),
      ).toBeUndefined();
    }
  });

  it("fails closed on corpus metadata, digest, or range-count drift", () => {
    const validPayload = encodePayload([1, 2]);
    const mismatches: FeedbackUnicodeProfileExpectation[] = [
      { ...SYNTHETIC_EXPECTATION, profileId: "different-profile" },
      { ...SYNTHETIC_EXPECTATION, endpointSha256: "different-digest" },
      { ...SYNTHETIC_EXPECTATION, endpointCount: 4 },
      { ...SYNTHETIC_EXPECTATION, codePointCount: 3 },
    ];

    for (const artifactExpectation of mismatches) {
      expect(
        decodeFeedbackUnicodeProfileArtifact(
          syntheticArtifact(validPayload, artifactExpectation),
          SYNTHETIC_EXPECTATION,
        ),
      ).toBeUndefined();
    }
    expect(
      decodeFeedbackUnicodeProfileArtifact(
        {
          ...syntheticArtifact(validPayload),
          unexpected: "closed-artifact",
        },
        SYNTHETIC_EXPECTATION,
      ),
    ).toBeUndefined();
    const wrongDerivedCount = {
      ...SYNTHETIC_EXPECTATION,
      endpointCount: 3,
    };
    expect(
      decodeFeedbackUnicodeProfileArtifact(
        syntheticArtifact(validPayload, wrongDerivedCount),
        wrongDerivedCount,
      ),
    ).toBeUndefined();
  });

  it("bounds malformed artifact and expectation counts before allocation", () => {
    const validPayload = encodePayload([1, 2]);
    const malformedCounts: FeedbackUnicodeProfileExpectation[] = [
      {
        ...SYNTHETIC_EXPECTATION,
        rangeCount: 708,
        endpointCount: 1_416,
      },
      {
        ...SYNTHETIC_EXPECTATION,
        endpointCount: Number.MAX_SAFE_INTEGER,
      },
      {
        ...SYNTHETIC_EXPECTATION,
        codePointCount: 0x110001,
      },
      {
        ...SYNTHETIC_EXPECTATION,
        rangeCount: 1.5,
        endpointCount: 3,
      },
      {
        ...SYNTHETIC_EXPECTATION,
        rangeCount: 0,
        endpointCount: 0,
      },
      {
        ...SYNTHETIC_EXPECTATION,
        codePointCount: 0,
      },
    ];

    for (const malformedExpectation of malformedCounts) {
      let decoded: Uint32Array | undefined = undefined;
      expect(() => {
        decoded = decodeFeedbackUnicodeProfileArtifact(
          syntheticArtifact(validPayload, malformedExpectation),
          malformedExpectation,
        );
      }).not.toThrow();
      expect(decoded).toBeUndefined();
    }

    expect(
      decodeFeedbackUnicodeProfileArtifact(
        {
          ...syntheticArtifact(validPayload),
          endpointCount: Number.MAX_SAFE_INTEGER,
        },
        SYNTHETIC_EXPECTATION,
      ),
    ).toBeUndefined();
  });

  it("detects post-profile assignments and malformed UTF-16 text", () => {
    for (const text of [
      "",
      "Plain text",
      "Café",
      "😀",
      "\ue000",
    ]) {
      expect(containsFeedbackUnicodeProfileUnsupportedText(text)).toBe(false);
    }

    for (const codePoint of [
      0x0378,
      0x1c89,
      0xa7f1,
      0x10940,
      0x11db0,
      0x16ea0,
      0x1e6c0,
      0x323b0,
    ]) {
      expect(
        containsFeedbackUnicodeProfileUnsupportedText(
          String.fromCodePoint(codePoint),
        ),
      ).toBe(true);
    }

    for (const malformed of [
      "\ud800",
      "\udfff",
      "\ud800A",
      "A\udc00",
      "\ud800\ud800",
      "\udc00\udc00",
    ]) {
      expect(containsFeedbackUnicodeProfileUnsupportedText(malformed)).toBe(
        true,
      );
    }
  });
});
