# Releasing the Extension ZIP

This repo publishes installable artifacts to GitHub Releases:
- `totem-v<version>.zip` (extension)
- `totem-website-v<version>.zip` (website/demo, optional)

## Fast path (recommended)

Use one command:

```bash
pnpm release
```

This command will:
- run release preparation (version bump + changelog update + extension ZIP build validation)
- commit `CHANGELOG.md`, `package.json`, and `public/manifest.json`
- push `main`
- create `v<version>` tag
- push the tag (which triggers GitHub release workflow)
- by default, create extension ZIP only

Requirements:
- run from `main`
- clean working tree

Preview without writing/committing/tagging:

```bash
pnpm release --dry-run --allow-dirty
```

Version bump options:
- default (`pnpm release`) = `patch`
- `pnpm release minor`
- `pnpm release major`
- `pnpm release 1.2.3` (explicit version)

To include the website artifact in release prep:

```bash
pnpm release --with-website
```

(This creates `release/totem-website-v<version>.zip` in addition to the extension ZIP during the pre-release step.)

## Versioning model

- `patch` for bug fixes (`1.0.0 -> 1.0.1`)
- `minor` for new backward-compatible features (`1.0.0 -> 1.1.0`)
- `major` for breaking changes (`1.0.0 -> 2.0.0`)

## One-time release prep command

Run one command to:
- bump version in `package.json` and `public/manifest.json`
- generate/update the top entry in `CHANGELOG.md`
- build and package `release/totem-v<version>.zip` (extension)

To include website/demo packaging too:

```bash
pnpm release:prepare patch --with-website
```

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

## Standalone packaging commands

```bash
pnpm package:extension
pnpm package:website
pnpm package:all
```

## Publish flow

After `pnpm release:prepare ...` succeeds:

```bash
git add CHANGELOG.md package.json public/manifest.json
git commit -m "chore(release): v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

You can use this manual flow if you do not want the all-in-one `pnpm release ...` command.

Tag push triggers `.github/workflows/release-extension.yml`, which:
- installs dependencies
- builds extension output in `dist/`
- packages ZIP from `dist/`
- can also package website output in `dist-website/` when workflow is manually dispatched with `with_website: true`
- validates tag version matches manifest version
- uploads ZIP to the GitHub Release asset list

## Validation commands

```bash
pnpm release:version:check
pnpm release:check
```

## End-user install (Developer mode)

1. Open the latest release page.
2. Download `totem-v<version>.zip` from the **Assets** section for browser extension install.
Do not download GitHub "Source code (zip)".
3. Unzip the asset.
4. Open `chrome://extensions`.
5. Enable **Developer mode**.
6. Click **Load unpacked** and select the unzipped folder.

Website/demo consumers can use:

```bash
totem-website-v<version>.zip
```

Unzip and deploy its contents to your static hosting target.
