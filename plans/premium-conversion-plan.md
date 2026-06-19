# Totem Premium Conversion Plan

> How to take Totem from free + open-source to a **freemium product with a $19 one-time "Pro" unlock** — without breaking the local-first / no-server / open-source ethos that *is* the brand.
>
> Grounded in: a 9-agent deep dive of the actual codebase + the 2026 payments/extension market. Raw research lives in [`plans/research/premium-monetization/raw/`](research/premium-monetization/raw/) (9 reports). Strategy/persona/pricing context: [`plans/gtm-research-report-2026-06-16.md`](gtm-research-report-2026-06-16.md).
>
> Date: 2026-06-19.

---

## 0. TL;DR — the four decisions

1. **Model:** Freemium, **one build, runtime-gated**. The free tier stays fully functional forever; Pro is a one-time lifetime unlock. This is the only model the pipeline (single artifact, single CWS listing) and the audience (subscription-averse, anti-DRM) actually support.
2. **The work is packaging, not building.** **5 of the 6 proposed Pro features already exist and ship for free today** — export, deleted-tweet preservation (the hydration engine), advanced search filters, annotations, thread-aware capture. Only **bulk ops** is net-new. The real engineering is a *single clean entitlement boundary*, not new features.
3. **Payments:** A **merchant-of-record** (Lemon Squeezy or Polar) for checkout so global VAT/tax is handled and there's no Totem billing server. Verify with **offline Ed25519-signed license keys** (`@noble/ed25519`, which pairs with the `@noble/hashes` already in the repo) → the extension makes **zero license network calls**, so "no server, works offline, nothing can shut down" stays literally true *once activated* (checkout itself still needs the MoR online — see §4.2 for the honest scope).
4. **The #1 risk is the retroactive paywall.** Totem is already free; bolting a paywall onto existing users generates 1-star reviews. **Grandfather every existing install** (full features, free, forever) and only ever gate *new* installs. This single move neutralizes the biggest execution risk.

The rest of this document is the file-by-file "how."

---

## 1. The premium model (and why this one)

### 1.1 Freemium, one-time lifetime — supported by both the code and the market

| Constraint | What it forces |
|---|---|
| Pipeline is single-artifact (one `dist/`, one zip, one CWS item, version-pinned) | **One build, entitlement-gated at runtime.** Not separate Free/Pro builds. |
| Audience = r/nosurf, r/selfhosted, HN, PKM (subscription-fatigued, anti-DRM, pro-ownership) | **One-time "lifetime" unlock**, Obsidian-Catalyst-style "fund the work," not a subscription. |
| Local-first, no server, no telemetry is the *entire* pitch | Verification must be **local/offline**; no per-launch phone-home. |
| Open-source (code is public on GitHub) | The check is **patchable by design** — accept it, out-serve the cracker, don't build DRM. |

**Market evidence (2026, first-party):** PaletteGrab got a **60% conversion lift** switching one-time vs monthly; MiroMiro got "5 paying customers in a row" after adding a lifetime option; the consensus is *"Chrome extensions aren't SaaS apps. They're tools. People prefer to buy tools once."* Subscriptions still win *high-revenue, server-cost* categories (SEO/dev-tools/AI at $5k–200k/mo) — but Totem is squarely a low-marginal-cost client utility, the bucket where one-time wins. Realistic conversion to model against: **1–3% of *active* users** (not installs), ~60–70% checkout completion.

### 1.2 Pricing

- **$19 one-time lifetime** (the GTM-validated number: above the $4.99 utility floor, below the $29 "enterprise-parity" expectation).
- **$14 founders price for the first 60 days** — framed honestly ("$14 founders price, rising to $19"), no fake countdowns.
- **Never** "2 years of updates." Use "lifetime," no expiry qualifier — the local-first architecture means it genuinely works forever.

---

## 2. Free vs Pro — the feature & limit matrix

The split is dictated by one hard rule from the research: **feature-gate genuinely-new value; never claw back a feature existing users already have free.** Because export/search/annotations *already ship free*, we combine three levers: **grandfathering** (existing users keep everything), a **free allowance** (new users try Pro on their own data), and **clean feature gates** for new value.

### 2.1 The matrix

