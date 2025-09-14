/**
 * Validates that a version string conforms to Semantic Versioning (SemVer 2.0.0).
 * Global Standard: https://semver.org/
 */
export function validateSemVer(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^(\d+)\.(\d+)\.(\d+)$/.test(value);
}
