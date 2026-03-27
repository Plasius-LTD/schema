export interface ValidationIssueInput {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type FieldValidatorResult =
  | boolean
  | string
  | ValidationIssueInput
  | ValidationIssueInput[];

export type FieldValidator<T = unknown> = {
  bivarianceHack(value: T): FieldValidatorResult;
}["bivarianceHack"];
