# License / Entitlement Validation Architecture for Totem (Open-Source, Local-First MV3 Extension)

> Research brief — market + technical validation of how to gate a paid "Pro" tier when the source is public on GitHub and there is no Totem server.
> Date: 2026-06-19. All claims sourced inline. This is a raw research document, not a final spec.

---

## 0. The constraint, stated honestly up front

Totem is:
- **Open-source** (source public on GitHub),
- **Local-first** (no Totem server, no account, IndexedDB + chrome.storage.local),
- **MV3** (Chrome Web Store policy forbids remotely-hosted *code*).

These three facts collide into one hard truth that must frame every decision below:

> **Any client-side-only entitlement check in open-source software can be patched out by a determined user who recompiles the extension.** There is no cryptography that fixes this — the public key, the verifier, and the `isPro` flag all live on the user's machine, in code they can read and edit.

So the goal is **not** "make Pro uncrackable." That is impossible and chasing it wastes engineering on DRM that the target communities (r/selfhosted, HN, r/privacy) actively distrust. The goal is:

> **Make legitimately paying easier, more pleasant, and more trustworthy than cracking — and keep the honest-buyer experience clean.** Lose the rounding-error of users who would never have paid anyway.

This is the canonical "service problem, not a pricing problem" framing from Gabe Newell: *"Piracy is almost always a service problem and not a pricing problem... the way to stop piracy is not by selling at a lower price, but by offering a service that's better than what the pirates can provide."* ([Escapist](https://www.escapistmagazine.com/valves-gabe-newell-says-piracy-is-a-service-problem/), [Slashdot](https://games.slashdot.org/story/11/11/25/2217247/valves-gabe-newells-on-piracy-its-not-a-pricing-problem), [HN discussion](https://news.ycombinator.com/item?id=14393416)). For a $19 one-time lifetime tool, the cracker's "service" (find a patched build, trust a stranger's binary, re-patch on every update, get no support) is *worse* than just paying once. That is the moat — not the crypto.

---

## 1. Signed license keys with offline verification (the crypto layer)

### 1.1 The pattern

A signed license key is **`base64(payload) . base64(signature)`** — a small data object the vendor signs with a **private key** (server / issuance side only) and the client verifies with an **embedded public key**. No secret lives client-side; the public key is safe to ship in the extension bundle. This is exactly how Keygen, Keyforge, Polar, Cryptolens, and the "license key as JWT" pattern all work.

Keygen's canonical description: a signed key is `${ENCODED_DATA}.${ENCODED_SIGNATURE}`, e.g.
`dXNlckBjdXN0b21lci5leGFtcGxl.kANuXAhc8b7rDNgbFBpoSUsmfkM7msQC0tNkeUed4b5W15xF6zxmoV3AYF54zaWFMHznSNY7M9bLloInknvlDw==`
The data is base64-encoded plaintext; the signature is produced with the vendor's private Ed25519 key. The client verifies with only the public key, embedded in the application. *"Unless a bad actor can break Ed25519 or RSA-2048, writing a keygen is effectively impossible."* ([Keygen — How to Generate Secure License Keys](https://keygen.sh/blog/how-to-generate-license-keys/)).

Client verification is a handful of lines (Keygen's own example, Node `crypto`):
```js
const [encodedData, encodedSignature] = licenseKey.split('.')
const signature = Buffer.from(encodedSignature, 'base64')
const data      = Buffer.from(encodedData, 'base64').toString()
const valid     = crypto.verify(null, Buffer.from(data), publicKey, signature)
```
([Keygen blog](https://keygen.sh/blog/how-to-generate-license-keys/))

### 1.2 Algorithm choice: Ed25519 (EdDSA), not RSA

- Ed25519 keys/signatures are **tiny** vs RSA (keeps the license string short enough to paste). EdDSA is recommended for new implementations where the JWT/crypto library supports it ([Curity — JWT signatures with EdDSA](https://curity.io/resources/learn/jwt-signatures/)).
- Keygen defaults to Ed25519 when no scheme is set; supports Ed25519 or 2048-bit RSA, optionally AES-256-GCM encryption ([Keygen cryptography docs](https://keygen.sh/docs/api/cryptography/)).
- Industry trend: Ed25519 has displaced RSA as the modern default for signatures ([DEV — SSH Keys in 2024: Why Ed25519 Replaced RSA](https://dev.to/theisraelolaleye/ssh-keys-in-2024-why-ed25519-replaced-rsa-as-the-default-47aa)).

### 1.3 Libraries — fits for Totem's existing stack

The repo already ships **`@noble/hashes 2.2.0`** (confirmed in `package.json`). The natural companions:
- **`@noble/ed25519`** — "Fastest 5KB JS implementation of ed25519 signatures" ([GitHub](https://github.com/paulmillr/noble-ed25519), [npm](https://www.npmjs.com/package/@noble/ed25519)). API is exactly the detached-signature shape we need:
  ```js
  import * as ed from '@noble/ed25519';
  const isValid = await ed.verify(signature, message, publicKey); // → boolean
  ```
  Inputs accept `Uint8Array` or hex; verify supports detached signatures natively ([noble-ed25519 README](https://github.com/paulmillr/noble-ed25519)).
- **`@noble/curves`** — broader suite (also from paulmillr) if more than ed25519 is ever needed ([JSR](https://jsr.io/@noble/curves)).
- **Alternative with zero deps:** the browser-native **`SubtleCrypto.verify()`** Web Crypto API supports Ed25519 in modern Chrome ([MDN — SubtleCrypto.verify](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify)). This avoids adding any dependency at all, but `@noble/ed25519` is more ergonomic and battle-tested across environments and pairs with the `@noble/hashes` already present.

**Recommendation:** `@noble/ed25519` (+ the already-present `@noble/hashes` for SHA-512 it needs). ~5 KB, audited, matches the existing dependency philosophy.

### 1.4 License-as-signed-JWT variant (equivalent, more standard)

Instead of a bespoke `payload.sig` format, the same thing can be a **JWT signed with EdDSA (`Ed25519`) or RS256**: header + payload + signature, verifiable offline with the public key, no server call. *"A JWT is a small, signed data object that can be verified without calling a server... your app can verify it offline."* ([Keyforge — How to use JWTs to create an offline licensing system](https://keyforge.dev/blog/how-to-offline-licensing)). Keyforge issues signed license **tokens (JWTs)** the app verifies locally with no network call, so the app keeps working offline ([Keyforge](https://keyforge.dev/)). The payload carries license key id, product id, device identifier, device name, and an **`exp` expiration** claim; the signature covers the payload so the user can't modify contents without breaking verification ([Keyforge blog](https://keyforge.dev/blog/how-to-offline-licensing)).

For Totem the bespoke `base64(json).base64(ed25519sig)` format is simpler than dragging in a JWT lib, but a JWT is fine if a license vendor emits one natively. **Either is equivalent crypto.** The decision is driven by what the chosen payment vendor produces (see §3).

### 1.5 What to embed in Totem's license payload

Minimal, copy-paste-friendly JSON, then ed25519-signed:
```json
{
  "v": 1,
  "email": "buyer@example.com",
  "plan": "pro-lifetime",
  "order": "ls_ord_abc123",
  "issued": "2026-06-19",
  "exp": null,            // null = lifetime; or an ISO date for refresh-token style
  "feat": ["export","preserve","bulk","filters","annotate"]
}
```
The "more data you embed, the larger the key" — not a problem since users paste, not type ([Keygen blog](https://keygen.sh/blog/how-to-generate-license-keys/)). Embedding the **email** is a deliberate soft anti-piracy nudge: a leaked key is traceable to the buyer and the extension can display *"Licensed to buyer@example.com"* — social friction, not technical DRM.

---

## 2. The fundamental reality: it's crackable, and that's fine

### 2.1 Why it's unavoidable here

Open-source + client-only means the verifier, the embedded public key, and the `isPro` boolean are all in readable code. A determined user can:
- delete the verification call and hard-code `isPro = true`, or
- generate their own keypair, swap the embedded public key, and self-sign keys.

No client-side scheme prevents this. The community even names the trade-off: the way source-available freemium apps "protect" paid features is to keep **premium pieces closed/source-available**, while the open core stays public — Standard Notes keeps the app + server open source but ships **some subscription extensions as source-available (closed)** ([AlternativeTo — Standard Notes](https://alternativeto.net/software/standard-notes/about/)); Obsidian sidesteps it entirely by being **proprietary** with paid Sync/Publish ([XDA](https://www.xda-developers.com/replaced-entire-productivity-stack-with-open-source-tools-except-obsidian/)). Totem's whole pitch is auditability, so going closed-source is off the table — which means **accepting leakage is the correct strategy, not a failure.**

### 2.2 The pragmatic indie consensus (concrete examples / commentary)

- **Gabe Newell / Valve** — the foundational "piracy is a service problem; out-serve the pirates" thesis, repeatedly cited by indie devs as the reason heavy DRM backfires ([Escapist](https://www.escapistmagazine.com/valves-gabe-newell-says-piracy-is-a-service-problem/), [GamesRadar](https://www.gamesradar.com/gabe-newell-piracy-issue-service-not-price/), [TechRadar](https://www.techradar.com/news/gaming/valve-gaming-piracy-fades-when-you-offer-a-good-service-1036341)).
- **Indie devs measuring real piracy rates** find that a large share of "pirates" would never have paid — fighting them is negative ROI, and even AAA DRM is cracked within a week, so the winning move is a superior experience for buyers (e.g., *"So 52.45% of People Playing my Indie Game Have Pirated it"* — [Game Developer](https://www.gamedeveloper.com/business/so-52-45-of-people-playing-my-indie-game-have-pirated-it-); developers who *encourage* piracy as marketing because the non-payers wouldn't convert anyway — [PCWorld / Darkwood](https://www.pcworld.com/article/2191471/indie-horror-developer-tells-players-to-pirate-their-game.html), [TheGamer](https://www.thegamer.com/indie-developer-wants-people-pirate-game/)).
- **OSS monetization in practice (2024–2026)** has converged on models that *don't* depend on un-crackable clients: open-core (paid features companies will pay for), sponsorship (GitHub Sponsors / Open Collective / Patreon), and managed/hosted convenience — see the curated [awesome-oss-monetization](https://github.com/PayDevs/awesome-oss-monetization), [reo.dev — 7 strategies](https://www.reo.dev/blog/monetize-open-source-software), and Polar positioning itself as the OSS funding/monetization layer ([Product Hunt](https://www.producthunt.com/products/polar-6)). The throughline: **the moat is convenience, trust, support, and ongoing value — not a license check.**

### 2.3 What this means for Totem specifically

The honest stance to publish (in docs and the buy flow):

> "Totem is open source. You *could* patch out the Pro check — the code is right there. We're not going to fight you with DRM that would make the app worse for everyone. Pro is $19 once; it funds the deleted-tweet preservation, export, and search work. If you find it useful, buy it. If you genuinely can't, the free tier is fully functional forever."

This converts the crackability from a liability into a **brand-aligned trust signal** for exactly the privacy/self-hosted/HN audience Totem is courting (the same audience that, per Totem's GTM report, distrusts cloud DRM and values auditability above all).

---

## 3. Online activation vs fully-offline (vendor comparison)

### 3.1 The spectrum

| Dimension | Fully offline (signed key) | Online activation (API) |
|---|---|---|
| Network after first entry | none — pure local crypto | required each validate (or periodic) |
| Revocation speed | only at token `exp` / next refresh | immediate |
| Device binding / activation limit | only what's baked into the signed payload | enforced server-side, real-time |
| Works on plane / offline | yes | no (unless cached + grace period) |
| Privacy (no phone-home) | best — nothing leaves device | each check is a network event |
| Fits Totem's "no server" ethos | perfectly | mild tension (3rd-party server, not Totem's) |

Keyforge's own table captures the trade: offline = no network dependency after activation, **delayed** revocation (until token expiry), works offline, grace period recommended; online = immediate revocation but fails with no connection ([Keyforge blog](https://keyforge.dev/blog/how-to-offline-licensing)). The standard hybrid: **first-time activation is online** (exchange the license key for a signed token bound to a device), then **verify offline** thereafter, **refreshing the token in the background** when connectivity returns; use a **grace period** instead of hard lockout on expiry ([Keyforge blog](https://keyforge.dev/blog/how-to-offline-licensing)).

### 3.2 What the vendors give you out of the box

**ExtPay / ExtensionPay** — purpose-built for browser extensions, *no server needed*, Stripe on the backend. You drop in the open-source `ExtPay.js`, call `extpay.openPaymentPage()`, and read paid status via `extpay.getUser()` → `{ paid, paidAt, trialStartedAt, subscriptionStatus }`; cross-device via `extpay.openLoginPage()` (magic-link email); react to purchase via `extpay.onPaid.addListener()`. It is a **data fetch** to ExtensionPay servers (cached via `chrome.storage`), **not remote code** — so MV3-safe ([ExtPay GitHub](https://github.com/Glench/ExtPay), [ExtensionPay — Add Paid Licenses](https://extensionpay.com/articles/add-paid-licenses-to-chrome-extensions), [Add Stripe Payments to Chrome Extensions](https://extensionpay.com/articles/add-stripe-payments-to-chrome-extensions)). It removes the need to build *any* server. Trade-off: it's **online by design** (getUser is a network call; offline persistence/cache duration are not strongly documented — handle `getUser().catch()`), and it's a dependency on ExtensionPay's service staying up — a slight tension with Totem's "nothing can shut down" pitch.

**Lemon Squeezy license keys** — merchant-of-record (handles VAT/sales tax). Keys are managed via **activate / validate / deactivate** API endpoints with an **instance/activation limit** (bind to N devices), online by default ([LS — License key object](https://docs.lemonsqueezy.com/api/license-keys/the-license-key-object), [LS — Licensing](https://docs.lemonsqueezy.com/help/licensing), [LS — Generating license keys](https://docs.lemonsqueezy.com/help/licensing/generating-license-keys)). Online validation, but you can wrap it: activate once, then trust a locally cached/signed result.

**Polar license keys** — also merchant-of-record. **activation limit** per key (e.g. 3 instances), separate **activate/deactivate** calls so users can move machines, **automatic revocation** when a subscription is cancelled, and JSON **conditions** (IP/MAC/version) checked server-side ([Polar — License Keys docs](https://polar.apidocumentation.com/documentation/features/benefits/license-keys), [Polar — Activate License Key API](https://docs.polar.sh/api-reference/customer-portal/license-keys/activate), [polar-js SDK](https://github.com/polarsource/polar-js/blob/main/docs/sdks/licensekeys/README.md)). Caveat: Polar's license validation is **online — every check is a live API call, with no signed offline artifact or built-in grace period** by default ([LicenseSeat critique of Polar.sh](https://licenseseat.com/alternative-to-polarsh)). Good for revocation, bad for "works offline forever."

**Keygen / Keyforge** — purpose-built licensing. Both support **signed/encrypted offline license files** verifiable with just your public key (Keygen: Ed25519/RSA, AES-256-GCM optional, tamper-proof embedded snapshot with expiry — designed for air-gapped/offline use) ([Keygen — Offline licensing](https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/), [Keygen — cryptography API](https://keygen.sh/docs/api/cryptography/), [Keygen — example cryptographic verification](https://github.com/keygen-sh/example-cryptographic-verification)). Keyforge issues signed-JWT tokens for offline verify and supports Stripe/Polar/Lemon Squeezy as the payment layer ([Keyforge](https://keyforge.dev/)). These give the **best offline story** but add a licensing-vendor dependency.

### 3.3 Recommendation on the online/offline axis for Totem

**Offline-verified signed keys, with the payment vendor only touched at purchase time.** Totem should *not* phone home on every launch — that contradicts the local-first, no-telemetry promise and adds a runtime dependency. The buyer activates once (paste key → verify signature locally), and Totem never needs the network again. Revocation is a near-non-issue for a **one-time lifetime** product (there's no subscription to cancel; the only revocation case is a refunded/charged-back order, which is rare and low-stakes — handle it with an optional, **best-effort** online revocation-list check that *fails open*, never blocking offline users).

---

## 4. The MV3 constraint: data fetch ✅, remote code ❌

MV3 program policy: **"an extension can only execute JavaScript that is included within its package"** — no remotely-hosted code (JS from your server, CDN libraries, or bundled libs that dynamically fetch remote code) ([Chrome — MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements), [Chrome — Improve extension security](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security), [Chrome — remote hosted code violations](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)).

Crucially, the policy **distinguishes code from data**: extensions *may* fetch **configuration data** (e.g. a JSON file) to toggle features and change behavior at runtime; what's forbidden is fetching and *executing* code ([Chrome — remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code), and the chromium-extensions thread clarifying remote config JSON is allowed — [Google Groups](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/3-0UtxLHAhs)).

**Implications for license validation — both valid approaches are MV3-compliant:**
1. **Pure local crypto** (verify a pasted signed key with the embedded public key via `@noble/ed25519`): no network at all, trivially compliant. ✅
2. **Data fetch** (call ExtPay/Lemon Squeezy/Polar/Keygen license API, receive a JSON validation result or signed token): this is fetching **data**, not code — explicitly allowed. ✅ (This is exactly how ExtPay operates — `getUser()` is a data fetch, not remote code — [ExtPay GitHub](https://github.com/Glench/ExtPay).)

What you may **not** do: download a JS "license validator" module from a server and `eval`/import it at runtime. Don't. Keep all verification logic in the shipped bundle; only ever move **data** across the wire.

---

## 5. Recommended license architecture for Totem

### 5.1 Summary

**Offline-first, Ed25519-signed license keys, verified with an embedded public key, with a hosted merchant-of-record only at purchase time. No Totem server. No per-launch phone-home. Honest, published "this is crackable and that's okay" stance.**

### 5.2 Where the key comes from

- **Issuance (private side):** A merchant-of-record handles checkout + tax. Two viable setups:
  - **(A) Keyforge/Keygen-style signing** wired to **Lemon Squeezy or Polar** checkout: on successful order, the vendor (or a tiny serverless function / the licensing vendor itself) signs an Ed25519 license payload and emails the key to the buyer. Keyforge explicitly supports Stripe/Polar/Lemon Squeezy as payment + issues offline-verifiable signed tokens ([Keyforge](https://keyforge.dev/)).
  - **(B) DIY issuance:** keep the Ed25519 **private key** in a single serverless endpoint (or even an offline signing script you run on orders). It signs `base64(json).base64(sig)` per Keygen's format ([Keygen blog](https://keygen.sh/blog/how-to-generate-license-keys/)). This is the cheapest, most "no-vendor-lock-in" option and fits Totem's ethos, at the cost of running one small signer.
- The **public key** is embedded in the extension bundle (safe to ship; it can only verify, not sign).

### 5.3 Exact verification mechanism

In the extension's service worker (the API boundary), on key entry:
```js
import * as ed from '@noble/ed25519';
const PUBKEY = /* 32-byte ed25519 public key, hardcoded in bundle */;

async function verifyLicense(key) {
  const [b64data, b64sig] = key.trim().split('.');
  if (!b64data || !b64sig) return null;
  const data = JSON.parse(atobUtf8(b64data));            // {email, plan, exp, feat, ...}
  const msg  = new TextEncoder().encode(b64data);        // sign/verify over the encoded data
  const sig  = base64ToBytes(b64sig);
  const ok   = await ed.verify(sig, msg, PUBKEY);        // pure local crypto, no network
  if (!ok) return null;
  if (data.exp && new Date(data.exp) < new Date()) return null; // null exp = lifetime
  return data;                                            // valid entitlement
}
```
(Mirrors Keygen's offline verify pattern — [Keygen blog](https://keygen.sh/blog/how-to-generate-license-keys/) — and `@noble/ed25519`'s `verify(sig, msg, pubkey)` API — [noble-ed25519](https://github.com/paulmillr/noble-ed25519).)

### 5.4 Online vs offline decision

- **Default: fully offline.** Verify locally; never required to hit the network again after entry. Preserves local-first, zero-telemetry, "nothing can shut down" promises.
- **Optional best-effort online revocation:** at most once per app launch (or weekly), Totem *may* fetch a small static **revocation list JSON** (refunded/charged-back order ids) — a **data fetch**, MV3-legal ([Chrome — remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)). It **fails open**: no network → stay Pro. This is the only "online" touch and it's non-blocking.

### 5.5 What's stored where

- **`chrome.storage.local`**: the verified entitlement — `{ isPro: true, plan, email, order, feat, verifiedAt }`. Survives cache/history clears and is shared across service worker + extension pages ([Chrome — storage & cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies), [chrome.storage reference](https://developer.chrome.com/docs/extensions/reference/api/storage)).
- **The raw signed key**: also stored in `chrome.storage.local` so it can be re-verified on demand and re-displayed.
- **Runtime**: `isPro` mirrored into the Zustand store (matching Totem's existing state pattern) so React gates read it synchronously.
- **Re-verification**: re-run the signature check on each startup from the stored key (cheap, offline) rather than trusting a bare boolean — so a flipped `isPro` in storage alone (without a valid key) doesn't unlock. (Caveat: a recompile still bypasses this — accepted per §2.)

### 5.6 How revocation works

- **Lifetime, no subscription** → the dominant case never needs revocation.
- **Refund / chargeback** → optional revocation-list fetch (§5.4), fail-open. Worst case: a refunded user keeps Pro. Acceptable leakage.
- **If Totem ever adds a subscription tier**, switch that tier to a **short-`exp` signed token refreshed online** (Keyforge model — revocation arrives at next refresh; grace period to avoid offline lockout — [Keyforge blog](https://keyforge.dev/blog/how-to-offline-licensing)). Not needed for the recommended $19 lifetime.

### 5.7 The honest stance (ship this copy)

Publish, in the README and the upgrade screen, the §2.3 statement: open source, patchable, no DRM arms race, $19 funds the work, free tier stays whole. This is on-brand trust for Totem's audience and converts the "it's crackable" weakness into a feature.

---

## 6. End-to-end sequence: purchase → unlock

```
1. PURCHASE
   Buyer clicks "Upgrade to Pro – $19 lifetime" → opens hosted checkout
   (Lemon Squeezy / Polar = merchant-of-record, handles card + VAT).
        │
        ▼
2. LICENSE ISSUED
   On successful order, issuer signs an Ed25519 license payload
   { email, plan:"pro-lifetime", order, exp:null, feat:[...] }
   → base64(payload).base64(sig). Emailed to buyer (+ shown on success page).
        │
        ▼
3. ENTERED / ACTIVATED
   Buyer pastes the key into Totem's "Enter license" field
   (extension Options / upgrade screen). No account, no login required.
        │
        ▼
4. VERIFIED (offline, local crypto)
   Service worker: ed.verify(sig, encodedPayload, EMBEDDED_PUBKEY)
   + check exp. Pure local computation, zero network.   [MV3-safe]
        │
        ▼
5. isPro = true
   On valid signature → entitlement object derived from payload.feat.
        │
        ▼
6. PERSISTED
   { isPro, plan, email, order, feat, verifiedAt } + raw key
   → chrome.storage.local (survives restarts/cache clears),
   mirrored into Zustand for synchronous React reads.
        │
        ▼
7. GATES UNLOCK
   Export (MD/CSV/JSONL), deleted-tweet preservation, bulk ops,
   advanced filters, annotations check isPro from the store.
   Re-verified from stored key on each startup (offline).
        │
        ▼
   (optional) BEST-EFFORT REVOCATION: weekly fetch of static
   revocation-list JSON; fail-open. Never blocks offline users.
```

---

## 7. Concrete recommendation (one paragraph)

Ship **offline-verified Ed25519 signed license keys**: issue them at checkout through a merchant-of-record (Lemon Squeezy or Polar for tax handling; optionally Keyforge/Keygen or a tiny serverless signer for the actual signing), embed only the **public key** in the extension, and verify pasted keys **entirely locally** with **`@noble/ed25519`** (pairs with the `@noble/hashes` already in `package.json`). Persist the verified entitlement in `chrome.storage.local` + Zustand, re-verify from the stored key on each launch, and add only an **optional fail-open revocation-list data fetch** (MV3-legal, never blocking). Use **lifetime keys** (`exp: null`) so there is no per-launch phone-home and nothing to shut down — and publish the honest, on-brand stance that the check is patchable by design, because for a $19 one-time tool the cracker's experience is worse than just paying, and Totem's privacy-first audience will trust the absence of DRM more than they'd respect its presence.

---

## 8. Sources

Crypto / signed keys / offline verification:
- Keygen — How to Generate Secure License Keys: https://keygen.sh/blog/how-to-generate-license-keys/
- Keygen — Cryptography API: https://keygen.sh/docs/api/cryptography/
- Keygen — Offline licensing model: https://keygen.sh/docs/choosing-a-licensing-model/offline-licenses/
- Keygen — example cryptographic verification (ECC/RSA): https://github.com/keygen-sh/example-cryptographic-verification
- Keyforge — How to use JWTs for offline licensing: https://keyforge.dev/blog/how-to-offline-licensing
- Keyforge — product (signed JWT tokens, Stripe/Polar/LS): https://keyforge.dev/
- Curity — JWT signatures with EdDSA: https://curity.io/resources/learn/jwt-signatures/
- DEV — SSH Keys in 2024: Why Ed25519 Replaced RSA: https://dev.to/theisraelolaleye/ssh-keys-in-2024-why-ed25519-replaced-rsa-as-the-default-47aa

Libraries:
- @noble/ed25519 (GitHub): https://github.com/paulmillr/noble-ed25519
- @noble/ed25519 (npm): https://www.npmjs.com/package/@noble/ed25519
- @noble/curves (JSR): https://jsr.io/@noble/curves
- MDN — SubtleCrypto.verify (native Ed25519): https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/verify

Payment / licensing vendors:
- ExtPay (GitHub): https://github.com/Glench/ExtPay
- ExtensionPay — Add Paid Licenses to Chrome Extensions: https://extensionpay.com/articles/add-paid-licenses-to-chrome-extensions
- ExtensionPay — Add Stripe Payments to Chrome Extensions: https://extensionpay.com/articles/add-stripe-payments-to-chrome-extensions
- Lemon Squeezy — License key object: https://docs.lemonsqueezy.com/api/license-keys/the-license-key-object
- Lemon Squeezy — Licensing overview: https://docs.lemonsqueezy.com/help/licensing
- Lemon Squeezy — Generating license keys: https://docs.lemonsqueezy.com/help/licensing/generating-license-keys
- Polar — License Keys docs: https://polar.apidocumentation.com/documentation/features/benefits/license-keys
- Polar — Activate License Key API: https://docs.polar.sh/api-reference/customer-portal/license-keys/activate
- polar-js SDK (license keys): https://github.com/polarsource/polar-js/blob/main/docs/sdks/licensekeys/README.md
- LicenseSeat — critique of Polar.sh (online-only, no offline artifact/grace): https://licenseseat.com/alternative-to-polarsh

MV3 remote code policy:
- Chrome — Additional Requirements for Manifest V3: https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements
- Chrome — Deal with remote hosted code violations: https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code
- Chrome — Improve extension security: https://developer.chrome.com/docs/extensions/develop/migrate/improve-security
- chromium-extensions — remote config JSON clarification: https://groups.google.com/a/chromium.org/g/chromium-extensions/c/3-0UtxLHAhs

Storage:
- Chrome — Storage and cookies: https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies
- Chrome — chrome.storage reference: https://developer.chrome.com/docs/extensions/reference/api/storage

"Crackable but fine" / OSS monetization / piracy-as-service:
- Escapist — Gabe Newell: piracy is a service problem: https://www.escapistmagazine.com/valves-gabe-newell-says-piracy-is-a-service-problem/
- Slashdot — Newell: not a pricing problem: https://games.slashdot.org/story/11/11/25/2217247/valves-gabe-newells-on-piracy-its-not-a-pricing-problem
- GamesRadar — piracy is service not price: https://www.gamesradar.com/gabe-newell-piracy-issue-service-not-price/
- TechRadar — piracy fades with good service: https://www.techradar.com/news/gaming/valve-gaming-piracy-fades-when-you-offer-a-good-service-1036341
- HN — Newell quote discussion: https://news.ycombinator.com/item?id=14393416
- Game Developer — 52.45% pirated my indie game: https://www.gamedeveloper.com/business/so-52-45-of-people-playing-my-indie-game-have-pirated-it-
- PCWorld — indie dev tells players to pirate: https://www.pcworld.com/article/2191471/indie-horror-developer-tells-players-to-pirate-their-game.html
- TheGamer — indie dev wants people to pirate: https://www.thegamer.com/indie-developer-wants-people-pirate-game/
- awesome-oss-monetization (curated list): https://github.com/PayDevs/awesome-oss-monetization
- reo.dev — 7 strategies to monetize OSS: https://www.reo.dev/blog/monetize-open-source-software
- Polar — OSS monetization platform (Product Hunt): https://www.producthunt.com/products/polar-6
- AlternativeTo — Standard Notes (source-available premium extensions): https://alternativeto.net/software/standard-notes/about/
- XDA — Obsidian proprietary with paid Sync/Publish: https://www.xda-developers.com/replaced-entire-productivity-stack-with-open-source-tools-except-obsidian/
