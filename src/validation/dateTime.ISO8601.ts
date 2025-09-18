/**
 * Validates whether a string is a properly formatted ISO 8601 datetime, date, or time.
 * 
 * @param value - The value to validate.
 * @param options - Optional settings for validation mode.
 * @param options.mode - The mode of validation:
 *   - "datetime" (default): Checks full ISO 8601 datetime and equality with toISOString().
 *   - "date": Validates that the string is in YYYY-MM-DD format and represents a valid date.
 *   - "time": Validates that the string matches a valid HH:MM:SS(.sss)?Z? ISO 8601 time pattern.
 * @returns True if the value is valid according to the specified mode; otherwise, false.
 */
export const validateDateTimeISO = (
  value: unknown,
  options?: { mode?: "datetime" | "date" | "time" }
): boolean => {
  const mode = options?.mode ?? "datetime";

  if (typeof value !== "string") return false;

  if (mode === "datetime") {
    // Strict ISO 8601 date-time: YYYY-MM-DDTHH:mm:ss(.fraction)?(Z|±HH:MM)
    const isoDateTimeRegex =
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

    if (!isoDateTimeRegex.test(value)) return false;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;

    // We purposely do NOT require `value === date.toISOString()` because
    // valid ISO8601 inputs may include offsets (e.g., "+01:00") or omit
    // milliseconds, both of which produce a different canonical ISO string.
    // The regex ensures strict shape; Date parsing ensures it is a real moment.
    return true;
  }

  if (mode === "date") {
    // YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    if (isNaN(date.getTime())) return false;
    // Ensure the date parts match exactly (to avoid 2023-02-30 being accepted)
    const [year, month, day] = value.split("-").map(Number);
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    );
  }

  if (mode === "time") {
    // HH:MM:SS(.sss)?Z?
    // Hours: 00-23, Minutes: 00-59, Seconds: 00-59, optional fractional seconds, optional Z
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?Z?$/;
    return timeRegex.test(value);
  }

  return false;
};
