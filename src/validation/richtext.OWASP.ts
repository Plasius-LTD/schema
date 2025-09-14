/**
 * Validates rich text input to ensure it contains only safe HTML/Markdown.
 * Global Standard: OWASP HTML Sanitization Guidelines (2024).
 * This validator checks for dangerous patterns — does not sanitize — assumes text will be sanitized downstream.
 */
export function validateRichText(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true; // Allow empty rich text

  // Reject known dangerous tags
  if (
    /<(script|iframe|object|embed|style|link|meta|base|form|input|button|textarea|select)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }

  // Reject javascript: links
  if (/javascript:/i.test(trimmed)) {
    return false;
  }

  // Reject event handlers (onload, onclick, etc)
  if (/on\w+=["']?/i.test(trimmed)) {
    return false;
  }

  // Optionally: limit max length (e.g. 10,000 chars)
  if (trimmed.length > 10000) return false;

  return true;
}
