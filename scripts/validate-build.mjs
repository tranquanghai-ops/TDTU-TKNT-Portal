#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = process.env.PORTAL_REGISTRY_PATH
  ? resolve(process.env.PORTAL_REGISTRY_PATH)
  : resolve(root, 'apps-registry.json');
const buildDir = process.env.PORTAL_BUILD_DIR
  ? resolve(process.env.PORTAL_BUILD_DIR)
  : resolve(root, 'build');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const apps = registry.apps.filter((app) => app.enabled);
const errors = [];

if (!existsSync(resolve(buildDir, 'index.html'))) errors.push('Root Portal index.html is missing.');
else if (statSync(resolve(buildDir, 'index.html')).size === 0) errors.push('Root Portal index.html is empty.');

const expectedMounts = new Set(apps.map((app) => app.mount.replace(/^\/|\/$/g, '')));
for (const app of apps) {
  const segment = app.mount.replace(/^\/|\/$/g, '');
  const mountDir = resolve(buildDir, segment);
  if (!existsSync(mountDir) || !statSync(mountDir).isDirectory()) {
    errors.push(`${app.id}: mount ${app.mount} is missing.`);
    continue;
  }
  const files = readdirSync(mountDir, { recursive: true }).filter((entry) => {
    const path = resolve(mountDir, entry);
    return statSync(path).isFile() && statSync(path).size > 0;
  });
  if (files.length === 0) errors.push(`${app.id}: mount ${app.mount} has no non-empty files.`);
  if (app.require_index && !existsSync(resolve(mountDir, 'index.html'))) {
    errors.push(`${app.id}: mount ${app.mount} is missing index.html.`);
  }
}

for (const entry of readdirSync(buildDir, { withFileTypes: true })) {
  if (entry.isDirectory() && !expectedMounts.has(entry.name)) {
    errors.push(`Unexpected directory in build root: ${entry.name}`);
  }
}

if (errors.length) {
  console.error(`[validate-build] FAILED:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exit(1);
}
console.log(`[validate-build] OK — root Portal and ${apps.length} enabled mount(s) are complete.`);
