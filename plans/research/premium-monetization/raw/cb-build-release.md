# Build, Package & Chrome Web Store Release Pipeline — Premium/Licensing Implications

Scope: the exact build/package/release pipeline today, and what changes (build, secrets, manifest, CWS policy, artifact strategy) a Pro/license-check feature would require. Grounded entirely in current repo files. All paths relative to repo root `/Users/ankit/Documents/make/totem`.

---

## 1. How the extension is built and packaged today

### 1.1 The single artifact

There is exactly **one** shippable extension artifact: `release/totem-v<version>.zip`, produced from `dist/`. The `dist/` shape today (`dist/`):

```
dist/
  manifest.json            # byte-identical copy of public/manifest.json (verified via diff)
  service-worker.js        # ~48 KB IIFE bundle
  newtab.html, reader.html # entry HTML
  assets/
    main.js (~1 MB), main.css (~120 KB), index.js, open-in-totem.js
  content/
    detect-user.js, mutation-hook.js   # copied verbatim from public/content/
  icons/, wallpapers/, favicon*, rules.json
```

Key fact: `vite.config.ts` sets **no explicit `publicDir`**, so Vite uses its default (`public/`) and copies everything under `public/` into `dist/` unprocessed. That is why `dist/manifest.json`, `dist/rules.json`, and `dist/content/*.js` are byte-identical copies of the `public/` source — they are static assets, **not** build outputs. `service-worker.js` and `assets/main.js` etc. ARE build outputs (Rollup/Vite).

### 1.2 The build graph (`vite.config.ts`)

