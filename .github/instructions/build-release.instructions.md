---
description: "Use when modifying CI/CD workflows, release process, packaging, or AUR publishing. Covers build pipeline, versioning, and distribution for AniSocialDesktop."
applyTo: [".github/workflows/**", ".aur/**", "package.json"]
---
# Build & Release Workflow

## Build Pipeline

- TypeScript compiles first (`tsc`), then `electron-builder` packages the app
- Build scripts: `npm run build:linux`, `npm run build:win`, `npm run build:mac`
- Output goes to `release/` directory (not committed)
- Only `dist/**` (compiled JS) and `assets/**` are included in the packaged app

## Versioning & Release

- Version lives in `package.json` — CI syncs it from the git tag (`v*`) before building
- Tagging `v*` triggers `.github/workflows/release.yml`: builds on all 3 platforms, then creates a GitHub Release
- electron-builder auto-publishes update metadata (`.yml`, `.blockmap`) alongside release assets

## Linux Targets

- AppImage, deb, rpm, pacman, tar.gz
- Only AppImage supports auto-update; other formats get a manual update notification with a link to the releases page

## AUR Publishing

- PKGBUILD lives in `.aur/PKGBUILD`
- CI updates `pkgver`, `pkgrel`, and `sha256sums` in PKGBUILD via `sed` before publishing
- Package name on AUR: `anisocial-desktop-bin`
- Published via `KSXGitHub/github-actions-deploy-aur` action
- Two triggers: embedded in `release.yml` (on tag push) and standalone `aur-publish.yml` (on release published)

## electron-builder Config

- Defined inline in `package.json` under `"build"`
- `appId`: `de.anisocial.desktop`, `productName`: `AniSocial`
- GitHub publish provider configured for auto-update
