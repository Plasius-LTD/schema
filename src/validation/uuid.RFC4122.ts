/** 
 * Validates the RFC 9562 UUID text format, including versions 1-8 plus Nil and
 * Max UUIDs. The legacy filename is retained for import compatibility.
 */ 
export const validateUUID = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const standard = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return standard.test(value)
    || value.toLowerCase() === "00000000-0000-0000-0000-000000000000"
    || value.toLowerCase() === "ffffffff-ffff-ffff-ffff-ffffffffffff";
};
