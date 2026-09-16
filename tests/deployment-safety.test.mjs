import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createHash } from 'node:crypto';

const root = join(import.meta.dirname, '..');
const script = (name) => join(root, 'scripts', name);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const makeRegistry = (sha256 = digest('artifact'), mount = '/app/') => ({ apps: [{ id: 'app', repo: 'owner/repo', mount, artifact: 'app.zip', sha256, enabled: true, version: 'v1.0.0', hashed_assets: false, require_index: true }] });
const run = (name, env) => spawnSync(process.execPath, [script(name)], { env: { ...process.env, ...env }, encoding: 'utf8' });

test('registry rejects latest and duplicate mount', () => {
  const dir = mkdtempSync(join(tmpdir(), 'portal-registry-'));
  try {
    const registry = { apps: [
      { ...makeRegistry().apps[0], version: 'latest' },
      { ...makeRegistry().apps[0], id: 'second' },
    ] };
    const file = join(dir, 'registry.json');
    writeFileSync(file, JSON.stringify(registry));
    const result = run('validate-registry.mjs', { PORTAL_REGISTRY_PATH: file });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /immutable release tag|Duplicate mount/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('artifact SHA-256 verification accepts matching and rejects missing or stale cache', () => {
  const dir = mkdtempSync(join(tmpdir(), 'portal-artifact-'));
  try {
    const artifacts = join(dir, 'artifacts'); mkdirSync(artifacts);
    const registry = join(dir, 'registry.json');
    writeFileSync(registry, JSON.stringify(makeRegistry()));
    writeFileSync(join(artifacts, 'app.zip'), 'artifact');
    assert.equal(run('verify-artifacts.mjs', { PORTAL_REGISTRY_PATH: registry, PORTAL_ARTIFACTS_DIR: artifacts }).status, 0);
    writeFileSync(join(artifacts, 'app.zip'), 'stale artifact');
    assert.notEqual(run('verify-artifacts.mjs', { PORTAL_REGISTRY_PATH: registry, PORTAL_ARTIFACTS_DIR: artifacts }).status, 0);
    rmSync(join(artifacts, 'app.zip'));
    assert.notEqual(run('verify-artifacts.mjs', { PORTAL_REGISTRY_PATH: registry, PORTAL_ARTIFACTS_DIR: artifacts }).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('full build validation rejects a missing mount', () => {
  const dir = mkdtempSync(join(tmpdir(), 'portal-build-'));
  try {
    const registry = join(dir, 'registry.json'); writeFileSync(registry, JSON.stringify(makeRegistry()));
    const build = join(dir, 'build'); mkdirSync(build); writeFileSync(join(build, 'index.html'), '<html></html>');
    assert.notEqual(run('validate-build.mjs', { PORTAL_REGISTRY_PATH: registry, PORTAL_BUILD_DIR: build }).status, 0);
    mkdirSync(join(build, 'app')); writeFileSync(join(build, 'app', 'index.html'), '<html></html>');
    assert.equal(run('validate-build.mjs', { PORTAL_REGISTRY_PATH: registry, PORTAL_BUILD_DIR: build }).status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
