/**
 * Validates a URL string using the WHATWG URL API.
 * Accepts only 'http' or 'https' protocols.
 * Returns true if the URL is syntactically valid.
 */
export const validateUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    // Enforce scheme:
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
};
