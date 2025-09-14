export type PIIClassification = "none" | "low" | "high";

export type PIIAction = "encrypt" | "hash" | "clear" | "none";

export type PIILogHandling = "redact" | "omit" | "pseudonym" | "plain";

export type PiiEnforcement = "strict" | "warn" | "none";

export interface PII {
  classification: PIIClassification;
  action: PIIAction;
  logHandling?: PIILogHandling; // How should this PII be handled in logs?
  purpose?: string; // optional, for audit: e.g. "user contact", "analytics"
}

/**
 * Centralized PII enforcement for field-level validation.
 * Returns { shortCircuit: true } when in strict mode and value is missing for high PII.
 */
export function enforcePIIField(
  parentKey: string,
  key: string,
  value: any,
  def: any,
  enforcement: PiiEnforcement = "none",
  errors?: string[],
  logger?: { warn: (msg: string) => void }
): { shortCircuit: boolean } {
  const path = parentKey ? `${parentKey}.${key}` : key;
  if (def?._pii?.classification === "high" && (def?.isRequired ?? true)) {
    const missing = value === undefined || value === null || value === "";
    if (missing) {
      const msg = `High PII field must not be empty: ${path}`;
      if (enforcement === "strict") {
        errors?.push(msg);
        return { shortCircuit: true };
      }
      if (enforcement === "warn") {
        logger?.warn?.(`WARN (PII Enforcement): ${msg}`);
      }
    }
  }
  return { shortCircuit: false };
}

/**
 * Apply storage-time PII transforms based on field definitions in shape.
 */
export function prepareForStorage(
  shape: Record<string, any>,
  input: Record<string, any>,
  encryptFn: (value: any) => string,
  hashFn: (value: any) => string
): Record<string, any> {
  const result: any = {};
  for (const key in shape) {
    const def = shape[key];
    if (!def) continue;
    const value = input[key];
    if (def._pii?.action === "encrypt") {
      result[key + "Encrypted"] = encryptFn(value);
    } else if (def._pii?.action === "hash") {
      result[key + "Hash"] = hashFn(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Apply read-time PII transforms (e.g., decrypt) based on field definitions in shape.
 */
export function prepareForRead(
  shape: Record<string, any>,
  stored: Record<string, any>,
  decryptFn: (value: string) => any
): Record<string, any> {
  const result: any = {};
  for (const key in shape) {
    const def = shape[key];
    if (!def) continue;
    if (def._pii?.action === "encrypt") {
      result[key] = decryptFn(stored[key + "Encrypted"]);
    } else {
      result[key] = stored[key];
    }
  }
  return result;
}

/**
 * Sanitize data for logging according to PII logHandling.
 */
export function sanitizeForLog(
  shape: Record<string, any>,
  data: Record<string, any>,
  pseudonymFn: (value: any) => string
): Record<string, any> {
  const output: any = {};
  for (const key in shape) {
    const def = shape[key];
    if (!def) continue;
    const value = data[key];
    const handling = def._pii?.logHandling as PIILogHandling | undefined;
    if (handling === "omit") continue;
    if (handling === "redact") {
      output[key] = "[REDACTED]";
    } else if (handling === "pseudonym") {
      output[key] = pseudonymFn(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

/**
 * Produce a PII audit list for the given shape.
 */
export function getPiiAudit(shape: Record<string, any>): Array<{
  field: string;
  classification: PIIClassification;
  action: PIIAction;
  logHandling?: PIILogHandling;
  purpose?: string;
}> {
  const piiFields: Array<any> = [];
  for (const key in shape) {
    const def = shape[key];
    if (!def) continue;
    if (def._pii && def._pii.classification !== "none") {
      piiFields.push({
        field: key,
        classification: def._pii.classification,
        action: def._pii.action,
        logHandling: def._pii.logHandling,
        purpose: def._pii.purpose,
      });
    }
  }
  return piiFields;
}

/**
 * Scrub PII fields for delete/retention workflows.
 */
export function scrubPiiForDelete(
  shape: Record<string, any>,
  stored: Record<string, any>
): Record<string, any> {
  const result: any = { ...stored };
  for (const key in shape) {
    const def = shape[key];
    if (!def) continue;
    if (def._pii?.action === "encrypt") {
      result[key + "Encrypted"] = null;
    } else if (def._pii?.action === "hash") {
      result[key + "Hash"] = null;
    } else if (def._pii?.action === "clear") {
      result[key] = null;
    }
  }
  return result;
}
