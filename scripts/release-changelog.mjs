import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const categoryNames = "Added|Changed|Deprecated|Removed|Fixed|Security";
const category = new RegExp(
  String.raw`^(?:###[ \t]+(?:${categoryNames})|-[ \t]+\*\*(?:${categoryNames})\*\*)[ \t]*\r?$`,
  "gmu"
);
const releaseReference = /^\[(?:Unreleased|\d[\w.+-]*)\]:[ \t]/mu;

function section(changelog, matchesHeading) {
  const headings = Array.from(changelog.matchAll(/^##[ \t]+([^\r\n]+)(?:\r?\n|$)/gmu));
  const index = headings.findIndex((heading) => matchesHeading(heading[1].trim()));
  if (index < 0) return undefined;

  const start = headings[index].index + headings[index][0].length;
  const nextHeading = headings[index + 1]?.index ?? changelog.length;
  const contents = changelog.slice(start, nextHeading);
  const referenceStart = contents.search(releaseReference);
  const end = referenceStart < 0 ? nextHeading : start + referenceStart;
  return { start, end, notes: changelog.slice(start, end) };
}

function releaseSection(changelog, version) {
  const heading = `[${version}]`;
  return section(changelog, (value) => value === heading || value.startsWith(`${heading} - `));
}

function assertMeaningfulNotes(notes, error) {
  const parts = notes.split(category);
  const groups = parts.length > 1 ? parts.slice(1) : parts;
  if (!groups.every((group) => group.split(/\r?\n/u).some((line) => {
    const bullet = /^[ \t]*[-*+][ \t]+(.+?)\s*$/u.exec(line)?.[1].trim();
    return bullet && !/^\*\*[^*]+\*\*$/u.test(bullet) && !/^\(no notable changes\)$/iu.test(bullet);
  }))) {
    throw new Error(error);
  }
}

export function assertChangelog(changelog, version) {
  if (/\(placeholder\)/iu.test(changelog)) {
    throw new Error("CHANGELOG.md contains placeholder release-note text.");
  }
  if (version !== undefined) {
    const release = releaseSection(changelog, version);
    if (!release) throw new Error("CHANGELOG.md is missing the requested release section.");
    assertMeaningfulNotes(release.notes, "The requested release section must contain real notes.");
  }
}

export function promoteChangelog(changelog, { version, date, tag, repository }) {
  if (typeof version !== "string" || typeof date !== "string" ||
      typeof tag !== "string" || typeof repository !== "string" ||
      !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/u.test(version) ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(date) ||
      !/^[\w.+-]+$/u.test(tag) ||
      !/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
    throw new Error("Invalid changelog release metadata.");
  }
  assertChangelog(changelog);
  if (releaseSection(changelog, version)) {
    assertChangelog(changelog, version);
    return changelog;
  }

  const unreleased = section(changelog, (value) => value === "[Unreleased]" || value === "Unreleased");
  if (!unreleased) throw new Error("CHANGELOG.md is missing its Unreleased section.");
  assertMeaningfulNotes(unreleased.notes, "Add real notes under Unreleased and remove empty categories before preparing a release.");

  const eol = changelog.includes("\r\n") ? "\r\n" : "\n";
  const notes = unreleased.notes.replace(/^(?:[ \t]*\r?\n)+|(?:\r?\n[ \t]*)+$/gu, "");
  const release = [`## [${version}] - ${date}`, "", notes, "", ""].join(eol);
  let result = changelog.slice(0, unreleased.start) + eol + release + changelog.slice(unreleased.end);
  const base = `https://github.com/${repository}`;
  const compare = `[Unreleased]: ${base}/compare/${tag}...HEAD`;
  const compareReference = /^\[Unreleased\]:[^\r\n]*/mu;
  if (compareReference.test(result)) {
    result = result.replace(compareReference, compare);
  } else {
    result = result.trimEnd() + eol + eol + compare + eol;
  }

  if (!result.split(/\r?\n/u).some((line) => line.startsWith(`[${version}]:`))) {
    result = result.trimEnd() + eol + `[${version}]: ${base}/releases/tag/${tag}` + eol;
  }
  return result;
}

export function runChangelogCommand([mode, file, version, date, tag, repository]) {
  if (!file || (mode !== "check" && mode !== "prepare")) {
    throw new Error("Use check FILE [VERSION] or prepare FILE VERSION DATE TAG REPOSITORY.");
  }
  const contents = readFileSync(file, "utf8");
  if (mode === "check") {
    assertChangelog(contents, version);
  } else {
    const updated = promoteChangelog(contents, { version, date, tag, repository });
    if (updated !== contents) writeFileSync(file, updated, "utf8");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runChangelogCommand(process.argv.slice(2));
  } catch (error) {
    // A content or I/O error must not echo changelog text or filesystem paths.
    console.error(error.code ? "Unable to read or write the release changelog." : error.message);
    process.exitCode = 1;
  }
}
