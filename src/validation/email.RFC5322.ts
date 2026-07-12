/**
 * Validates the package's pragmatic dot-domain mailbox subset.
 *
 * This intentionally does not claim full RFC 5322 mailbox support (for
 * example, quoted local parts and address literals are outside the product
 * contract). The legacy filename is retained for import compatibility.
 */
export const validateEmail = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};