| Capability | Free tier | Pro ($19) | Already built? | Gate location |
|---|---|---|---|---|
| New-tab reading queue / Today's Read | ✅ full | ✅ | yes | — (never gate) |
| Sync (GraphQL interception → IndexedDB) | ✅ full, no count cap | ✅ | yes | — |
| Reader (threads/articles) | ✅ full | ✅ | yes | — |
| Basic full-text search | ✅ full | ✅ | yes | — |
| Import (re-import a Totem ZIP) | ✅ full | ✅ | yes | — (keep free: data-portability = trust) |
| **Library export** (CSV/MD/JSONL ZIP) | ✅ **first ~25 items** (try-before-buy) | ✅ **unlimited, all formats** | yes (`quick-export.ts`) | `ExportModal.handleQuickExport` |
| **Per-article export** (Download MD / Print PDF) | Copy-to-clipboard free (teaser) | ✅ Download MD / PDF | yes (`article-download.ts`) | `ArticleExportMenu` handlers |
| **Deleted-tweet preservation** | ✅ preserves what you've already opened | ✅ **auto-preserves your whole library** + "kept your copy" badge | yes (`hydration-store.ts`) | `handleStartFullExport` / hydration `start()` |
| **Advanced search filters** (`from: site: min_faves: has: is:` …) | plain text only | ✅ operators | yes (`lib/search/parser.ts`) | `useBookmarkSearch` (gate parsed AST nodes) |
| **Annotations** (highlights + notes) | create basic highlights | ✅ notes + annotation **export** | yes (`SelectionToolbar`, `highlights` store) | `onHighlight`/`onAddNote` |
| **Bulk operations** (multi-select tag/delete/export) | — | ✅ | **NET-NEW** | new selection UI + dispatcher |
| Future: MCP endpoint, semantic search | — | ✅ | net-new (roadmap) | future modules |

### 2.2 The grandfather rule (non-negotiable, ship in the same release)

On the release that introduces Pro:
- `chrome.runtime.onInstalled` with `reason === "update"` (i.e., the user already had Totem) → stamp a **`grandfatheredAt`** entitlement: **full Pro features, free, forever.**
- `reason === "install"` (fresh) → free tier with the allowance/gates above.

**`onInstalled.reason` alone is not enough (adversarial-review correction).** It misfires for exactly the cohort grandfathering protects: a user who uninstalls→reinstalls, or moves to a new machine, fires `reason === "install"` and would lose grandfathered status. Add a **secondary "existing user" heuristic** that also runs on `install`: if the bookmarks IndexedDB store is non-empty (or a pre-Pro settings/growth-state key already exists locally), treat them as grandfathered. The local-data check is the dependable signal; don't *rely* on the `chrome.storage.sync` mirror having landed before the first gate evaluation. Net effect: the change is *additive* for everyone who already uses Totem (the people who evangelize it), and monetization is limited to genuinely new users — the low-backlash path the research demands.

### 2.3 Why these specific gates

- **Export** is the *primary* gate but **not a single call site** (adversarial-review correction). The bulk-ZIP path concentrates at one place (`ExportModal.tsx:64` → `runQuickExport(account)`), but there are **independent per-article egress paths** in `src/components/BookmarkReader.tsx:313-352` (copy-Markdown, copy-for-agent, download `.md`, print/Save-PDF) that bypass `ExportModal` entirely. **All of them must be gated**, or a free user has a full-library exfiltration path one article at a time. Decide deliberately whether *copy-to-clipboard* stays free as a teaser — it is a slow leak (copy each article manually); acceptable as a teaser, but call it knowingly. The PKM/Obsidian persona is the willing-to-pay cohort and export is their #1 need.
- **Deleted-tweet preservation** is the *emotional* gate (loss aversion): "This tweet was deleted on X. Totem kept your copy." It's already implemented as the hydration engine — it just isn't *sold* as a feature yet.
- **Bulk ops** is the only net-new build; it doubles as a fresh, obviously-new capability that nobody can claim was "taken away."

---

## 3. Tech stack — what's new

Totem stays exactly as it is (MV3, React 19, Zustand, IndexedDB/`idb`, Vite, Astro site). The premium layer adds a **small, deliberately boring** surface:

| Concern | Choice | Why |
|---|---|---|
| Checkout + tax | **Merchant-of-record: Lemon Squeezy** (primary) or **Polar** (cost-optimized) | MoR remits global VAT/GST → solo dev never registers for tax anywhere. No Totem billing server. |
| License issuance | **Keyforge** (turnkey, signs Ed25519/JWT, plugs into LS/Polar) **or** a tiny serverless Ed25519 signer fired by the MoR webhook | Produces an **offline-verifiable signed key**; private key never touches the extension. |
| License verification | **`@noble/ed25519`** in the service worker, public key embedded at build time | Pure local crypto. ~5KB, audited, pairs with the `@noble/hashes 2.2.0` already present. **No network, no new host permission.** |
| Entitlement storage | New SW-owned `chrome.storage.local` key `CS_ENTITLEMENT` | Single-writer, reset-surviving, rides the existing reactive snapshot channel. |
| Pricing/license pages | New static Astro pages on `usetotem.xyz` | Site is 100% static; pages are static + client `<script>`, no backend. |

