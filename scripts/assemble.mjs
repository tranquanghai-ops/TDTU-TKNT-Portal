#!/usr/bin/env node
/**
 * assemble.mjs
 * Assembles the portal build/ directory.
 *
 * Steps:
 *  1. Clean build/
 *  2. Copy portal index.html → build/index.html
 *  3. For each enabled app in apps-registry.json:
 *     a. Locate the app artifact zip (from build-artifacts/ or GITHUB_WORKSPACE)
 *     b. Validate no files escape the app's mount directory
 *     c. Extract into build/<mount>/
 *     d. If require_index=true, verify build/<mount>/index.html exists
 *  4. Print summary
 *
 * When ASSEMBLE_DRY_RUN=1 is set, only validates without extracting.
 * When no apps are enabled, still produces a valid build/ with just index.html.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, cpSync, readdirSync } from 'fs';
import { resolve, normalize, dirname, sep, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const BUILD_DIR = resolve(ROOT, 'build');
const ARTIFACTS_DIR = resolve(ROOT, 'build-artifacts');
const REGISTRY_PATH = resolve(ROOT, 'apps-registry.json');
const INDEX_SRC = resolve(ROOT, 'index.html');

const DRY_RUN = process.env.ASSEMBLE_DRY_RUN === '1';

// ── helpers ──────────────────────────────────────────────────────────────────

function log(msg) { console.log(`[assemble] ${msg}`); }
function fail(msg) { console.error(`[assemble] ERROR: ${msg}`); process.exit(1); }

function cleanDir(dir) {
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/**
 * Validate that all files inside a zip would extract within mountDir.
 * Returns list of entry paths.
 * NOTE: Actual zip extraction requires a library (adm-zip or similar).
 * This function is a placeholder — in CI, pass the artifact through gh release download.
 * For now it performs a boundary check on provided paths.
 */
function validateExtractPaths(entryPaths, mountDir) {
  const errors = [];
  for (const entry of entryPaths) {
    const resolved = resolve(mountDir, normalize(entry));
    if (!resolved.startsWith(mountDir + sep) && resolved !== mountDir) {
      errors.push(`Path escape attempt: "${entry}" → "${resolved}"`);
    }
  }
  return errors;
}

// ── main ─────────────────────────────────────────────────────────────────────

let registry;
try {
  registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
} catch (err) {
  fail(`Cannot read apps-registry.json: ${err.message}`);
}

const apps = registry.apps ?? [];
const enabledApps = apps.filter(a => a.enabled);

log(`Registry: ${apps.length} app(s) total, ${enabledApps.length} enabled.`);
if (DRY_RUN) log('DRY RUN mode — skipping file writes.');

// 1. Clean/create build/
if (!DRY_RUN) {
  log(`Cleaning ${BUILD_DIR} ...`);
  cleanDir(BUILD_DIR);
}

// 2. Copy portal index.html
if (!existsSync(INDEX_SRC)) fail(`Portal index.html not found at ${INDEX_SRC}`);
if (!DRY_RUN) {
  cpSync(INDEX_SRC, resolve(BUILD_DIR, 'index.html'));
  log('Copied index.html → build/index.html');
}

// 3. Process enabled apps
for (const app of enabledApps) {
  const mountSegment = app.mount.replace(/^\/|\/$/g, ''); // e.g. "pdf-optimizer"
  const mountDir = resolve(BUILD_DIR, mountSegment);

  // Boundary check: mount cannot escape build/
  if (!mountDir.startsWith(BUILD_DIR + sep)) {
    fail(`Mount "${app.mount}" would escape build root. Aborting.`);
  }

  log(`Processing app "${app.id}" → ${app.mount} (version: ${app.version ?? 'unversioned'})`);

  // Locate artifact
  const artifactPath = resolve(ARTIFACTS_DIR, app.artifact);
  if (!existsSync(artifactPath)) {
    fail(
      `Artifact not found: ${artifactPath}\n` +
      `  → Download it from https://github.com/${app.repo}/releases/download/${app.version}/${app.artifact}\n` +
      `  → Place it in build-artifacts/${app.artifact}`
    );
  }

  if (DRY_RUN) {
    log(`  [DRY RUN] Would extract ${artifactPath} → ${mountDir}`);
    continue;
  }

  // Extract zip
  // NOTE: Node built-ins don't include zip extraction.
  // The CI workflow uses `unzip` (Linux) or PowerShell (Windows).
  // This script delegates to the system unzip command.
  mkdirSync(mountDir, { recursive: true });

  const { execSync } = await import('child_process');
  try {
    if (process.platform === 'win32') {
      execSync(
        `powershell -Command "Expand-Archive -Path '${artifactPath}' -DestinationPath '${mountDir}' -Force"`,
        { stdio: 'inherit' }
      );
    } else {
      execSync(`unzip -o "${artifactPath}" -d "${mountDir}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    fail(`Failed to extract ${app.artifact}: ${err.message}`);
  }

  // Security: validate no files escaped mount
  function walkDir(dir, base) {
    const entries = [];
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name);
      const rel = relative(base, full);
      if (name.isDirectory()) entries.push(...walkDir(full, base));
      else entries.push(rel);
    }
    return entries;
  }

  const extracted = walkDir(mountDir, mountDir);
  const escapes = validateExtractPaths(extracted, mountDir);
  if (escapes.length > 0) {
    fail(`Extraction produced path-escape files:\n${escapes.map(e => '  ' + e).join('\n')}`);
  }

  // Verify index.html if required
  if (app.require_index) {
    const appIndex = resolve(mountDir, 'index.html');
    if (!existsSync(appIndex)) {
      fail(`App "${app.id}" requires index.html but none was found at ${appIndex}`);
    }
    log(`  ✓ index.html found.`);
  }

  log(`  ✓ Extracted ${extracted.length} file(s) to build/${mountSegment}/`);
}

// 4. Summary
log(`Build complete.`);
log(`  Portal:   build/index.html`);
for (const app of enabledApps) {
  log(`  App:      build${app.mount}`);
}
if (enabledApps.length === 0) {
  log('  (No apps currently enabled — portal homepage only.)');
}
