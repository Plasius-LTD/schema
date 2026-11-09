import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("tracked release notes", () => {
  it("contains no placeholder notes in the public changelog", () => {
    const changelog = readFileSync(new URL("../CHANGELOG.md", import.meta.url), "utf8");
    expect(/\(placeholder\)/iu.test(changelog)).toBe(false);
  });

  it("does not seed placeholder notes during release preparation", () => {
    const workflow = readFileSync(new URL("../.github/workflows/release-prepare.yml", import.meta.url), "utf8");
    expect(/\(placeholder\)/iu.test(workflow)).toBe(false);
  });
});

describe("release preparation", () => {
  const base = "https://github.com/example/schema";
  const metadata = {
    version: "1.2.0",
    date: "2026-11-09",
    tag: "v1.2.0",
    repository: "example/schema",
  };
  const history = "## [1.1.0] - 2026-10-23\n\n### Added\n\n- Existing API.\n\n";
  const reference = `[1.1.0]: ${base}/releases/tag/v1.1.0\n`;

  it("promotes notes once, keeps old releases intact and leaves Unreleased empty", async () => {
    const { assertChangelog, promoteChangelog } = await import("../scripts/release-changelog.mjs");
    const notes = "- **Fixed**\n  - Preserve published history.";
    const input = `# Changelog\n\n## [Unreleased]\n\n${notes}\n\n${history}` +
      `[Unreleased]: ${base}/compare/v1.1.0...HEAD\n${reference}`;
    const result = promoteChangelog(input, metadata);

    expect(result).toBe(
      `# Changelog\n\n## [Unreleased]\n\n## [1.2.0] - 2026-11-09\n\n${notes}\n\n${history}` +
      `[Unreleased]: ${base}/compare/v1.2.0...HEAD\n${reference}` +
      `[1.2.0]: ${base}/releases/tag/v1.2.0\n`
    );
    expect(() => assertChangelog(result, metadata.version)).not.toThrow();
    expect(promoteChangelog(result, metadata)).toBe(result);
  });

  it("handles a first release with standard headings and CRLF", async () => {
    const { promoteChangelog } = await import("../scripts/release-changelog.mjs");
    const notes = "### Added\r\n\r\n- First release.";
    const result = promoteChangelog(`## Unreleased\r\n\r\n${notes}\r\n`, metadata);
    expect(result).toBe(
      `## Unreleased\r\n\r\n## [1.2.0] - 2026-11-09\r\n\r\n${notes}\r\n\r\n` +
      `[Unreleased]: ${base}/compare/v1.2.0...HEAD\r\n` +
      `[1.2.0]: ${base}/releases/tag/v1.2.0\r\n`
    );
  });

  it.each(["", "- (no notable changes)", "- **Added**", "### Fixed\n- Real note.\n\n### Added"])(
    "refuses to promote empty or synthetic notes (%j)",
    async (notes) => {
      const { promoteChangelog } = await import("../scripts/release-changelog.mjs");
      expect(() => promoteChangelog(`## [Unreleased]\n\n${notes}\n`, metadata))
        .toThrow(/Add real notes/);
    }
  );

  it("rejects a placeholder in any section, including an already prepared release", async () => {
    const { assertChangelog, promoteChangelog } = await import("../scripts/release-changelog.mjs");
    const dirty = "## [Unreleased]\n\n## [1.2.0] - 2026-11-09\n\n- (PLACEHOLDER)\n";
    expect(() => assertChangelog(dirty)).toThrow(/placeholder/);
    expect(() => promoteChangelog(dirty, metadata)).toThrow(/placeholder/);
  });

  it("rejects invalid metadata, a missing Unreleased heading, and version prefix matches", async () => {
    const { assertChangelog, promoteChangelog } = await import("../scripts/release-changelog.mjs");
    expect(() => promoteChangelog(history, { ...metadata, repository: "bad repository" }))
      .toThrow(/Invalid changelog release metadata/);
    expect(() => promoteChangelog(history, metadata)).toThrow(/missing its Unreleased section/);
    expect(() => assertChangelog(history, "1.1")).toThrow(/missing the requested release section/);
    expect(() => assertChangelog("## [1.2.0]\n\n### Fixed\n", metadata.version)).toThrow(/real notes/);
  });

  it("checks and prepares a scratch changelog, leaving rejected input untouched", async () => {
    const { runChangelogCommand } = await import("../scripts/release-changelog.mjs");
    const dir = mkdtempSync(join(tmpdir(), "schema-changelog-"));
    try {
      const file = join(dir, "CHANGELOG.md");
      const dirty = "## [Unreleased]\n\n- (placeholder)\n";
      writeFileSync(file, dirty);
      expect(() => runChangelogCommand(["prepare", file, ...Object.values(metadata)])).toThrow(/placeholder/);
      expect(readFileSync(file, "utf8")).toBe(dirty);
      writeFileSync(file, "## [Unreleased]\n\n- Fix release notes.\n");
      runChangelogCommand(["prepare", file, ...Object.values(metadata)]);
      runChangelogCommand(["check", file, metadata.version]);
      const prepared = readFileSync(file, "utf8");
      runChangelogCommand(["prepare", file, ...Object.values(metadata)]);
      expect(readFileSync(file, "utf8")).toBe(prepared);
      expect(() => runChangelogCommand(["invalid", file])).toThrow(/Use check FILE/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
