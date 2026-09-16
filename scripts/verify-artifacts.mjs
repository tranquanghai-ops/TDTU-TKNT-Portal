#!/usr/bin/env node
import { createHash } from 'crypto';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = process.env.PORTAL_REGISTRY_PATH
  ? resolve(process.env.PORTAL_REGISTRY_PATH)
  : resolve(root, 'apps-registry.json');
const artifactsDir = process.env.PORTAL_ARTIFACTS_DIR
  ? resolve(process.env.PORTAL_ARTIFACTS_DIR)
  : resolve(root, 'build-artifacts');

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const apps = registry.apps.filter((app) => app.enabled);

const hashFile = (file) => new Promise((resolveHash, reject) => {
  const hash = createHash('sha256');
  createReadStream(file)
    .on('error', reject)
    .on('data', (chunk) => hash.update(chunk))
    .on('end', () => resolveHash(hash.digest('hex')));
});

let failed = false;
for (const app of apps) {
  const artifactPath = resolve(artifactsDir, app.artifact);
  if (!existsSync(artifactPath)) {
    console.error(`[verify-artifacts] ERROR: ${app.id}: missing ${artifactPath}`);
    failed = true;
    continue;
  }
  const actual = await hashFile(artifactPath);
  if (actual.toLowerCase() !== app.sha256.toLowerCase()) {
    console.error(`[verify-artifacts] ERROR: ${app.id}: SHA-256 mismatch for ${app.artifact}\n  expected ${app.sha256}\n  actual   ${actual}`);
    failed = true;
    continue;
  }
  console.log(`[verify-artifacts] OK: ${app.id} ${app.version} (${actual})`);
}

if (failed) process.exit(1);
