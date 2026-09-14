#!/usr/bin/env node
/**
 * validate-registry.mjs
 * Validates apps-registry.json for structural and security issues.
 *
 * Rules enforced:
 *  - No duplicate app ids
 *  - No duplicate mount paths
 *  - mount cannot be "/"
 *  - mount must start and end with "/"
 *  - No ".." segments in mount or artifact
 *  - repo must match "owner/name" format (alphanumeric, hyphens, underscores, dots)
 *  - artifact must match a safe filename pattern (*.zip only)
 *  - hashed_assets and require_index must be boolean
 *  - enabled must be boolean
 *  - version must be null or a non-empty string
 *
 * Exit code 0 = valid. Exit code 1 = invalid.
 */

import { readFileSync } from 'fs';
import { resolve, normalize, sep } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, '..', 'apps-registry.json');

let registry;
try {
  registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
} catch (err) {
  console.error(`[validate] Cannot read apps-registry.json: ${err.message}`);
  process.exit(1);
}

const errors = [];
const apps = registry.apps;

if (!Array.isArray(apps)) {
  console.error('[validate] "apps" must be an array.');
  process.exit(1);
}

const seenIds = new Set();
const seenMounts = new Set();

// Fake build root for boundary checking
const fakeBuildRoot = resolve('/fake-build-root');

for (const [i, app] of apps.entries()) {
  const prefix = `apps[${i}] (id="${app.id ?? '<missing>'}"):`;

  // id
  if (typeof app.id !== 'string' || !app.id.trim()) {
    errors.push(`${prefix} "id" must be a non-empty string.`);
  } else if (!/^[a-z0-9-]+$/.test(app.id)) {
    errors.push(`${prefix} "id" must be lowercase alphanumeric with hyphens only.`);
  } else if (seenIds.has(app.id)) {
    errors.push(`${prefix} Duplicate app id "${app.id}".`);
  } else {
    seenIds.add(app.id);
  }

  // repo
  if (typeof app.repo !== 'string' || !app.repo.trim()) {
    errors.push(`${prefix} "repo" must be a non-empty string.`);
  } else if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(app.repo)) {
    errors.push(`${prefix} "repo" must be in "owner/name" format (alphanumeric, hyphens, underscores, dots). Got: "${app.repo}".`);
  }

  // mount
  if (typeof app.mount !== 'string' || !app.mount.trim()) {
    errors.push(`${prefix} "mount" must be a non-empty string.`);
  } else {
    if (app.mount === '/') {
      errors.push(`${prefix} "mount" cannot be "/".`);
    }
    if (!app.mount.startsWith('/') || !app.mount.endsWith('/')) {
      errors.push(`${prefix} "mount" must start and end with "/". Got: "${app.mount}".`);
    }
    if (app.mount.includes('..')) {
      errors.push(`${prefix} "mount" must not contain "..". Got: "${app.mount}".`);
    }
    if (seenMounts.has(app.mount)) {
      errors.push(`${prefix} Duplicate mount path "${app.mount}".`);
    } else if (app.mount && app.mount !== '/') {
      seenMounts.add(app.mount);
    }

    // Boundary check: mount cannot escape the build root
    const mountResolved = resolve(fakeBuildRoot, '.' + app.mount);
    if (!mountResolved.startsWith(fakeBuildRoot + sep) && mountResolved !== fakeBuildRoot) {
      errors.push(`${prefix} "mount" would escape the build root. Got: "${app.mount}".`);
    }

    // Mount cannot start with another mount (prevent one app overwriting another's subtree)
    for (const other of seenMounts) {
      if (other !== app.mount && (app.mount.startsWith(other) || other.startsWith(app.mount))) {
        errors.push(`${prefix} "mount" "${app.mount}" overlaps with existing mount "${other}".`);
      }
    }
  }

  // artifact
  if (typeof app.artifact !== 'string' || !app.artifact.trim()) {
    errors.push(`${prefix} "artifact" must be a non-empty string.`);
  } else {
    if (app.artifact.includes('..')) {
      errors.push(`${prefix} "artifact" must not contain "..". Got: "${app.artifact}".`);
    }
    if (!/^[A-Za-z0-9._-]+\.zip$/.test(app.artifact)) {
      errors.push(`${prefix} "artifact" must be a safe .zip filename (alphanumeric, dots, hyphens, underscores). Got: "${app.artifact}".`);
    }
  }

  // enabled
  if (typeof app.enabled !== 'boolean') {
    errors.push(`${prefix} "enabled" must be a boolean.`);
  }

  // version
  if (app.version !== null && (typeof app.version !== 'string' || !app.version.trim())) {
    errors.push(`${prefix} "version" must be null or a non-empty string.`);
  }

  // hashed_assets
  if (typeof app.hashed_assets !== 'boolean') {
    errors.push(`${prefix} "hashed_assets" must be a boolean.`);
  }

  // require_index
  if (typeof app.require_index !== 'boolean') {
    errors.push(`${prefix} "require_index" must be a boolean.`);
  }
}

if (errors.length > 0) {
  console.error('[validate] Registry validation FAILED:\n');
  for (const err of errors) {
    console.error('  ✗', err);
  }
  process.exit(1);
}

console.log(`[validate] OK — ${apps.length} app(s) registered, ${[...seenIds].filter(id => apps.find(a => a.id === id)?.enabled).length} enabled.`);
process.exit(0);
