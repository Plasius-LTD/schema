/**
 * Validates that a version string conforms to Semantic Versioning (SemVer 2.0.0).
 * Global Standard: https://semver.org/
 */
export function validateSemVer(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/.test(
    value
  );
}