**No new runtime dependency on a third-party server.** The MoR/signer is touched **only by the buyer's browser at checkout** — never by the extension. That's the whole point: it preserves the "no server" claim verbatim.

---

## 4. Payment gateway — the decision

### 4.1 The contenders (2026 facts)

| Option | Fee on a $19 sale | Merchant of Record? (tax handled) | License API | Fits local-first + OSS? |
|---|---|---|---|---|
| **Lemon Squeezy** | 5% + 50¢ (~$1.45) | ✅ yes | ✅ most mature (validate/activate/deactivate, key-only, cacheable) | ✅ (Stripe-acquisition transition is the one watch-item) |
| **Polar** | 5%+50¢ free / 3.8%+40¢ on Pro plan | ✅ yes | ✅ public validate endpoint, **safe for public clients** | ✅ cheapest, OSS-positioned; younger; online-only validate |
| **ExtensionPay** | 5% + Stripe 2.9%+30¢ (~8% all-in) | ❌ **no** (you owe tax) | email magic-link, **no key**; `getUser()` **phones home every check** | ❌ not MoR, hard runtime dependency on extensionpay.com |
| Raw Stripe | 2.9%+30¢ | ❌ no | build it yourself + server | ❌ defeats "minimal server / tax handled" |
| Gumroad | 10%+50¢ (~$2.40) | ✅ yes | ✅ verify API | ⚠️ highest fee, "creator marketplace" feel |

### 4.2 Recommendation

> **Lemon Squeezy as merchant-of-record (primary), Polar as the cost-optimized alternative — and issue offline-verifiable Ed25519 signed keys on top (via Keyforge or a tiny serverless signer).**

**Why MoR, not ExtPay:** ExtPay is the *fastest* to wire and the most extension-native, but it (a) is **not** a merchant of record, so you still owe VAT in every country, and (b) makes every paid check a live call to `extensionpay.com` — a third-party server in the trust chain of a product whose entire pitch is "no server." Both are brand-violating. The MoR removes the tax burden; the signed-key approach removes the runtime dependency.

**Why offline signed keys, not the MoR's online validate endpoint:** Polar/LS both *can* validate a key with no embedded secret (great for OSS), but that's an **online** check — every validation is a network event to a third party. For Totem specifically, the offline signed-key path is strictly more on-brand: the extension verifies a pasted key with an embedded **public** key and **never makes a license network call at all**. The marketing claim "no Totem account, no server, works offline" survives literally. The cost is one extra moving part at *issuance* time (Keyforge, or ~40 lines of serverless signing), which the buyer's browser hits during checkout — not the extension.

**Lower-effort fallback** (if you don't want to run/relay a signer for v1): use the MoR's **own license key + its validate endpoint**, called **once at activation**, then cache `isPro` in `chrome.storage.local` and run offline with an optional weekly fail-open re-check. This needs one host permission (the MoR API) and dents the "zero network" claim slightly, but ships faster. **You can launch on the fallback and migrate to signed keys later without changing the buyer's experience.**

**Honest scope of the "nothing can shut down" claim:** the offline-signed-key design means an *already-activated* user works forever with no network and no dependency on any vendor staying alive. It does **not** mean a *new buyer* is immune to outages — checkout needs the MoR online and issuance needs the signer online at purchase time. So phrase the brand promise precisely ("once activated, Totem Pro works forever, fully offline, even if we disappear"), not as an absolute. This matters given the Lemon-Squeezy→Stripe transition watch-item: the signed keys already sold keep working regardless of what happens to the MoR.

### 4.3 The honest stance (publish it — it converts for this audience)

Open-source + client-side means a determined user can patch out the check. **Don't fight it.** Ship this copy in the README and the upgrade screen:

> "Totem is open source. You *could* patch out the Pro check — the code is right there. We're not going to fight you with DRM that makes the app worse for everyone. Pro is $19 once; it funds the export, search, and deleted-tweet preservation work. If it's useful, buy it. If you genuinely can't, the free tier is fully functional forever."

For a $19 lifetime tool, the cracker's "service" (untrusted patched build, re-patch every update, no support) is worse than paying. For the privacy/HN/self-hosted audience, the *absence* of DRM is a trust signal, not a weakness. (Gabe Newell's "piracy is a service problem" — sourced in [`rs-license-arch.md`](research/premium-monetization/raw/rs-license-arch.md).)

