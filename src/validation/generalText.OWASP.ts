/**
 * Validates that a text field is safe for storage (per OWASP guidelines).
 * Applies to general text fields: names, descriptions, titles, etc.
 * Global Standard: OWASP Input Validation Cheat Sheet (2024)
 */
export function validateSafeText(value: unknown): boolean {
  if (typeof value !== "string") return false;

  // Trimmed version should not be empty
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  // Reject control chars
  for (let i = 0; i < trimmed.length; i++) {
    const code = trimmed.codePointAt(i);
    if (code !== undefined && (code >= 0x00 && code <= 0x1F || code === 0x7F)) {
      return false;
    }
  }

  // Reject dangerous characters
  if (/['"<>\\{}();]/.test(trimmed)) return false;

  // Reject SQL-style injection patterns
  if (
    /(--|\b(SELECT|UPDATE|DELETE|INSERT|DROP|ALTER|EXEC|UNION|GRANT|REVOKE)\b|\/\*|\*\/|@@)/i.test(
      trimmed
    )
  )
    return false;

  // Reject null char
  if (trimmed.includes("\u0000")) return false;

  // Optional: limit length
  if (trimmed.length > 1024) return false;

  return true;
}
