/**
 *  Validates a phone number string in strict E.164 format.
 *  Returns true for strings like "+441632960960" (max 15 digits, starting with a '+').
 */
export const validatePhone = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const phoneRegex = /^\+[1-9]\d{1,14}$/; // E.164 format
  return phoneRegex.test(value);
};
