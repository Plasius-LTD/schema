import profileArtifact from "../unicode/feedback-unicode-15.1.0-unassigned.json" with {
  type: "json",
};
import { decodeFeedbackUnicodeProfileArtifact } from "./feedback-unicode-profile.codec.js";

/** Canonical Unicode and normalization profile for transient feedback text. */
export const FEEDBACK_UNICODE_PROFILE_ID =
  "unicode-15.1.0-nfkc-v1" as const;

/**
 * SHA-256 of the flattened half-open range endpoints encoded as unsigned
 * 32-bit big-endian integers.
 */
export const FEEDBACK_UNICODE_PROFILE_ENDPOINT_SHA256 =
  "591e457524d6b4b988aa7c7687e76c95a78370fea38bbd1b09085be7fd935ef3" as const;

const MAX_UNICODE_CODE_POINT = 0x10ffff;
const HIGH_SURROGATE_START = 0xd800;
const HIGH_SURROGATE_END = 0xdbff;
const LOW_SURROGATE_START = 0xdc00;
const LOW_SURROGATE_END = 0xdfff;

const UNASSIGNED_RANGE_ENDPOINTS = decodeFeedbackUnicodeProfileArtifact(
  profileArtifact,
  {
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
  },
);

/**
 * Reports whether a numeric code point is unsupported by the pinned feedback
 * profile.
 *
 * Unicode 15.1 `General_Category=Unassigned` values return `true`. Invalid
 * numeric values and surrogate code points also return `true` so validation
 * callers fail closed.
 */
export function isFeedbackUnicodeProfileUnassigned(
  codePoint: number,
): boolean {
  if (
    UNASSIGNED_RANGE_ENDPOINTS === undefined ||
    !Number.isInteger(codePoint) ||
    codePoint < 0 ||
    codePoint > MAX_UNICODE_CODE_POINT ||
    (codePoint >= HIGH_SURROGATE_START &&
      codePoint <= LOW_SURROGATE_END)
  ) {
    return true;
  }

  let lowerRange = 0;
  let upperRange = UNASSIGNED_RANGE_ENDPOINTS.length / 2 - 1;

  while (lowerRange <= upperRange) {
    const rangeIndex = Math.floor((lowerRange + upperRange) / 2);
    const start = UNASSIGNED_RANGE_ENDPOINTS[rangeIndex * 2];
    const end = UNASSIGNED_RANGE_ENDPOINTS[rangeIndex * 2 + 1];

    if (start === undefined || end === undefined) {
      return true;
    }
    if (codePoint < start) {
      upperRange = rangeIndex - 1;
    } else if (codePoint >= end) {
      lowerRange = rangeIndex + 1;
    } else {
      return true;
    }
  }

  return false;
}

/**
 * Reports whether text contains a Unicode 15.1-unassigned code point or a
 * lone UTF-16 surrogate.
 *
 * The scan uses code units deliberately so malformed strings cannot be
 * silently replaced or normalized before profile enforcement. Callers must
 * apply their own UTF-16 length bound before passing untrusted text; this
 * generic helper intentionally does not impose a product-specific limit.
 */
export function containsFeedbackUnicodeProfileUnsupportedText(
  text: string,
): boolean {
  if (typeof text !== "string") {
    return true;
  }

  for (let index = 0; index < text.length; index += 1) {
    const first = text.charCodeAt(index);
    let codePoint = first;

    if (first >= HIGH_SURROGATE_START && first <= HIGH_SURROGATE_END) {
      const second = text.charCodeAt(index + 1);
      if (
        !Number.isInteger(second) ||
        second < LOW_SURROGATE_START ||
        second > LOW_SURROGATE_END
      ) {
        return true;
      }
      codePoint =
        0x10000 +
        ((first - HIGH_SURROGATE_START) << 10) +
        (second - LOW_SURROGATE_START);
      index += 1;
    } else if (first >= LOW_SURROGATE_START && first <= LOW_SURROGATE_END) {
      return true;
    }

    if (isFeedbackUnicodeProfileUnassigned(codePoint)) {
      return true;
    }
  }

  return false;
}
