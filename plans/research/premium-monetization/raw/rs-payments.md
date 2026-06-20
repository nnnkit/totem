# Payment Gateways for a One-Time $19 Lifetime Chrome (MV3) Extension Pro Unlock — Market Research (June 2026)

**Scope:** Sell a one-time **$19 lifetime** Pro unlock for Totem, a Manifest V3 Chrome extension, to a privacy-conscious / indie-hacker / PKM audience. Solo dev, local-first ethos, **open-source code (the extension source is public on GitHub)**, wants minimal ops and global sales tax handled.

**Bottom line up front:** For a solo dev who wants tax handled and almost no server, the realistic finalists are **Merchant-of-Record (MoR)** providers. **Polar (polar.sh)** is the recommended primary pick (cheapest MoR economics, modern license-key API whose *validate* endpoint is explicitly safe to call from a public client — ideal for OSS), with **Lemon Squeezy** as the fallback (most mature, battle-tested license API, but pricier and now in a Stripe-driven transition). **ExtensionPay (ExtPay)** is the easiest to wire into an extension but is **not** an MoR (you owe the tax) and adds a hard network dependency + a third-party server in the loop, which clashes with the local-first ethos.

---

## 1. Comparison table

| Provider | Fee (one-time sale) | Merchant of Record? (handles global VAT/GST) | One-time / lifetime support | License key issuance + validation API | Offline / client-side validation feasible? | MV3 / JS SDK ease | Refunds & chargebacks | Payout requirements | Key gotchas |
|---|---|---|---|---|---|---|---|---|---|
| **ExtensionPay (ExtPay)** | **5%** at time of charge, no monthly fee; lower/flat rates for high volume by request. Runs on **your own Stripe** underneath (Stripe's 2.9%+30¢ is on top, paid to your Stripe). | **No.** It's a thin layer on your Stripe account — *you* are the MoR and owe sales tax/VAT. | Yes — monthly, quarterly, yearly, **one-time**. | No license keys. Identity = **email magic link**; paid status lives on extensionpay.com keyed to extension ID + email. | **No.** `getUser()` makes a **network call to extensionpay.com every time**; no documented offline cache. | **Easiest** — built for extensions. `ExtPay(id)` + `startBackground()` in SW + `getUser()`. Only needs `storage` permission + CSP `connect-src https://extensionpay.com`. | Handled via your Stripe dashboard (you manage disputes; you eat chargebacks). | Direct to **your Stripe** account (Stripe payout rules apply). | Hard runtime dependency on a third-party server; JS lib maintenance cadence is slow (server side still active); no tax handling; another origin in the trust chain for an OSS/privacy product. |
| **Stripe (Payment Links / Checkout)** | **2.9% + 30¢** (US card). | **No** (plain Stripe). *You* are MoR; tax is your problem in every country. (Stripe Tax helps *calculate* but you still register/remit.) | Yes. | No built-in license keys — you build issuance + a validation endpoint yourself (needs a server/edge function + secret). | Possible but **you must build & host it**; can't safely validate against Stripe from a public client. | Medium. Payment Link is trivial; but reconciling "did this user pay?" needs your own backend + webhooks. | You manage refunds/disputes; you pay chargeback fees. | Standard Stripe payouts to your bank. | Defeats the "minimal server / tax handled" goal. **Stripe Managed Payments** (their MoR) adds **~+3.5%** on top but is the heavyweight path. |
| **Lemon Squeezy** (Stripe-owned) | **5% + 50¢**; +1.5% intl card, +1.5% PayPal, +0.5% subscription. | **Yes** — full MoR, remits global sales tax/VAT/GST. | Yes — supports one-time products + license keys. | **Yes, mature.** Built-in license key generation + License API: `POST https://api.lemonsqueezy.com/v1/licenses/validate` and `/activate`, `/deactivate`. License-key endpoints take the **license key itself (no secret API key)**. | **Yes** — the validate/activate endpoints are callable client-side with just the key + instance_id; you can cache the validated result locally. | Good. Hosted overlay checkout (`lemon.js`) or hosted link; webhooks for fulfillment. | MoR handles it: refunds on your behalf, **$15 dispute fee** + refunded amount deducted from next payout. | **$100 minimum payout**, automated on the 14th & 28th. | **Transition risk:** acquired by Stripe (2024). Feb 2026 = Stripe **Managed Payments** public preview + migration path for LS merchants; LS still accepts signups and "isn't a replacement, it's an evolution," but long-term product direction is toward Stripe Managed Payments. |
| **Paddle** | **5% + 50¢** (Starter, no monthly fee); custom on Growth/Enterprise. | **Yes** — full MoR; becomes legal seller, handles tax, fraud, chargebacks, refunds. | Yes. | License keys **not a first-class built-in** like LS/Polar; typically you provision keys yourself from the webhook. Custom flows via improved 2025–26 API. | You build your own key storage/validation; feasible but more work. | Medium. Good hosted + embedded checkout (`Paddle.js`), strong tax/compliance. | MoR handles refunds/chargebacks. | Standard Paddle payout schedule to bank. | More enterprise-oriented; historically stricter merchant approval/onboarding review; license-key UX weaker than LS/Polar for indie one-time sales. |
| **Polar (polar.sh)** | **Starter (free): 5% + 50¢**; **Pro $20/mo: 3.8% + 40¢**; Growth/Scale lower. +1.5% intl cards; **$15 chargeback**. (Orgs created before May 27, 2026 keep an "Early Member" rate.) | **Yes** — full MoR; takes on global sales-tax liability. | Yes — define a **one-time** product. | **Yes.** License keys as a product "benefit" (auto-issued on purchase). Validate: `POST /v1/customer-portal/license-keys/validate` — **explicitly "doesn't require authentication and can be safely used on a public client, like a desktop application or a mobile app."** Server-side variant: `/v1/license-keys/validate`. | **Yes — best fit.** Public validate endpoint is *designed* for untrusted clients, so an MV3 extension (or OSS code) can validate without embedding any secret. | Good. Type-safe **`@polar-sh/sdk`** (npm), hosted checkout, webhooks, customer portal. | MoR handles refunds; **$15 per dispute** regardless of outcome. | Stripe-backed payouts: **$2/mo active-payout fee + 0.25% + $0.25 per payout**; meet minimum threshold, then on-demand. | Newer/smaller than LS & Paddle; 2026 pricing moved the free tier to 5%+50¢ (parity with LS/Paddle) unless you pay monthly; payout fees stack on top. |
| **Gumroad** | **10% + 50¢** flat (Discover marketplace = 30%). | **Yes** — full MoR since **Jan 1, 2025** (calculates, collects, remits VAT/GST/sales tax). | Yes — one-time digital products. | **Yes** — built-in license keys + verify API (`/v2/licenses/verify`). | Verify endpoint callable with product_permalink + key (no secret needed to verify); cacheable. | Low/medium for extensions — checkout is web/overlay, no extension-native SDK; you'd glue email→key→extension manually. | MoR handles refunds/chargebacks. | **$10 minimum**, weekly payouts (PayPal/direct deposit). | **Highest fee (10%)** — on a $19 sale that's ~$2.40 vs ~$1.45 (5%+50¢) vs ~$1.16 (Polar Pro 3.8%+40¢). Brand/UX feels creator-marketplace, less "software license." |

### MoR head-to-head (Lemon Squeezy vs Paddle vs Polar)
- **All three are true MoRs** — they become the legal seller and remit global VAT/GST/sales tax, so the solo dev never registers for tax anywhere. This is the single biggest reason to pick one of these over raw Stripe/ExtPay.
- **Cheapest:** Polar (esp. on a paid monthly plan, 3.8%+40¢) < Lemon Squeezy / Paddle (5%+50¢) < Gumroad (10%+50¢).
- **Best license-key DX for a public/OSS client:** **Polar** (auth-free public validate endpoint, stated safe for untrusted clients) and **Lemon Squeezy** (validate/activate take only the key, no secret) tie; **Paddle** trails (roll your own from webhooks).
- **Most mature / lowest "will it still exist" risk:** Lemon Squeezy and Paddle. But LS now carries Stripe-acquisition/transition uncertainty (migration path to Stripe Managed Payments announced Feb 2026); Polar carries "young company" risk.

---

## 2. ExtensionPay (ExtPay) — exact model (called out per the brief)

- **Fee:** **5%** transaction fee at time of charge, no monthly/upfront fee. Lower fees / flat monthly rates available for high-volume accounts (email glen@extensionpay.com). It is a **layer on top of Stripe**: funds are paid **directly to your own Stripe account**, your data is stored in Stripe so you can migrate away. So the all-in cost is **5% (ExtPay) + Stripe's 2.9%+30¢**.
- **Not an MoR:** because the sale settles into *your* Stripe, **you are the merchant of record and owe sales tax/VAT** yourself. This is the decisive negative vs. LS/Paddle/Polar/Gumroad.
- **How a payment is associated with an extension user:** there is **no license key**. Identity is the user's **email via a magic login link**. Paid status is stored on **extensionpay.com**, keyed to your **registered extension ID + the user's email**. On reinstall or a new browser/device, the user clicks "log in" → magic link email → paid features reactivate.
- **How the extension checks paid status:** call **`extpay.getUser()`**, which **makes a network call to extensionpay.com** and returns a user object: `user.paid` (boolean), `user.paidAt` (Date|null), `user.email`, `user.plan`, plus subscription fields. There is **no documented offline cache** — `getUser()` hits the network each time and can throw on network failure. Events: `extpay.onPaid.addListener(...)` fires on pay or login.
- **Does the extension have to call extensionpay.com?** **Yes.** The library "only communicates with ExtensionPay.com servers to manage users' paid status." You must allow that origin in CSP (`connect-src https://extensionpay.com`); Firefox additionally may need `https://extensionpay.com/*` in permissions; content-script callbacks need a content script matching `https://extensionpay.com/*`.
- **Integration:** `ExtPay('your-extension-id')`, call `extpay.startBackground()` once in the service worker, then `extpay.getUser()` / `extpay.openPaymentPage()`. Minimum manifest permission is just `"storage"`.
- **Gotchas for Totem:** (1) not local-first — every paid check phones a third-party server; (2) no tax handling; (3) JS lib update cadence is slow (server side is still maintained); (4) for a *one-time lifetime* unlock the email-magic-link model means a user with no network can't verify Pro.

---

## 3. Recommendation for Totem

**Primary pick: Polar (polar.sh).**
**Fallback: Lemon Squeezy.**

**Why Polar:**
1. **MoR = tax is fully handled.** Solo dev never registers/remits VAT/GST anywhere — Polar is the legal seller. Directly satisfies "minimal ops + tax handled."
2. **Cheapest of the MoRs.** On a $19 sale: ~$1.16 net fee at Pro (3.8%+40¢) or ~$1.45 at the free 5%+50¢ tier — vs Gumroad's ~$2.40. More margin on a low-price one-time unlock.
3. **License-key model fits local-first + OSS perfectly.** Polar issues a license key as a purchase benefit, and its **public validate endpoint `POST /v1/customer-portal/license-keys/validate` requires no authentication and is explicitly documented as safe for public clients (desktop/mobile/extension).** That means the extension can validate the key **without embedding any secret** — which is essential because Totem's source is public. The extension validates once, caches the "Pro = true" result + key in `chrome.storage.local`/IndexedDB, and runs offline thereafter, re-checking occasionally. No Totem server required.
4. **Modern, type-safe `@polar-sh/sdk` + hosted checkout + webhooks.** Minimal integration surface.

**Why not the others as primary:**
- **ExtPay:** easiest to wire, but **not an MoR** (you owe tax) and forces a **hard runtime dependency on extensionpay.com** for every paid check — antithetical to local-first, and an extra third-party origin in the trust chain for a privacy-positioned OSS product.
- **Raw Stripe / Payment Links:** **not an MoR** — tax becomes your problem in every country, and you'd have to build your own license server. Stripe Managed Payments (their MoR) adds ~+3.5%.
- **Gumroad:** clean MoR + license keys, but **10%** is the highest fee and the UX reads "creator marketplace," not "software license."
- **Paddle:** solid MoR, but weaker first-class license-key DX for indie one-time sales and heavier onboarding.

**Why Lemon Squeezy as fallback (not primary):** it's the most battle-tested license API (validate/activate/deactivate, key-only, cacheable) and a true MoR — an excellent fit — but it's **pricier than Polar** (5%+50¢, $100 min payout) and now sits inside **Stripe's MoR transition** (Feb 2026 Managed Payments preview + LS migration path). If Polar's youth/feature-gaps become a problem, LS is the safe, mature swap.

**Pricing note for the $14 founders / $19 list:** all MoR fees scale fine at this price; the per-transaction fixed component (40–50¢) is the bigger relative bite on a sub-$20 product, which again favors Polar's lower fixed fee.

---

## 4. Integration sketch — Polar in an MV3 extension

**Goal:** sell a one-time $19 "Totem Pro" product in Polar, issue a license key, validate it from the extension with no secret, cache the result locally (local-first).

**A. Polar dashboard (one-time setup, no code):**
- Create org → create a **one-time product** "Totem Pro — $19" ($14 founders coupon).
- Add the **License Key** benefit to the product (auto-issues a key on purchase).
- Grab the **organization ID** (public, used only to scope validation) and a hosted **Checkout Link**.

**B. Selling:** From the extension's upgrade UI, open the Polar **hosted checkout** in a new tab (`chrome.tabs.create({ url: checkoutLink })`). Polar collects payment, remits tax as MoR, and emails the buyer their license key + a customer-portal link. No checkout code or PCI surface in the extension.

**C. Entering the key:** The Pro settings panel has a "Enter license key" input. User pastes the key from the email.

**D. Validation (no secret, public endpoint):**
```js
// runs in the service worker; no API key embedded — safe for public/OSS code
async function validateProKey(licenseKey) {
  const res = await fetch('https://api.polar.sh/v1/customer-portal/license-keys/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: licenseKey,
      organization_id: TOTEM_ORG_ID, // public scoping value, not a secret
    }),
  });
  if (!res.ok) return { valid: false };
  const data = await res.json();           // { status, key, ... }
  return { valid: data.status === 'granted', data };
}
```

**E. Local-first caching (the important part):**
- On a successful validate, store `{ pro: true, key, validatedAt }` in `chrome.storage.local` (and mirror the flag into Zustand state). Gate Pro features (MD/CSV/JSONL export, deleted-tweet preservation, bulk ops, advanced filters, annotations, thread capture) on this flag.
- The extension reads the **local flag** on every launch — **fully offline**. It only re-hits Polar's validate endpoint **occasionally** (e.g., once every N days, or on user "Re-check license") to confirm the key wasn't refunded/revoked. A failed network re-check should **not** instantly revoke Pro (grace period) — keeps it local-first and resilient.

**F. manifest.json (MV3) needs:**
```json
{
  "permissions": ["storage"],
  "host_permissions": ["https://api.polar.sh/*"]
}
```
- `host_permissions` (or a `connect-src https://api.polar.sh` if you ship an explicit CSP) so the service worker can `fetch` the validate endpoint.
- `tabs` only if you use `chrome.tabs.create` for checkout (or just use a normal link / `window.open`).
- No client secret anywhere — the public validate endpoint + public org ID are the only Polar values in the (public) source.

**G. Where the key lives:** the **license key string** in `chrome.storage.local`; the derived **`pro` boolean + validatedAt** alongside it (and in Zustand for runtime). Nothing sensitive, nothing server-side, no Totem backend.

**Optional hardening:** add a Polar **webhook** (`order.created` / `benefit_grant.created`) to a tiny serverless function only if you later want server-side analytics or to pre-bind keys — **not required** for the core unlock, keeping the no-server ethos intact.

---

## Sources
- ExtensionPay home (5% fee, Stripe payout, one-time support): https://extensionpay.com/
- ExtensionPay — CWS payments replacement / 5% context: https://extensionpay.com/articles/extensionpay-is-the-chrome-web-store-payments-replacement
- ExtPay GitHub (library, no-server, methods): https://github.com/Glench/ExtPay
- ExtPay README (manifest, getUser network call, magic-link model): https://raw.githubusercontent.com/Glench/ExtPay/master/README.md
- Stripe fees + MoR clarification (you are MoR with Payment Links; Managed Payments ~+3.5%): https://dodopayments.com/blogs/stripe-fees-calculator and https://freemius.com/blog/stripe-transaction-fees-real-cost/
- Stripe local payment methods pricing: https://stripe.com/pricing/local-payment-methods
- Stripe acquires Lemon Squeezy (2024): https://www.lemonsqueezy.com/blog/stripe-acquires-lemon-squeezy and https://techcrunch.com/2024/07/26/stripe-acquires-payment-processing-startup-lemon-squeezy/
- Lemon Squeezy 2026 update / Stripe Managed Payments migration path: https://www.lemonsqueezy.com/blog/2026-update
- Lemon Squeezy pricing (5%+50¢, surcharges): https://www.lemonsqueezy.com/pricing
- Lemon Squeezy License API (validate endpoint, no Authorization header, instance_id): https://docs.lemonsqueezy.com/api/license-api/validate-license-key and https://docs.lemonsqueezy.com/api/license-api/activate-license-key
- Lemon Squeezy refunds/chargebacks ($15 dispute fee): https://docs.lemonsqueezy.com/help/payments/refunds-chargebacks
- Lemon Squeezy payouts ($100 min, 14th/28th): https://docs.lemonsqueezy.com/help/affiliates-for-merchants/payouts
- Paddle fees (5%+50¢ MoR) review: https://dodopayments.com/blogs/paddle-review and https://dev.to/onsen/paddle-review-2026-pros-cons-pricing-explained-4cgk
- Polar pricing (tiered 2026, 5%+50¢ free / 3.8%+40¢ Pro): https://polar.sh/resources/pricing and https://dodopayments.com/blogs/polar-sh-review
- Polar fees doc (intl +1.5%, $15 chargeback, payout fees): https://polar.sh/docs/merchant-of-record/fees
- Polar is an MoR (statement): https://x.com/polar_sh/status/1917551367247241542
- Polar license keys benefit + SDK: https://polar.apidocumentation.com/documentation/features/benefits/license-keys and https://www.npmjs.com/package/@polar-sh/sdk
- Polar validate endpoint — **no auth, safe for public clients**: https://polar.sh/docs/api-reference/customer-portal/license-keys/validate
- Gumroad fees (10%+50¢) + MoR since Jan 1 2025: https://checkoutpage.com/blog/gumroad-fees and https://www.swell.is/content/gumroad-pricing
- Gumroad license keys: https://gumroad.com/help/article/76-license-keys
- MoR comparison (Polar vs LS vs Paddle, payouts, chargebacks): https://www.buildmvpfast.com/blog/lemon-squeezy-vs-polar-paddle-merchant-of-record-2026 and https://veloxthemes.com/blog/polar-vs-lemonsqueezy-vs-gumroad
