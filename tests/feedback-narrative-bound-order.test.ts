import { afterEach, describe, expect, it, vi } from "vitest";

const profileScan = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("Oversized text reached Unicode profile scanning.");
  }),
);

vi.mock("../src/feedback-unicode-profile.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/feedback-unicode-profile.js")>();
  return {
    ...actual,
    containsFeedbackUnicodeProfileUnsupportedText: profileScan,
  };
});

import { FeedbackRichTextAstSchema } from "../src/feedback.js";

describe("feedback narrative work ordering", () => {
  const originalNormalize = String.prototype.normalize;

  afterEach(() => {
    String.prototype.normalize = originalNormalize;
    profileScan.mockClear();
  });

  it("rejects an oversized leaf before profile scan or normalization", () => {
    const oversizedText = "x".repeat(1_000_000);
    const normalize = vi.fn(originalNormalize);
    String.prototype.normalize = normalize;

    const result = FeedbackRichTextAstSchema.validate({
      type: "doc",
      schemaVersion: "1",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: oversizedText }],
        },
      ],
    });

    expect(result.valid).toBe(false);
    expect(profileScan).not.toHaveBeenCalled();
    expect(normalize).not.toHaveBeenCalled();
  });
});