Three things are bundled in one `vite build`:
- **Main app** — `newtab.html` + `reader.html` as Rollup inputs → `assets/[name].js` (ES modules, `base: "./"` for relative paths inside the extension).
- **Service worker** — `serviceWorkerPlugin()` runs a *second* nested `viteBuild()` in `closeBundle()` that compiles `src/service-worker/index.ts` → `service-worker.js` as a single **IIFE** (MV3 service workers can't be ES modules unless `"type":"module"` is set in the manifest background block, which it is not — so IIFE is required).
- **Content script** — `contentScriptPlugin()` compiles `src/content/open-in-totem.ts` → `assets/open-in-totem.js` as IIFE. (The MAIN-world `mutation-hook.js` and `detect-user.js` are hand-written static files in `public/content/`, not part of the TS build.)
- **Version injection** — `define: { __TOTEM_APP_VERSION__: JSON.stringify(appVersion) }` reads `package.json.version` at config-eval time and inlines it as a global. Declared in `src/vite-env.d.ts`; consumed in `src/lib/export/quick-export.ts:35`. This is the existing precedent for compile-time constant injection — the same `define` mechanism is the cleanest place to inject a license public key (see §3).

### 1.3 The full pipeline, command by command

From `package.json` scripts:

```
pnpm build:extension   = pnpm typecheck && vite build      # tsc --noEmit, then build
pnpm package:extension = pnpm build:extension && node scripts/package-extension.mjs
```

`scripts/package-extension.mjs`:
1. Asserts `dist/` and `dist/manifest.json` exist (fails if you didn't build).
2. Reads `version` from `dist/manifest.json`.
3. `zip -r -q release/totem-v<version>.zip .` run with `cwd: dist` (shells out to the system `zip` binary — a host dependency, not a JS lib).

So the literal chain is: **typecheck → vite build → copy public/→dist/ → zip dist/ → release/totem-v<version>.zip**. Upload to CWS is **manual** (drag-zip into the developer dashboard) per `PUBLISH.md`; there is no automated CWS upload step. The GitHub release workflow only publishes the zip as a GitHub Release **asset**, not to the Web Store.

### 1.4 Release orchestration & versioning sync

Two-file version sync is enforced in three places:
- `scripts/check-version-sync.mjs` (`pnpm release:version:check`) — hard-fails if `package.json.version !== public/manifest.json.version`.
- `scripts/prepare-release.mjs` (`pnpm release:prepare`) — bumps **both** files together, regenerates `CHANGELOG.md` from filtered git subjects, then runs `release:version:check` + `package:extension`.
- `scripts/release.mjs` (`pnpm release` / `ship`) — guards (must be on `main`, clean tree), runs prepare, commits the 3 files, pushes `main`, creates+pushes `v<version>` tag.

The tag push triggers `.github/workflows/release-extension.yml`: install → `pnpm test:reliability` → `pnpm test` → `pnpm verify:workspace` → `pnpm release:check` (`release:version:check` + `package:extension`) → assert `tag == dist/manifest.json.version` → upload `release/*.zip` to the GitHub Release. CI (`ci.yml`) runs `pnpm ci:verify` = `test && build && verify:workspace && audit:prod` on every PR/push.

`scripts/verify-cws-featured-readiness.mjs` (`pnpm cws:featured:preflight`) is a strict gate that, among other things, **hard-pins the manifest**: it asserts the exact `permissions` array `[storage, webRequest, declarativeNetRequest, scripting, cookies]`, the exact `optional_permissions` `[topSites, favicon, search]`, and that `host_permissions` is **exactly** `["https://x.com/*"]` and length 1. **Any new permission or host added for licensing will fail this preflight until the script is updated** — this is the single most important repo-mechanical blocker to know about.

---

## 2. Manifest implications of adding payments/licensing

Current relevant manifest state (`public/manifest.json`):
- `permissions`: `storage, webRequest, declarativeNetRequest, scripting, cookies`
- `host_permissions`: `["https://x.com/*"]` only
- CSP (`content_security_policy.extension_pages`): `script-src 'self'; object-src 'self'; style-src 'self' https://fonts.googleapis.com 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.twimg.com; media-src 'self' https://*.twimg.com`

### 2.1 The MV3 "no remotely-hosted code" rule — the core constraint

Under MV3, **all executable code must ship inside the package**. License validation therefore must be a **pure data exchange**: the extension may `fetch()` JSON (a license token, an entitlement boolean, a signed receipt) from an endpoint, but it may **not** download and `eval`/inject any script, and it may **not** load a remote payment-provider SDK `<script>`. This rules out the common web pattern of dropping in `js.stripe.com/v3` or a Paddle/Lemon Squeezy overlay script. Two compliant shapes:

- **Recommended — no in-extension checkout.** Checkout happens on the web (a `usetotem.xyz/pro` page or the provider's hosted checkout, opened in a normal tab). The extension only ever does a `fetch()` to verify/retrieve an entitlement. The extension package contains zero payment SDK code. This keeps `script-src 'self'` untouched and is the cleanest MV3 posture.
- **Acceptable** — bundle a provider's *client* library into `assets/main.js` at build time (npm dependency, compiled by Vite) and call its REST API. Still data-only at runtime; still `script-src 'self'`.

`script-src` should stay `'self'`. **Do not** add any host to `script-src`.

### 2.2 What must change for an outbound license fetch

A license check that calls an external endpoint needs **two** manifest additions:

1. **`host_permissions`** — add the license/verify origin, e.g. `"https://api.usetotem.xyz/*"` (a tiny first-party verify endpoint) or the provider's API origin (e.g. `"https://api.lemonsqueezy.com/*"`). Without this, `fetch()` from the extension is blocked by host-permission policy. Prefer a **single, narrow, first-party** origin you control — it is far easier to justify to reviewers than a third-party payment API, and it lets you swap providers without a manifest change/re-review.

2. **CSP `connect-src`** — the extension's CSP currently has **no `connect-src` directive**, which means it inherits the default and outbound `fetch`/XHR is governed by host_permissions plus the default `connect-src`. To be explicit and safe, add a `connect-src` listing exactly the verify origin (and keep `'self'`), e.g.:
   ```
   connect-src 'self' https://api.usetotem.xyz;
   ```
   Note: today's `fetch` to `x.com` works because `https://x.com/*` is in `host_permissions` and there is no restrictive `connect-src`. Once you add an explicit `connect-src`, you must list **every** origin the extension talks to (x.com, twimg via img/media already covered, and the new verify origin), or you'll break existing network calls. Safest minimal change: add `host_permissions` entry + a `connect-src` that includes `'self'`, `https://x.com`, and the verify origin.

3. **`optional_host_permissions`** (strongly recommended posture) — instead of a static `host_permissions` grant, declare the verify origin under `optional_host_permissions` and request it at runtime only when the user actually upgrades. This keeps the default install footprint identical to today (helps CWS review and user trust), and means free users never grant a payment-related host. Trade-off: slightly more runtime code (`chrome.permissions.request`).

### 2.3 Permission additions to avoid

- **Do not** add `identity` / OAuth unless you truly need Google sign-in for accounts — it contradicts the "no account" ethos and adds review friction. A one-time license key (paste-a-key or deep-link redemption) avoids it entirely.
- **Do not** broaden to `<all_urls>` or wildcard hosts. The narrower the better; `verify-cws-featured-readiness.mjs` and the local-first story both depend on a tight host list.

---

## 3. Build-time secrets & env injection

### 3.1 Current state

There is **no `.env` anywhere** (confirmed: no `.env*` files outside node_modules), and `.gitignore` already ignores `*.local` and `dist`/`release`. The only compile-time constant today is `__TOTEM_APP_VERSION__`, injected via Vite `define`. `import.meta.env` is used only for `import.meta.env.DEV` test-guards (`src/api/core/posts.ts`). So there is currently **no env-injection plumbing** — it must be added.

### 3.2 What a license check needs at build time, and where it lives

Critical distinction for a one-time-license model:
- A **license-verification public key** (Ed25519/RSA public key used to verify a signed license token offline) is **public by design** — safe to commit and safe to inline. This is the recommended secret-free approach: the extension ships the public key, the server signs license tokens with the private key, the extension verifies signatures locally (it already depends on `@noble/hashes` 2.2.0, and `@noble/ed25519` would pair with it for offline verification). No runtime server round-trip needed after first redemption.
- A **provider publishable key** (e.g. a Stripe/Lemon Squeezy *publishable* key) is also non-secret and can be inlined, but is only relevant if checkout happens in-extension — which §2.1 recommends against.
- A **provider secret key / signing private key** must **NEVER** be in the extension build. The extension ships to users' machines; anything in `dist/` is fully readable. The private signing key lives only on the server / in CI secrets for the server, never in this repo's build.

### 3.3 How to inject it (matching existing patterns)

Two viable mechanisms, in order of preference:

1. **Vite `define`** (matches `__TOTEM_APP_VERSION__` exactly): add `__TOTEM_LICENSE_PUBLIC_KEY__: JSON.stringify(process.env.TOTEM_LICENSE_PUBLIC_KEY ?? <committed-default>)` in `vite.config.ts`, declare it in `src/vite-env.d.ts`. Because the key is public, the simplest correct choice is to **commit the public key as a constant** and skip env entirely — no secret-management surface, reproducible builds, and CI needs no new secrets.
2. **`import.meta.env` via `VITE_` prefix** — Vite auto-exposes `VITE_`-prefixed env vars to client code. Would require adding a `.env`/`.env.production` (gitignored) and a CI env var. Only worth it if the injected value is environment-specific (e.g. a staging vs prod verify URL).

**Must NOT be committed / must NOT enter `dist/`:** any private signing key, provider secret API key, webhook signing secret, or admin token. None of these belong in the extension build at all — they live in the (separate) license-server / payment-webhook deployment. If any per-build secret is ever introduced, add it to `.gitignore` (e.g. `.env.production`) and to GitHub Actions repo secrets for the build job; the current `release-extension.yml` passes no secrets to the build, so a secret would need an explicit `env:` block.

---

## 4. CWS review / policy friction a payment integration adds

The repo already has a heavy compliance apparatus (`PUBLISH.md`, `plans/chrome-web-store-listing.md`, `plans/chrome-web-store-dashboard-update-packet.md`, the featured-readiness verifier). Payments add the following on top:

1. **New permission justifications.** Each added permission/host needs a written justification in the CWS dashboard (the pattern is already established in `PUBLISH.md` lines 83–94). For a new verify host: *"Validates a one-time Pro license by fetching an entitlement token from our own endpoint; no browsing data is sent, only an opaque license key."* If using `optional_host_permissions`, note it is requested only at upgrade time.

2. **Single-purpose policy.** CWS requires one narrow purpose. Adding *payment/account* features risks a reviewer reading it as a second purpose. Mitigation: frame Pro as the **same** purpose (reading/searching/exporting your bookmarks) with more capability, not a new product. License redemption is configuration, not a separate feature surface.

3. **Privacy-practices disclosure update.** The dashboard "Privacy practices" tab (today certifies *no data sold, all local* — `PUBLISH.md` 97–104) must be updated: a license check transmits the **license key** (and possibly an extension-instance id) to your endpoint. You must (a) disclose this data flow, (b) keep the "no analytics/telemetry, no third-party tracking" claims true, (c) ensure the privacy policy at `usetotem.xyz/privacy/` (referenced by `verify-cws-featured-readiness.mjs`) is updated to describe license validation. The local-first claim in the store description (`"no Totem account, no server"`) becomes **literally false** the moment a verify endpoint exists — the listing copy and `manifest.description` (which the preflight pins to an exact string) must be reworded (e.g. "no account required; bookmarks stay on-device" rather than "no server").

4. **"Paid features must work" / no deceptive behavior.** CWS disallows charging for things that don't function and requires clear disclosure of paid features. The store listing should state Pro is a paid upgrade and what it unlocks.

5. **Remotely-hosted-code rejection risk.** If any payment-provider `<script>` or remote SDK is loaded, near-automatic rejection. Keep it data-only (§2.1).

6. **Pipeline additions required:**
   - Update `scripts/verify-cws-featured-readiness.mjs` to allow the new host/permission (otherwise `cws:featured:preflight` and the release flow that depends on a clean manifest will fail).
   - Update `PUBLISH.md` permission-justification list and the dashboard packet doc with the new entries.
   - Update the privacy policy page + the pinned `manifest.description` / listing copy.
   - Add a build-time check (optional but wise) asserting no secret-looking strings (private keys) leaked into `dist/` before zipping — a grep guard in `package-extension.mjs`.

---

## 5. One build (runtime-gated) vs separate Free/Pro builds — recommendation

### Recommendation: **ONE build, entitlement-gated at runtime.** Strongly.

Reasoning grounded in the current pipeline:

1. **The pipeline is architecturally single-artifact.** Versioning (`check-version-sync`, `prepare-release`), packaging (`package-extension.mjs` reads one `dist/manifest.json`, produces one `totem-v<version>.zip`), the release workflow (uploads `release/*.zip`, validates one tag↔manifest version), and the featured-readiness verifier (pins one manifest) all assume exactly one artifact. A second "Pro" build would mean forking version sync, doubling the zip step, duplicating the manifest pin, and managing two CWS listings (or a second hidden item) — a large pipeline rewrite for no user benefit.

2. **CWS distributes one item.** A free-on-store extension that unlocks Pro is the standard, frictionless model: one listing, one review, one ID (`acpkgdfhoaalmnhjifhneghcgfnjkglo`, pinned in the verifier). Separate builds imply either two store items (more review surface, confusing) or sideloaded Pro builds (kills the "install from the Web Store" UX and breaks auto-update).

3. **The gating surface already exists locally.** State lives in Zustand + `chrome.storage.local` and IndexedDB. An entitlement flag (`isPro`) fits naturally as another stored value, checked at the boundaries of the Pro features. The Pro-gated capabilities named in the goal are already discrete modules — export lives entirely in `src/lib/export/*` (e.g. `quick-export.ts`, `tweet-export.ts`, `stream-zip.ts`, `article-to-markdown.ts`), so gating is a small set of guard checks, not a build-time code split. There is no per-build code difference to justify two artifacts.

4. **No secret needs to differ per build.** Because license verification uses a **public** key (offline signature verification, §3.2), both free and pro users run identical code; the only difference is whether a valid signed license is present in storage. This is the cleanest possible separation: code is identical, entitlement is data.

5. **Optional-permission hygiene reinforces one build.** With `optional_host_permissions` for the verify origin (§2.2), the default install is byte-identical in footprint to today's free experience; the payment host is only requested when a user upgrades. One manifest, one build, graceful free path.

**Net:** ship one zip; add an `isPro` entitlement resolved from a locally-verified signed license; gate `src/lib/export/*` (and the other Pro modules) behind it; do not fork the build/release pipeline.

---

## Concrete change checklist (if/when implemented)

- `vite.config.ts`: add `__TOTEM_LICENSE_PUBLIC_KEY__` to `define` (or just commit a constant — key is public).
- `src/vite-env.d.ts`: declare the new global.
- `public/manifest.json`: add verify origin to `optional_host_permissions` (preferred) or `host_permissions`; add explicit `connect-src 'self' https://x.com https://api.usetotem.xyz` to the CSP; reword `description` away from "no server".
- `scripts/verify-cws-featured-readiness.mjs`: loosen the manifest pins to permit the new host/permission and the new description string.
- `PUBLISH.md` + `plans/chrome-web-store-dashboard-update-packet.md`: add permission justification + privacy disclosure for license validation.
- `usetotem.xyz/privacy/`: document the license-key data flow.
- `scripts/package-extension.mjs`: (optional) add a guard grepping `dist/` for private-key patterns before zipping.
- Dependency: add `@noble/ed25519` (pairs with existing `@noble/hashes`) for offline license-signature verification — no runtime server dependency after redemption.
