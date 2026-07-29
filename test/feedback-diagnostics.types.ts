import {
  validateFeedbackGameDiagnostics,
  type FeedbackGameDiagnostics,
} from "../src/feedback.js";

type Assert<Condition extends true> = Condition;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type GeneratorDiagnostics = Extract<
  FeedbackGameDiagnostics,
  { surfaceId: "site.generator" }
>;

type GpuDemoDiagnostics = Extract<
  FeedbackGameDiagnostics,
  { surfaceId: "site.gpu-demo" }
>;

type InvalidGeneratorProvenance = Omit<
  GeneratorDiagnostics,
  "provenanceContractId"
> & {
  provenanceContractId: "gpu-demo.renderer-diagnostics.v1";
};

export type FeedbackDiagnosticsTypeContract = [
  Assert<
    Equal<
      GeneratorDiagnostics["provenanceContractId"],
      "generator.renderer-diagnostics.v1"
    >
  >,
  Assert<
    Equal<
      GpuDemoDiagnostics["provenanceContractId"],
      "gpu-demo.renderer-diagnostics.v1"
    >
  >,
  Assert<
    InvalidGeneratorProvenance extends FeedbackGameDiagnostics ? false : true
  >,
];

declare const unknownDiagnostics: unknown;
const validationResult = validateFeedbackGameDiagnostics(unknownDiagnostics);
if (validationResult.valid && validationResult.value !== undefined) {
  const correlatedDiagnostics: FeedbackGameDiagnostics =
    validationResult.value;
  void correlatedDiagnostics;
}
if (!validationResult.valid) {
  // @ts-expect-error invalid results never expose a trusted diagnostics value.
  const invalidDiagnostics: FeedbackGameDiagnostics = validationResult.value;
  void invalidDiagnostics;
}
