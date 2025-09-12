/**
 * Validates that a number is a percentage value (0 to 100 inclusive).
 * Global Standard: ISO 80000-1 percentage definition.
 */
export function validatePercentage(value: unknown): boolean {
  if (typeof value !== "number") return false;
  return value >= 0 && value <= 100;
}
