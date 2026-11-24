import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** A deleted enrollment disables registration; never read symlinks or unbounded files. */
export function readFirstPublicationDescriptor(file = ".github/npm-first-publication.json") {
  const fd = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.size > 2048) throw new Error("Invalid first-publication enrollment.");
    return JSON.parse(readFileSync(fd, "utf8"));
  } finally { closeSync(fd); }
}

function validDescriptor(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === "packageName,repository,version"
    && [value.repository, value.packageName, value.version].every(field => typeof field === "string")
    && /^Plasius-LTD\/[a-z0-9][a-z0-9._-]{0,99}$/u.test(value.repository)
    && value.packageName === `@plasius/${value.repository.slice("Plasius-LTD/".length)}`
    && value.version.length <= 64
    && /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.test(value.version);
}

/** One confirmed anonymous 404 is required; auth/network failures never mean absence. */
export async function verifyFirstPublication(input, fetchRegistry = fetch) {
  const descriptor = input?.descriptor;
  if (
    !validDescriptor(descriptor)
    || input.repository !== descriptor.repository || input.packageName !== descriptor.packageName
    || input.version !== descriptor.version || input.optIn !== "true" || input.credentialPresent !== true
    || input.ref !== "refs/heads/main" || input.eventName !== "workflow_dispatch"
    || input.workflowRef !== `${input.repository}/.github/workflows/cd.yml@refs/heads/main`
    || !/^[0-9a-f]{40}$/u.test(input.expectedCommitSha ?? "")
    || input.checkedOutSha !== input.expectedCommitSha || input.workflowSha !== input.expectedCommitSha
  ) {
    throw new Error("First-publication admission requires exact enrollment and main CD identity.");
  }
  const response = await fetchRegistry(`https://registry.npmjs.org/${input.packageName.replace("/", "%2f")}`, {
    signal: AbortSignal.timeout(10_000), redirect: "error", headers: { accept: "application/json" },
  });
  if (response.status !== 404) {
    throw new Error("First publication requires a confirmed absent package; existing packages require OIDC.");
  }
}

/** Pass only credential presence to admission, and redact upstream/path error details. */
export async function runFirstPublication(env = process.env, {
  readDescriptor = readFirstPublicationDescriptor,
  verify = verifyFirstPublication,
  report = message => process.stderr.write(message),
} = {}) {
  try {
    await verify({
      descriptor: readDescriptor(),
      repository: env.GITHUB_REPOSITORY, packageName: env.PACKAGE_NAME, version: env.PACKAGE_VERSION,
      optIn: env.FIRST_PUBLICATION, credentialPresent: Boolean(env.NPM_TOKEN?.trim()),
      ref: env.GITHUB_REF, workflowRef: env.GITHUB_WORKFLOW_REF, eventName: env.GITHUB_EVENT_NAME,
      expectedCommitSha: env.EXPECTED_SHA, checkedOutSha: env.ACTUAL_SHA, workflowSha: env.GITHUB_SHA,
    });
    return 0;
  } catch {
    report("First-publication verification failed; check enrollment, exact main and registry absence.\n");
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runFirstPublication();
}
