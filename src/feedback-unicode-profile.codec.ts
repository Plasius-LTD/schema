const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_UNICODE_ENDPOINT = 0x110000;
const MAX_ENCODED_PAYLOAD_CHARACTERS = 8_192;
const MAX_ULEB128_BYTES = 5;
const MAX_PROFILE_RANGE_COUNT = 707;
const MAX_PROFILE_ENDPOINT_COUNT = MAX_PROFILE_RANGE_COUNT * 2;
const MAX_PROFILE_CODE_POINT_COUNT = MAX_UNICODE_ENDPOINT;
const ARTIFACT_KEYS = new Set([
  "profileId",
  "unicodeVersion",
  "sourcePackage",
  "sourcePackageVersion",
  "sourceProperty",
  "rangeEncoding",
  "rangeCount",
  "endpointCount",
  "codePointCount",
  "endpointSha256",
  "payload",
]);

export interface FeedbackUnicodeProfileExpectation {
  readonly profileId: string;
  readonly unicodeVersion: string;
  readonly sourcePackage: string;
  readonly sourcePackageVersion: string;
  readonly sourceProperty: string;
  readonly rangeEncoding: string;
  readonly rangeCount: number;
  readonly endpointCount: number;
  readonly codePointCount: number;
  readonly endpointSha256: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExpectedMetadata(
  artifact: Record<string, unknown>,
  expected: FeedbackUnicodeProfileExpectation,
): boolean {
  return (
    Object.keys(artifact).length === ARTIFACT_KEYS.size &&
    Object.keys(artifact).every((key) => ARTIFACT_KEYS.has(key)) &&
    artifact.profileId === expected.profileId &&
    artifact.unicodeVersion === expected.unicodeVersion &&
    artifact.sourcePackage === expected.sourcePackage &&
    artifact.sourcePackageVersion === expected.sourcePackageVersion &&
    artifact.sourceProperty === expected.sourceProperty &&
    artifact.rangeEncoding === expected.rangeEncoding &&
    artifact.rangeCount === expected.rangeCount &&
    artifact.endpointCount === expected.endpointCount &&
    artifact.codePointCount === expected.codePointCount &&
    artifact.endpointSha256 === expected.endpointSha256
  );
}

function isBoundedPositiveInteger(
  value: unknown,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}

function hasBoundedCounts(
  artifact: Record<string, unknown>,
  expected: FeedbackUnicodeProfileExpectation,
): boolean {
  return (
    isBoundedPositiveInteger(
      artifact.rangeCount,
      MAX_PROFILE_RANGE_COUNT,
    ) &&
    isBoundedPositiveInteger(
      expected.rangeCount,
      MAX_PROFILE_RANGE_COUNT,
    ) &&
    isBoundedPositiveInteger(
      artifact.endpointCount,
      MAX_PROFILE_ENDPOINT_COUNT,
    ) &&
    isBoundedPositiveInteger(
      expected.endpointCount,
      MAX_PROFILE_ENDPOINT_COUNT,
    ) &&
    artifact.endpointCount === artifact.rangeCount * 2 &&
    expected.endpointCount === expected.rangeCount * 2 &&
    isBoundedPositiveInteger(
      artifact.codePointCount,
      MAX_PROFILE_CODE_POINT_COUNT,
    ) &&
    isBoundedPositiveInteger(
      expected.codePointCount,
      MAX_PROFILE_CODE_POINT_COUNT,
    )
  );
}

function decodeCanonicalBase64Url(value: string): Uint8Array | undefined {
  if (
    value.length === 0 ||
    value.length > MAX_ENCODED_PAYLOAD_CHARACTERS ||
    value.length % 4 === 1 ||
    !BASE64URL_PATTERN.test(value)
  ) {
    return undefined;
  }

  const finalSextet = BASE64URL_ALPHABET.indexOf(value.at(-1) ?? "");
  if (
    finalSextet < 0 ||
    (value.length % 4 === 2 && (finalSextet & 0b1111) !== 0) ||
    (value.length % 4 === 3 && (finalSextet & 0b11) !== 0)
  ) {
    return undefined;
  }

  const expectedByteCount = Math.floor((value.length * 6) / 8);
  const output = new Uint8Array(expectedByteCount);
  let outputIndex = 0;
  let accumulator = 0;
  let bitCount = 0;

  for (const character of value) {
    const sextet = BASE64URL_ALPHABET.indexOf(character);
    if (sextet < 0) {
      return undefined;
    }
    accumulator = (accumulator << 6) | sextet;
    bitCount += 6;
    while (bitCount >= 8) {
      bitCount -= 8;
      output[outputIndex] = (accumulator >> bitCount) & 0xff;
      outputIndex += 1;
      accumulator &= (1 << bitCount) - 1;
    }
  }

  if (
    outputIndex !== expectedByteCount ||
    (bitCount > 0 && accumulator !== 0)
  ) {
    return undefined;
  }
  return output;
}

function decodeCanonicalEndpointDeltas(
  bytes: Uint8Array,
  endpointCount: number,
): Uint32Array | undefined {
  if (
    !isBoundedPositiveInteger(
      endpointCount,
      MAX_PROFILE_ENDPOINT_COUNT,
    ) ||
    endpointCount % 2 !== 0
  ) {
    return undefined;
  }
  const endpoints = new Uint32Array(endpointCount);
  let byteOffset = 0;
  let previousEndpoint = 0;

  for (let endpointIndex = 0; endpointIndex < endpointCount; endpointIndex += 1) {
    let delta = 0;
    let multiplier = 1;
    let byteCount = 0;

    while (true) {
      if (byteOffset >= bytes.length || byteCount >= MAX_ULEB128_BYTES) {
        return undefined;
      }
      const byte = bytes[byteOffset];
      if (byte === undefined) {
        return undefined;
      }
      byteOffset += 1;
      byteCount += 1;

      const payload = byte & 0x7f;
      delta += payload * multiplier;
      if (!Number.isSafeInteger(delta)) {
        return undefined;
      }

      if ((byte & 0x80) === 0) {
        if (byteCount > 1 && payload === 0) {
          return undefined;
        }
        break;
      }
      multiplier *= 128;
    }

    const endpoint = previousEndpoint + delta;
    if (
      delta <= 0 ||
      !Number.isSafeInteger(endpoint) ||
      endpoint > MAX_UNICODE_ENDPOINT
    ) {
      return undefined;
    }
    endpoints[endpointIndex] = endpoint;
    previousEndpoint = endpoint;
  }

  if (byteOffset !== bytes.length) {
    return undefined;
  }
  return endpoints;
}

function hasExpectedRanges(
  endpoints: Uint32Array,
  expected: FeedbackUnicodeProfileExpectation,
): boolean {
  let previousEnd = -1;
  let codePointCount = 0;

  for (let index = 0; index < endpoints.length; index += 2) {
    const start = endpoints[index];
    const end = endpoints[index + 1];
    if (
      start === undefined ||
      end === undefined ||
      start <= previousEnd ||
      end <= start ||
      end > MAX_UNICODE_ENDPOINT
    ) {
      return false;
    }
    codePointCount += end - start;
    previousEnd = end;
  }

  return codePointCount === expected.codePointCount;
}

/**
 * Decodes and validates the checked-in Unicode profile artifact.
 *
 * This is an internal supply-boundary helper. It deliberately returns no
 * partial data: malformed base64url, non-shortest ULEB128, overflow, range
 * disorder, count mismatch, trailing bytes, or metadata drift all fail
 * closed.
 */
export function decodeFeedbackUnicodeProfileArtifact(
  value: unknown,
  expected: FeedbackUnicodeProfileExpectation,
): Uint32Array | undefined {
  if (
    !isRecord(value) ||
    !hasBoundedCounts(value, expected) ||
    !hasExpectedMetadata(value, expected) ||
    typeof value.payload !== "string"
  ) {
    return undefined;
  }

  const bytes = decodeCanonicalBase64Url(value.payload);
  if (bytes === undefined) {
    return undefined;
  }
  const endpoints = decodeCanonicalEndpointDeltas(
    bytes,
    expected.endpointCount,
  );
  return endpoints !== undefined && hasExpectedRanges(endpoints, expected)
    ? endpoints
    : undefined;
}
