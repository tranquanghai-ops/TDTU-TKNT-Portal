#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const registryPath = resolve(root, 'apps-registry.json');
const write = process.argv.includes('--write');
const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
const summary = [];

function semver(tag) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(tag);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? '' };
}

function isNewer(candidate, current) {
  const left = semver(candidate);
  const right = semver(current);
  if (!left || !right) return false;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] > right[key];
  }
  return !left.prerelease && Boolean(right.prerelease);
}

for (const app of registry.apps.filter((entry) => entry.enabled)) {
  const response = await fetch(`https://api.github.com/repos/${app.repo}/releases?per_page=30`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'tdtu-tknt-portal-manifest-updater' },
  });
  if (!response.ok) throw new Error(`${app.id}: GitHub Releases API returned ${response.status}`);
  const releases = await response.json();
  const release = releases.find((entry) => !entry.draft && !entry.prerelease && isNewer(entry.tag_name, app.version));
  if (!release) {
    console.log(`[manifest-updater] ${app.id}: no newer stable release.`);
    continue;
  }
  const asset = release.assets.find((entry) => entry.name === app.artifact);
  if (!asset?.digest?.startsWith('sha256:')) {
    throw new Error(`${app.id}: release ${release.tag_name} has no SHA-256 digest for ${app.artifact}`);
  }
  const sha256 = asset.digest.slice('sha256:'.length).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error(`${app.id}: invalid release SHA-256 digest.`);
  summary.push(`- **${app.id}**: \`${app.version}\` → \`${release.tag_name}\`\n  - SHA-256: \`${app.sha256}\` → \`${sha256}\``);
  if (write) {
    app.version = release.tag_name;
    app.sha256 = sha256;
  }
}

if (!summary.length) {
  console.log('[manifest-updater] No manifest updates needed.');
  process.exit(0);
}

console.log('[manifest-updater] Proposed updates:\n' + summary.join('\n'));
if (write) {
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  writeFileSync(resolve(root, 'manifest-update-summary.md'), `## Immutable artifact updates\n\n${summary.join('\n')}\n\nAll artifacts remain independently owned by their app repositories. This PR does not deploy production.\n`);
}