---

## 5. License / entitlement architecture

### 5.1 End-to-end flow

```
1. PURCHASE   Buyer clicks "Upgrade — $19 lifetime" in the extension
              → opens usetotem.xyz/pricing → MoR hosted checkout
              (Lemon Squeezy / Polar = merchant of record; card + VAT handled)
                    │
2. ISSUE      On paid order, Keyforge / serverless signer produces an
              Ed25519-signed key:  base64(payload).base64(sig)
              payload = { v, email, plan:"pro-lifetime", order, exp:null, feat:[...] }
              Emailed to buyer + shown on usetotem.xyz/upgrade/success
                    │
3. ACTIVATE   Buyer returns to extension. Three layered paths:
              (a) one-click: success page → externally_connectable → onMessageExternal
              (b) deep link: chrome-extension://<id>/newtab.html?license=<key>
              (c) paste-a-key fallback in Settings (always shipped)
                    │
4. VERIFY     Service worker: ed.verify(sig, payload, EMBEDDED_PUBKEY) + exp check.
              Pure local crypto. Zero network. MV3-safe (no remote code).
                    │
5. PERSIST    SW writes CS_ENTITLEMENT to chrome.storage.local
              { isPro, plan, email, order, feat, verifiedAt } + raw key.
              Stamped into RuntimeSnapshot.
                    │
6. PROPAGATE  CS_RUNTIME_STATE_V2 change → chrome.storage.onChanged →
              applyRuntimeSnapshot → Zustand → useIsPro() → every open
              tab/reader flips to Pro on the same event-loop tick.
                    │
7. GATES      Export / preservation / bulk / filters / annotations read isPro.
              Re-verified from the stored key on each launch (offline, cheap).
```

### 5.2 Where the entitlement lives (resolving the storage tension)

The research surfaced two candidate patterns. **Use the SW-owned one as authoritative**; it's what makes payment "work flawlessly" across reset/account-switch and is reactive everywhere:

