/**
 * Validates that a user ID is a valid `sub` from one of the supported identity providers.
 * Global Standard: OpenID Connect Core 1.0 `sub` claim.
 */
export function validateUserId(value: unknown): boolean {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  // Google: all digits
  const googlePattern = /^\d{21,22}$/;

  // Microsoft: UUID v4
  const microsoftPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Apple: opaque, usually UUID but allow any printable string up to 255 chars
  const applePattern = /^[\w\-.]{6,255}$/; // Alphanumeric + - . _ (common safe characters)

  return (
    googlePattern.test(trimmed) ||
    microsoftPattern.test(trimmed) ||
    applePattern.test(trimmed)
  );
}

export function validateUserIdArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.every(validateUserId);
}