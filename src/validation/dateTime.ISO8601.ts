/**
 * Validates whether a string is a properly formatted ISO 8601 datetime.
 * Ensures the string parses as a valid Date and matches the canonical toISOString() format.
 */
export const validateDateTimeISO = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !isNaN(date.getTime()) && value === date.toISOString();
};
