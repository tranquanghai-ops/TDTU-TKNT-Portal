# TDTU TKNT Portal

Central deployment repository for **https://tknt-tdtu.web.app** — the portal for the Interior Design program at Tôn Đức Thắng University.

> **Only this repository deploys to `tknt-tdtu.web.app`.**  
> App repositories remain independent and do NOT deploy to this site directly.

---

## Architecture

```
TDTU-TKNT-Portal (this repo)
├── index.html            ← Portal homepage
├── apps-registry.json    ← App manifest
├── firebase.json         ← Hosting config (source: build/)
├── package.json          ← Build scripts
├── scripts/
│   ├── validate-registry.mjs   ← Registry validator
│   └── assemble.mjs            ← Build assembler
├── .github/workflows/
│   ├── validate.yml            ← PR / push validation
│   ├── deploy-preview.yml      ← Future preview channel
│   └── deploy-production.yml   ← Production deploy (main only)
└── build/                      ← Generated, gitignored
    ├── index.html
    └── pdf-optimizer/          ← Mounted app (when enabled)
```

### App Repos (independent)

| Mount | Repository |
|-------|-----------|
| `/pdf-optimizer/` | [tranquanghai-ops/PDF-Optimizer-Resizer-Studio](https://github.com/tranquanghai-ops/PDF-Optimizer-Resizer-Studio) |

---

## Local Setup

```bash
# 1. Clone
git clone https://github.com/tranquanghai-ops/TDTU-TKNT-Portal.git
cd TDTU-TKNT-Portal

# 2. Copy local Firebase config
cp .firebaserc.example .firebaserc

# 3. Install deps (none yet, Node ≥ 18 required)
npm install

# 4. Validate registry
npm run validate

# 5. Build (assembles build/)
npm run build
```

---

## Enabling an App

1. Edit `apps-registry.json`:
   - Set `"enabled": true`
   - Set `"version"` to a GitHub release tag (e.g. `"v1.0.0"`)
2. Run `npm run build`
3. Preview locally or commit and push to trigger CI

---

## Deploying

Production deploy runs automatically from `main` via GitHub Actions once `FIREBASE_SERVICE_ACCOUNT_TKNT_TDTU` (or `FIREBASE_SERVICE_ACCOUNT_TDTU_TKNT`) secret is configured.

For manual deploy:
```bash
npm run deploy
```

---

## Adding a New App

1. Publish a release in the app's repository with a zip artifact
2. Add an entry to `apps-registry.json`:
```json
{
  "id": "my-app",
  "repo": "tranquanghai-ops/my-app-repo",
  "mount": "/my-app/",
  "artifact": "my-app.zip",
  "enabled": true,
  "version": "v1.0.0",
  "hashed_assets": false,
  "require_index": true
}
```
3. Run `npm run validate && npm run build`

### Rules
- `id` and `mount` must be unique
- `mount` cannot be `/`
- `mount` must start and end with `/`
- No `..` in mount or artifact names
- App files cannot escape their mount directory

---

## Caching Policy

| File type | Cache-Control |
|-----------|--------------|
| `*.html` | `no-store, max-age=0` |
| `*.js`, `*.css`, `*.json` (fixed name) | `no-cache, max-age=0, must-revalidate` |
| `*-[8+hex].js/.css` (hashed) | `public, max-age=31536000, immutable` |

> PDF Optimizer has `hashed_assets: false` — its assets use the revalidate rule.

---

## License

Content and tooling © Ngành Thiết kế Nội thất, Đại học Tôn Đức Thắng.  
Individual app licenses are governed by their respective repositories.
