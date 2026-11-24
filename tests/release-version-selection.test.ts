import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { execFileSync } from 'node:child_process';

const workflow = readFileSync(new URL('../.github/workflows/release-prepare.yml', import.meta.url), 'utf8');
const selection = workflow.slice(workflow.indexOf('          CURRENT_TAG="'), workflow.indexOf('          TAG="${TAG_PREFIX}${TARGET_VER}"')).replace(/^ {10}/gm, '');

function selectVersion(tag: 'absent' | 'current' | 'older', bump = 'patch'): string {
  const root = mkdtempSync(join(tmpdir(), 'schema-release-selection-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  try {
    git('init', '-q');
    git('-c', 'user.name=Release fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'old source');
    if (tag === 'older') git('tag', 'v0.1.0');
    git('-c', 'user.name=Release fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'current source');
    if (tag === 'current') git('tag', 'v0.1.0');
    const bin = join(root, 'bin'); mkdirSync(bin);
    writeFileSync(join(bin, 'npm'), '#!/bin/sh\ncase "$1" in view) exit 1;; version) exit 0;; *) exit 2;; esac\n', { mode: 0o755 });
    writeFileSync(join(bin, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    writeFileSync(join(root, 'CHANGELOG.md'), '## [Unreleased]\n\n- Security maintenance.\n\n## [0.1.0]\n\n- Initial release.\n');
    return execFileSync('bash', ['-euc', `${selection}\nprintf '\\nSELECTED=%s\\n' "$TARGET_VER"`], {
      cwd: root,
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, TAG_PREFIX: 'v', CURRENT_VER: '0.1.0', NAME: '@plasius/schema', BUMP: bump, FILE: 'CHANGELOG.md', REGISTRY_VER: '', TAG_VER: tag === 'absent' ? '' : '0.1.0', PREID: '', PACKAGE_DIRECTORY: '.' },
      encoding: 'utf8',
    }).match(/SELECTED=([^\n]+)/)?.[1] ?? '';
  } finally { rmSync(root, { recursive: true, force: true }); }
}

describe('release preparation uses immutable tag identity', () => {
  it('allocates a new patch when the incomplete version tag belongs to older source', () => {
    expect(selectVersion('older')).toBe('0.1.1');
  });
  it.each(['absent', 'current'] as const)('resumes an incomplete release when its tag is %s', tag => {
    expect(selectVersion(tag)).toBe('0.1.0');
  });
  it('preserves explicit no-bump selection for the publish-phase conflict guard', () => {
    expect(selectVersion('older', 'none')).toBe('0.1.0');
  });
});
