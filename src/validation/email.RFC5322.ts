/**
 * Validates an email string using a simplified RFC 5322-compliant regex.
 * Returns true if the input is a string in the format `name@domain.tld`.
 */
export const validateEmail = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};
