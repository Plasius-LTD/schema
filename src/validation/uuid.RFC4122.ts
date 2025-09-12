/** 
 * Validates a string against the RFC 4122 format for UUIDs. 
 * Matches UUIDs of versions 1 to 5, e.g., "123e4567-e89b-12d3-a456-426614174000".
 */ 
export const validateUUID = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
};
