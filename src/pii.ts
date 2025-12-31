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
  const build = (
    def: any,
    value: any,
    key: string,
    out: any,
    ctx: { parentKey?: string; isArrayItem?: boolean } = {}
  ) => {
    if (!def) return;
    const isMissing = value === undefined || value === null;

    // Leaf handling with PII transforms
    if (def._pii?.action === "encrypt") {
      if (!isMissing) out[key + "Encrypted"] = encryptFn(value);
      return;
    }
    if (def._pii?.action === "hash") {
      if (!isMissing) out[key + "Hash"] = hashFn(value);
      return;
    }
    if (def._pii?.action === "clear") {
      if (!isMissing) out[key] = null;
      return;
    }

    if (def.type === "object" && def._shape) {
      const obj: any = {};
      for (const [childKey, childDef] of Object.entries(def._shape)) {
        build(childDef, value?.[childKey], childKey, obj, { parentKey: key });
      }
      out[key] = obj;
      return;
    }

    if (def.type === "array" && def.itemType && Array.isArray(value)) {
      out[key] = value.map((item: any) => {
        const obj: any = {};
        // Use the array field name for primitive items; unwrap object items
        build(def.itemType, item, key, obj, {
          parentKey: key,
          isArrayItem: true,
        });
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          return obj[key];
        }
        return Object.keys(obj).length > 0 ? obj : item;
      });
      return;
    }

    if (def.type === "ref") {
      const ref: any = { ...value };
      const refShape = def._shape;
      if (refShape && value) {
        for (const [childKey, childDef] of Object.entries(refShape)) {
          build(childDef, value[childKey], childKey, ref, { parentKey: key });
        }
      }
      out[key] = ref;
      return;
    }

    out[key] = value;
  };

  const result: any = {};
  for (const key in shape) {
    build(shape[key], input?.[key], key, result);
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
  const readValue = (
    def: any,
    key: string,
    container: any,
    ctx: { parentKey?: string; isArrayItem?: boolean } = {}
  ): any => {
    if (!def) return container?.[key];
    const action = def._pii?.action;
    if (action === "encrypt") {
      const enc =
        container?.[key + "Encrypted"] ??
        container?.[`${ctx.parentKey ?? key}Encrypted`];
      return enc === undefined ? undefined : decryptFn(enc);
    }
    if (action === "hash") {
      const h =
        container?.[key + "Hash"] ?? container?.[`${ctx.parentKey ?? key}Hash`];
      return h === undefined ? undefined : h;
    }
    if (action === "clear")
      return container?.hasOwnProperty(key) ? null : undefined;

    if (def.type === "object" && def._shape) {
      const obj: any = {};
      const source =
        container && Object.prototype.hasOwnProperty.call(container, key)
          ? container[key]
          : container ?? {};
      for (const [childKey, childDef] of Object.entries(def._shape)) {
        obj[childKey] = readValue(childDef, childKey, source);
      }
      return obj;
    }

    if (def.type === "array" && def.itemType) {
      const arr = container?.[key];
      if (!Array.isArray(arr)) return arr;
      return arr.map((item: any) =>
        readValue(def.itemType, key, item, { parentKey: key, isArrayItem: true })
      );
    }

    if (def.type === "ref") {
      const ref = { ...(container?.[key] ?? {}) };
      const refShape = def._shape;
      if (refShape) {
        for (const [childKey, childDef] of Object.entries(refShape)) {
          ref[childKey] = readValue(childDef, childKey, ref);
        }
      }
      return ref;
    }

    return container?.[key];
  };

  const result: any = {};
  for (const key in shape) {
    result[key] = readValue(shape[key], key, stored);
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
  const visit = (
    def: any,
    value: any,
    ctx: { parentKey?: string } = {}
  ): any => {
    if (!def) return undefined;
    const handling = def._pii?.logHandling as PIILogHandling | undefined;
    if (handling === "omit") return undefined;
    if (handling === "redact") return "[REDACTED]";
    if (handling === "pseudonym") return pseudonymFn(value);

    if (def.type === "object" && def._shape) {
      const obj: any = {};
      const src = value ?? {};
      for (const [k, childDef] of Object.entries(def._shape)) {
        const child = visit(childDef, src[k], { parentKey: k });
        if (child !== undefined) obj[k] = child;
      }
      return obj;
    }

    if (def.type === "array" && def.itemType) {
      if (!Array.isArray(value)) return undefined;
      const arr = value
        .map((v: any) => visit(def.itemType, v, { parentKey: ctx.parentKey }))
        .filter((v) => v !== undefined);
      return arr;
    }

    if (def.type === "ref") {
      const ref: any = value ? { type: value.type, id: value.id } : {};
      const refShape = def._shape;
      const src = value ?? {};
      if (refShape) {
        for (const [k, childDef] of Object.entries(refShape)) {
          const child = visit(childDef, src[k]);
          if (child !== undefined) ref[k] = child;
        }
      } else if (value) {
        // no nested shape: keep original ref fields
        ref.type = value.type;
        ref.id = value.id;
      }
      return ref;
    }

    return value;
  };

  const output: any = {};
  for (const key in shape) {
    const child = visit(shape[key], data?.[key]);
    if (child !== undefined) output[key] = child;
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
  const result: any = Array.isArray(stored) ? [...stored] : { ...stored };

  const setAtPath = (target: any, path: Array<string | number>, val: any) => {
    let cur = target;
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i];
      if (p === undefined) return;
      if (cur[p] === undefined) {
        const next = path[i + 1];
        cur[p] = typeof next === "number" ? [] : {};
      }
      cur = cur[p];
    }
    const last = path[path.length - 1];
    if (last === undefined) return;
    cur[last] = val;
  };

  const visit = (
    def: any,
    host: any,
    path: Array<string | number>,
    keyName: string | number
  ) => {
    if (!def) return;

    const applyPath = (targetKey: string) => {
      const last = path[path.length - 1];
      if (last === undefined) return;
      if (typeof last === "number") {
        setAtPath(result, [...path, targetKey], null);
      } else {
        setAtPath(result, [...path.slice(0, -1), targetKey], null);
      }
    };

    if (def._pii?.action === "encrypt") {
      const targetKey = `${keyName}Encrypted`;
      if (host && Object.prototype.hasOwnProperty.call(host, targetKey)) {
        applyPath(targetKey);
      }
      return;
    }
    if (def._pii?.action === "hash") {
      const targetKey = `${keyName}Hash`;
      if (host && Object.prototype.hasOwnProperty.call(host, targetKey)) {
        applyPath(targetKey);
      }
      return;
    }
    if (def._pii?.action === "clear") {
      if (host && Object.prototype.hasOwnProperty.call(host, keyName)) {
        setAtPath(result, path, null);
      }
      return;
    }

    if (def.type === "object" && def._shape) {
      const obj =
        host && Object.prototype.hasOwnProperty.call(host, keyName)
          ? host[keyName]
          : host;
      for (const [k, childDef] of Object.entries(def._shape)) {
        visit(childDef, obj, [...path, k], k);
      }
      return;
    }

    if (def.type === "array" && def.itemType) {
      const arr = host?.[keyName];
      if (Array.isArray(arr)) {
        arr.forEach((item, idx) =>
          visit(def.itemType, item, [...path, idx], keyName)
        );
      }
      return;
    }

    if (def.type === "ref") {
      const refShape = def._shape;
      const ref = host?.[keyName];
      if (refShape && ref) {
        for (const [k, childDef] of Object.entries(refShape)) {
          visit(childDef, ref, [...path, k], k);
        }
      }
    }
  };

  for (const key in shape) {
    visit(shape[key], stored, [key], key);
  }

  return result;
}
