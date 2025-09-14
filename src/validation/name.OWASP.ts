/**
 * Validates that a name is safe, culturally inclusive, and matches global best practice.
 * Global Standard: OWASP Input Validation Cheat Sheet + ICAO Doc 9303 + IETF PRECIS
 */
export function validateName(value: unknown): boolean {
  if (typeof value !== "string") return false;

  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  // Limit length (ISO guidance: max 256 is typical)
  if (trimmed.length > 256) return false;

  // Reject ASCII control chars (U+0000–U+001F and U+007F)
  for (const ch of trimmed) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x00 && cp <= 0x1F) || cp === 0x7F) return false;
  }

  // Core pattern
  const namePattern = /^[\p{L}\p{M}'\- ]+$/u;
  if (!namePattern.test(trimmed)) return false;

  return true;
}
