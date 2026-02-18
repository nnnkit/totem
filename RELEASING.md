# Releasing the Extension ZIP

This repo publishes an installable extension ZIP to GitHub Releases.

## Versioning model

- `patch` for bug fixes (`1.0.0 -> 1.0.1`)
- `minor` for new backward-compatible features (`1.0.0 -> 1.1.0`)
- `major` for breaking changes (`1.0.0 -> 2.0.0`)

## One-time release prep command

Run one command to:
- bump version in `package.json` and `public/manifest.json`
- generate/update the top entry in `CHANGELOG.md`
- build and package `release/x-bookmarks-tab-v<version>.zip`

Run this after feature/fix commits are already committed to Git.

```bash
pnpm release:prepare patch
```

You can also pass `minor`, `major`, or an explicit version (`1.2.3`).

Preview without writing files:

```bash
pnpm release:prepare patch --dry-run
```

If your working tree is intentionally dirty during preview, add `--allow-dirty`.

## Publish flow

After `pnpm release:prepare ...` succeeds:

```bash
git add CHANGELOG.md package.json public/manifest.json
git commit -m "chore(release): v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

Tag push triggers `.github/workflows/release-extension.yml`, which:
- installs dependencies
- builds extension output in `dist/`
- packages ZIP from `dist/`
- validates tag version matches manifest version
- uploads ZIP to the GitHub Release asset list

## Validation commands

```bash
pnpm release:version:check
pnpm release:check
```

## End-user install (Developer mode)

1. Open the latest release page.
2. Download `x-bookmarks-tab-v<version>.zip` from the **Assets** section.
Do not download GitHub "Source code (zip)".
3. Unzip the asset.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the unzipped folder.
