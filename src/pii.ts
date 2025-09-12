export type PIIClassification = "none" | "low" | "high";

export type PIIAction = "encrypt" | "hash" | "clear" | "none";

export type PIILogHandling = "redact" | "omit" | "pseudonym" | "plain";

export interface PII {
  classification: PIIClassification;
  action: PIIAction;
  logHandling?: PIILogHandling; // How should this PII be handled in logs?
  purpose?: string; // optional, for audit: e.g. "user contact", "analytics"
}
