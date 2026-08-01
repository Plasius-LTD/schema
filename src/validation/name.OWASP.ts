function validateNameLike(value: unknown, pattern: RegExp): boolean {
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

  if (!pattern.test(trimmed)) return false;

  return true;
}

/**
 * Validates that a personal name is safe and culturally inclusive.
 *
 * Decimal digits remain unsupported because first, middle, and last names are
 * personal-name components rather than public display identifiers.
 *
 * Global Standard: OWASP Input Validation Cheat Sheet + ICAO Doc 9303 + IETF PRECIS
 */
export function validateName(value: unknown): boolean {
  return validateNameLike(value, /^[\p{L}\p{M}'\-. ]+$/u);
}

/**
 * Validates a public display name independently from personal-name fields.
 *
 * Unicode decimal digits are supported alongside letters and combining marks
 * so legitimate display names such as `Player 2` remain representable without
 * relaxing first, middle, or last-name validation.
 *
 * Global Standard: OWASP Input Validation Cheat Sheet + IETF PRECIS
 */
export function validateDisplayName(value: unknown): boolean {
  return validateNameLike(value, /^[\p{L}\p{M}\p{Nd}'\-. ]+$/u);
}