- **Authoritative:** SW writes **`CS_ENTITLEMENT`** (`"totem_entitlement"`) to `chrome.storage.local`, declared in `src/service-worker/storage-keys-sw.ts` → the existing `storage-invariants.test.ts` makes the SW the *only* writer for free. The SW is the right owner because it's the trust boundary and the thing that verifies the signature.
- **Reset-surviving:** keep `CS_ENTITLEMENT` **out of both reset lists** in `src/lib/reset.ts` (mirror how auth headers are deliberately preserved). "Reset app" and account-switching must never revoke a paid unlock — it's a **device-global, account-independent** fact, not a per-account one. **Never** store it in IndexedDB (account-scoped + wiped) or the per-account sync orchestrator map.
- **Reactive:** the `CS_RUNTIME_STATE_V2 → onChanged → applyRuntimeSnapshot` channel already exists and the propagation is **automatic**, but the snapshot is deserialized **field-by-field** (not spread), so `isPro` needs **~6 explicit wiring points** (minimal, but not "free"): add the field to `RuntimeSnapshotData` (`src/types/messages.ts`); populate in `buildRuntimeSnapshot` (`src/service-worker/auth.ts`); read it in `normalizeAuthPayloadFromSnapshot`; add it to the `AuthPayload` interface; set it in `applyAuthPayload`; expose `useIsPro()` in `src/stores/selectors.ts`. (Keep `applyRuntimeSnapshot`'s `allowHydration:false` guard; an `isPro` flip must never trigger a sync/re-hydration.)
- **Optional cross-device follow:** additionally mirror to a new `chrome.storage.sync` key (also SW-written, also off the reset list) so the unlock follows the user to a new machine without re-pasting. The local key stays authoritative.

> The simpler "clone `useTheme.ts` into `usePro.ts` over `chrome.storage.sync`" pattern (from the UI report) is a fine **MVP shortcut for the UI read**, but the *writer* must be the SW after verification — a bare synced boolean is trivially forgeable and is wiped on reset. Use the snapshot/`useIsPro()` read path, SW-owned write.

### 5.3 MV3 compliance (the load-bearing constraint)

MV3 bans **remotely-hosted code**, not remote **data**. Both valid here:
- **Pure local crypto** (verify a pasted signed key) → no network at all → trivially compliant. ✅
- **Data fetch** (call an MoR validate endpoint → receive JSON) → fetching *data*, explicitly allowed. ✅

What you must **never** do: fetch a JS "validator" or a script that *implements* a Pro feature and `eval`/import it. All Pro feature logic ships in the package and is merely *toggled* by `isPro`. (This is why "one build, runtime-gated" is also the compliant design.)

---

## 6. Internal system changes — file by file

This is the heart of "how the whole system changes." Nothing here is large; the architecture already has the seams.

### 6.1 New files

| File | Purpose | Clone from |
|---|---|---|
| `src/service-worker/entitlement.ts` | SW handlers: `ACTIVATE_LICENSE`, `VERIFY_LICENSE`, `GET_ENTITLEMENT`. Verifies Ed25519 sig, writes `CS_ENTITLEMENT`, re-persists snapshot. | sibling of `auth.ts`/`sync.ts` handler maps |
| `src/lib/license/verify.ts` | Pure `verifyLicense(key)` → entitlement \| null using `@noble/ed25519` + embedded pubkey. Unit-testable, no chrome APIs. | — |
| `src/hooks/usePro.ts` (or `useEntitlement.ts`) | UI read of `isPro` (prefer reading the `useIsPro()` selector; `useTheme.ts` shape if you keep a direct storage read). | `src/hooks/useTheme.ts` |
| `src/components/ProGate.tsx` | `<ProGate isPro onUpgrade>` + `requirePro(isPro, action, onUpsell)`. Renders children when Pro; lock-badge + intercept when free. | — |
| `src/components/UpgradeModal.tsx` | The single upsell surface (benefits list + `<Button href={CHECKOUT_URL}>` + paste-a-key field). | `src/components/OnboardingModal.tsx` |
| `src/components/ProNudge.tsx` | One-time, dismissible, post-activation bottom banner. Suppressed when `isPro`. | `src/components/ReviewPrompt.tsx` |

### 6.2 Edited files (extension)

| File | Change |
|---|---|
| `src/service-worker/storage-keys-sw.ts` | Add `CS_ENTITLEMENT = "totem_entitlement"`. **Also** add the constant + its string to the hardcoded `SW_OWNED_KEY_NAMES`/`SW_OWNED_KEY_STRINGS` arrays in `src/lib/__tests__/storage-invariants.test.ts:71-87` — declaring the key does **not** auto-enroll it in the single-writer enforcement. |
| `src/types/messages.ts` | Add `isPro`/`entitlement` to `RuntimeSnapshotData`; add `ACTIVATE_LICENSE`/`VERIFY_LICENSE`/`GET_ENTITLEMENT` to the `MessageRequest` union. |
| `src/service-worker/auth.ts` | `buildRuntimeSnapshot` reads `CS_ENTITLEMENT` → snapshot; `persistRuntimeStateV2` includes it with safe defaults. |
| `src/service-worker/index.ts` | Merge `entitlementHandlers`; add `onInstalled` grandfather stamp (`reason==="update"` → grandfathered Pro); optional `onMessageExternal` for site→extension one-click. |
| `src/stores/runtime-store.ts` | Add `isPro` to `RuntimeState` + `createInitialState`; set it in `applyAuthPayload`; read in `normalizeAuthPayloadFromSnapshot`. |
| `src/stores/selectors.ts` | Add `useIsPro()`. |
| `src/lib/storage-keys.ts` | (If using a sync mirror) add `SYNC_PRO` to `CHROME_SYNC_KEYS`. |
| `src/lib/reset.ts` | Keep `CS_ENTITLEMENT` (and `SYNC_PRO`) **out** of the reset key lists; add a comment next to the auth-preservation note. |
| `src/lib/growth-state.ts` | Add a `pro` namespace (`nudgePromptedAt`/`nudgeDismissedAt`) + `shouldShowProNudge()` predicate (set-once idiom). |
| `src/components/ExportModal.tsx` | Wrap `handleQuickExport` (`:60`) + `handleStartFullExport` (`:78`) in `requirePro`; pass `isPro` into `IdleView` for the free-allowance cap + lock styling. |
| `src/components/BookmarkReader.tsx:313-352` (handlers live here, **not** in `TweetContent.tsx`) | Gate the **four** per-article egress handlers — copy-MD (`:313`), copy-for-agent (`:327`), download-MD (`:338`), print/PDF (`:352`) — all call `src/lib/export/article-download.ts` directly. Keeping the two clipboard copies free is a *teaser* but also a slow full-library leak; gate download+print at minimum. |
| `src/hooks/useBookmarkSearch.ts` | When the parsed AST contains operator nodes and `!isPro` → route to upsell (keep plain text free). |
| `src/components/reader/SelectionToolbar.tsx` | Gate `onAddNote` (and/or advanced highlight) for free users. |
| `src/components/SettingsModal.tsx` | New "Totem Pro" section above Storage/Export (`:374`): free → "Upgrade" (`accent-soft` Button); Pro → `Badge variant="accent">PRO</Badge>` + "Manage license" + paste-key field. |
| `src/components/NewTabHome.tsx` | (Optional) small always-visible "Upgrade" entry beside the gear (`:1086`). |
| `src/App.tsx` | Call `usePro()` at `:410-411` (both route apps); add `upgradeOpen` to `NewTabRouteState`; render `<UpgradeModal>`/`<ProNudge>` beside `ExportModal`/`ImportModal` (`:708-732`); thread `isPro` down as a prop. |
| `src/lib/constants/growth.ts` | Add `PRICING_URL = https://usetotem.xyz/pricing?utm_source=extension&utm_medium=upgrade&utm_campaign=pro`. |

### 6.3 Deleted-tweet preservation — the one data-layer tweak

The hydration engine already classifies and caches deleted/protected tweets (`hydration-store.ts`, `detailsStatus:"unavailable"`, `unavailableReason:"deleted"`). To turn it into a *sellable preservation* feature, two small policy changes in `src/db/` + `src/api/parsers.ts`:
1. **Preserve-on-tombstone:** today the error path *throws before caching*, so the fix is an **added** cache-write on the unavailable branch (not merely a no-clobber guard): when a later `FETCH_TWEET_DETAIL` returns a tombstone, keep the previously-cached `focalTweet`/thread and stamp `detailsStatus:"unavailable"` rather than dropping the row or overwriting with null.
2. **Exempt preserved rows** from the `cleanupOldTweetDetails` retention sweep (which currently deletes by `fetchedAt` regardless of status) for Pro users.

(Media is hot-linked from `*.twimg.com`, not blobbed — text/thread/metadata preservation needs **no new fetch**; true media-byte preservation would be a later, separate feature.)

### 6.4 Manifest & build changes

`public/manifest.json`:
- **Offline-signed-key path (recommended):** *no new host permission needed* — verification is pure local crypto. For one-click site→extension activation add `externally_connectable: { "matches": ["https://usetotem.xyz/*"] }` + an `onMessageExternal` handler — **both are greenfield** (neither exists in the codebase today). Note this path still puts the site in the *activation* trust chain (it hands over the key); pair it with the on-device signature verify so entitlement is never granted on the site's say-so alone. The paste-a-key fallback is the only truly zero-trust-chain path — always ship it.
- **Online-validate fallback path:** add the MoR API origin to **`optional_host_permissions`** (request at upgrade time via `chrome.permissions.request`, so free users never grant it) and, if you tighten CSP, an explicit `connect-src 'self' https://x.com <mor-api>`.
- **Reword `description`:** the readiness script pins the description string **exactly**, including the literal "no server" phrasing. The offline-key path keeps it true. The online-validate path forces a coordinated change in **three places at once** — the manifest, `expected.description` in `verify-cws-featured-readiness.mjs`, and the dashboard listing/privacy packet — so "launch on fallback, migrate later" is not free; budget for it. Keep `script-src 'self'` untouched (never add a payment SDK `<script>`).

Build (`vite.config.ts`, `src/vite-env.d.ts`): inject the **public** verification key via the existing `define` mechanism (same pattern as `__TOTEM_APP_VERSION__`) — or just commit it as a constant (it's public). **No secret ever enters `dist/`.** Add `@noble/ed25519` to dependencies — **build trap (verified):** `@noble/ed25519` needs SHA-512 wired in manually, and the standard snippet's `import { sha512 } from '@noble/hashes/sha512'` **does not resolve against `@noble/hashes` 2.x** (neither `/sha512` nor `/sha2` is an exported subpath). Use `import { sha512 } from '@noble/hashes/sha2.js'` (the `.js` suffix is required) and register `ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m))` **before any `verify` call** (sync verification needs the sync hook set at SW startup).

Release pipeline:
- **`scripts/verify-cws-featured-readiness.mjs`** hard-pins the exact permissions, host_permissions (must be exactly `["https://x.com/*"]`), name, description, and screenshot set — **loosen it** for any new host/permission/description or `cws:featured:preflight` (and the release flow) will fail. It does **not** check `content_security_policy` or `externally_connectable`, so those pass silently. This is the single most important repo-mechanical gotcha.
- Update `PUBLISH.md` + the dashboard packet with permission justifications + the privacy disclosure.
- (Optional, wise) add a grep guard in `scripts/package-extension.mjs` asserting no private-key-looking strings leaked into `dist/` before zipping.

### 6.5 Site changes (`apps/site/`, stays 100% static)

The Astro site is `output:"static"` with no adapter/functions — it **can't** host a license endpoint, and it **shouldn't** (that would be a Totem server). It only needs static pages + client `<script>`:

| New page | Path | Template | Notes |
|---|---|---|---|
| Pricing | `src/pages/pricing.astro` | `export-format/v1.astro` or a `SiteApp.tsx` island | Indexable. "Buy" links out to MoR hosted checkout. Add `"pricing"` to `SitePageKey`. |
| Success / license delivery | `src/pages/upgrade/success.astro` | `uninstall-feedback.astro` | `noindex`; MoR `success_url` lands here; client `<script>` reads `location.search`, shows key + copy + "activate in Totem" deep-link. Exclude from sitemap. |
| Manage license | `src/pages/manage-license.astro` | `uninstall-feedback.astro` | Paste-key / check-status; links to MoR customer portal. No backend. |

Also: centralize new URLs in `src/react/site-content.ts` `SITE_LINKS`; the build-time UTM/`ref` decoration in `rehype-blog-links.mjs` auto-tags blog→pricing and blog→checkout links (keep it). Update `index.astro`'s `SoftwareApplication` JSON-LD `offers` (currently `price:"0"`, `isAccessibleForFree:true`) to reflect free + $19 tiers.

---

## 7. Chrome Web Store compliance checklist

(Native CWS payments died **Feb 1 2021** — external processor is mandatory.)

- [ ] Checkout happens **off-extension** (web/MoR-hosted), not a fake-native in-extension purchase.
- [ ] License validation returns **JSON/signed data only** — no fetched JS/WASM, no `eval`. Declare **remote code = No** (true).
- [ ] All Pro feature *logic* ships in the package; the license result only flips local flags ("full functionality discernible from submitted code").
- [ ] Pro features stay within the **single purpose** (read/search/export your X bookmarks). Don't add an unrelated second product.
- [ ] **Privacy practices tab:** update data-collected to include **PII (email) + auth info (license key)**; per-permission justifications; the 3 Limited-Use certifications.
- [ ] **Privacy policy** on `usetotem.xyz` discloses: license/email sent to `<MoR>` for validation, not sold, not used for ads; **bookmark content never transmitted**. (With offline keys, even the email/key may never leave the device — keep the policy honest to whichever path ships.)
- [ ] Store listing states **free core + optional one-time Pro unlock** and lists Pro features (Deceptive-Installation-Tactics rule: don't advertise a headline feature then reveal at point-of-use that it's paid without prior disclosure).
- [ ] **Featured screenshots disclose Pro (adversarial-review flag).** The readiness script pins the screenshot set, and `04-export-twitter-bookmarks-markdown-csv-notion.png` literally advertises export — gating export while a featured screenshot sells it is the exact "advertise-then-paywall" pattern §266 prohibits. Mitigation: the **free export allowance** (export your first ~25) keeps the screenshot *truthful* (export genuinely works free), and the listing copy must label unlimited export / preservation / bulk as Pro. Re-shoot or annotate the screenshot if it implies unlimited export is free.
- [ ] When activation arrives via `onMessageExternal` from the site, the SW still **verifies the signature on-device** before granting Pro — never grant entitlement on the page's message alone (a reviewer reading site→extension entitlement-granting as remote control is a rejection vector).
- [ ] New host permission (if any) scoped narrowly (never `<all_urls>`), justified in the dashboard, ideally `optional_host_permissions`.

---

## 8. Paywall UX — moments, copy, anti-patterns

**Reference model: Obsidian Catalyst** — "your data stays local, the app is free, Pro is a one-time unlock that funds the work." Frame Pro partly as *support*, not feature ransom.

**Upgrade moments (each fires once, contextually, dismissible, after value is felt):**
1. **At export, after a free preview** (primary). Let free users export/preview the first ~25 of *their own* bookmarks, then: *"Export all 3,412 → Unlock Pro ($14 founders / $19)."* Highest intent.
2. **When a deleted tweet is opened** (secondary, emotional): *"This tweet was deleted on X. Totem kept your copy. Pro preserves every deleted bookmark automatically."*
3. **On a bulk op** — they've already invested effort selecting.
4. **On advanced filter use** — show filters lock-badged.
5. **On first note/annotation.**
Plus one quiet, persistent "Upgrade / Support Totem" entry in Settings. **Never** auto-popup on new-tab load; never re-prompt a dismissed context.

**Copy that converts here:**
- Headline the model, not the price: *"Totem Pro — one-time unlock. No subscription. Ever."*
- Pre-empt "no server, why pay?": *"You're paying for the work, not infrastructure. Totem stays free and open source; Pro funds development. Your data never leaves your machine."*
- Reassure on the check: *"Verified by a one-time license check (email + key only). Your bookmarks never leave your device."* (or, offline path: "…verified entirely on your device.")
- Ownership: *"Buy once, use on all your browsers."*

**Anti-patterns that nuke goodwill (DON'T):** nagging after dismissal; clawing back currently-free features (→ grandfather); card-required "free trials"; fake scarcity/countdown; surprise paywall with no prior disclosure; any telemetry creep. Upgrade-prompt copy that lists the value proposition converts **~4x** a bare alert (2%→8% in real first-party data).

---

## 9. Phased rollout — do these in order

**Phase 0 — Decisions & accounts (no code).** Pick MoR (Lemon Squeezy vs Polar) and issuance (Keyforge vs serverless signer). Create the $19 product + $14 founders coupon. Generate the Ed25519 keypair (private key → signer only; public key → extension). Write the privacy-policy update + the "honest stance" copy.

**Phase 1 — The entitlement spine (ship dark).** `CS_ENTITLEMENT` + `entitlement.ts` + `verifyLicense` + snapshot field + `useIsPro()` + grandfather stamp on `onInstalled`. No gates yet, no UI. Test that `isPro` propagates reactively and survives reset/account-switch. This is the load-bearing, low-visibility work.

**Phase 2 — The gate + the one feature.** `<ProGate>`/`requirePro`/`UpgradeModal`/`usePro`. Gate **export** only (the cleanest, highest-intent surface) with the free-allowance + grandfathering. Paste-a-key activation in Settings. Ship the site `pricing`/`success`/`manage-license` pages + MoR checkout. **This is the minimum sellable release.**

**Phase 3 — The emotional gate.** Wire deleted-tweet preservation (the two data-layer tweaks) and its "kept your copy" moment. Add the per-article export + advanced-filter + annotation gates (all already-built features, same wrapper).

**Phase 4 — Net-new value.** Build **bulk operations** (the only net-new feature) — a clearly-new Pro capability nobody can claim was taken away. Then the `ProNudge`, the founders-price banner (time-boxed), and analytics on the success page.

**Phase 5 — Optional hardening.** If you launched on the online-validate fallback, migrate to offline signed keys (removes the host permission, restores literal "no server"). Add the fail-open revocation list only if refund abuse ever shows up.

---

## 10. Open decisions for you

These are genuine forks where your preference matters — everything else above is a recommendation I'd ship as-is:

1. **MoR:** Lemon Squeezy (most mature license API, Stripe-transition watch) vs Polar (cheaper, OSS-positioned, younger). Both are fine; pick on whether maturity or cost/ethos weighs more.
2. **Issuance:** Keyforge (turnkey, one more vendor) vs a tiny serverless signer you own (no vendor lock-in, ~40 lines + a webhook). The signer is more on-brand; Keyforge is faster.
3. **Launch verification path:** ship straight to offline signed keys (purest, slightly more setup) vs launch on MoR online-validate and migrate later (faster, one temporary host permission).
4. **Free export allowance:** the exact N (25 is the research default) and whether per-article *Copy-to-clipboard* stays free as a teaser (recommended yes).
5. **Annotations/advanced-search free vs Pro:** the GTM doc gates them; the retroactive-paywall risk argues for keeping the *currently-shipping* versions free for everyone and gating only *export of* annotations + *new* filter operators. Worth a deliberate call.

---

## 11. Appendix — raw research

Full reports in [`plans/research/premium-monetization/raw/`](research/premium-monetization/raw/):

- **Codebase:** `cb-data-sync.md` (entitlement storage + reactive channel), `cb-features-export.md` (export gate + feature inventory), `cb-build-release.md` (pipeline + manifest + CWS mechanics), `cb-site-distribution.md` (Astro static + checkout pages), `cb-ui-state-upsell.md` (`usePro`/`<ProGate>`/upsell mounts).
- **Market:** `rs-payments.md` (gateway comparison), `rs-license-arch.md` (Ed25519 offline keys + the "crackable is fine" thesis), `rs-recent-discourse.md` (2026 builder evidence, lifetime-vs-sub), `rs-cws-policy-ux.md` (CWS compliance + paywall UX).
