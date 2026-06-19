# Totem Pro — Chrome Web Store Policy + Freemium Paywall UX Research

**Researcher:** Market research subagent
**Date:** 2026-06-19
**Scope:** (A) Chrome Web Store / MV3 policy for shipping a paid extension, and (B) freemium paywall UX that converts for privacy-conscious / anti-subscription / local-first audiences.
**Subject product:** Totem — MV3, local-first, currently free + open source. Goal is a $19 one-time lifetime unlock (founders $14) gating export, deleted-tweet preservation, bulk ops, advanced filters, annotations, thread-aware capture. No Totem server today; license validation would be the first outbound network call to a Totem-controlled endpoint (or a third-party processor).

---

## PART A — Chrome Web Store / MV3 compliance

### A1. In-app / native Web Store payments are dead — you MUST use an external processor

- Chrome Web Store's built-in payments (the "Chrome Web Store Payments" / Google Wallet-for-extensions API and `chrome.payments`) were **deprecated and fully shut down on 1 February 2021.** There is no native, Google-provided in-extension purchase flow anymore. ([groups.google.com/chromium-extensions — deprecation thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/5ytB3XWuA8I), [ExtensionKit summary](https://extensionkit.io/blog/payments-deprecation/))
- Consequence: **all billing, tax/VAT, refunds, and license management must run through an external payment processor and your own (or a third party's) infrastructure.** Commonly used: Stripe, Paddle/Lemon Squeezy (merchant-of-record handles VAT), Gumroad, or the extension-specific wrapper **ExtensionPay (`extpay`)**. ([Dodo Payments — monetize a Chrome extension 2026](https://dodopayments.com/blogs/monetize-chrome-extension), [ExtensionPay](https://extensionpay.com/articles/extensionpay-is-the-chrome-web-store-payments-replacement), [AverageDevs — monetize 2025](https://www.averagedevs.com/blog/monetize-chrome-extensions-2025))
- The **Chrome Web Store Developer Agreement** explicitly allows charging fees but makes the **developer solely responsible for all transactions, tax, and chargebacks.** Free trial versions with an upsell to a full version are **explicitly permitted/encouraged.** ([CWS Developer Agreement / Terms](https://developer.chrome.com/docs/webstore/program-policies/terms))

**Implication for Totem:** The purchase flow happens off-extension — a checkout page on `usetotem.xyz` (or processor-hosted). For a one-time lifetime unlock, a merchant-of-record (Paddle/Lemon Squeezy) removes the global-tax burden vs. raw Stripe. The extension only ever *reads back a license result*.

### A2. MV3 "no remotely hosted code" — fetching a license is FINE; executing fetched code is NOT

This is the single most important architectural constraint, and the good news is it does **not** block license validation.

**Exact policy wording** ([CWS Program Policies — Additional Requirements for MV3](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)):

> "The full functionality of an extension must be easily discernible from its submitted code, unless otherwise exempt."

Prohibited (these count as Remotely Hosted Code / RHC violations):
- "Including a `<script>` tag that points to a resource that is not within the extension's package"
- "Using JavaScript's `eval()` method or other mechanisms to execute a string fetched from a remote source"
- "Building an interpreter to run complex commands fetched from a remote source, even if those commands are fetched as data"

**Explicitly allowed** (same policy page):
- "Syncing user account data with a remote server"
- "Fetching a remote configuration file for A/B testing or determining enabled features, where all logic for the functionality is contained within the extension package"
- "Fetching remote resources that are not used to evaluate logic, such as images"
- "Performing server-side operations with data (such as for the purposes of encryption with a private key)"

**Definition of RHC** ([CWS — Deal with remote hosted code violations](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)):

> "Remotely hosted code, or RHC, is what the Chrome Web Store calls anything that is executed by the browser that is loaded from someplace other than the extension's own files. Things like JavaScript and WASM. It *does not* include data or things like JSON or CSS."

**What this means for the license check:**
- A network call that returns **JSON** ("is this license key valid? → `{valid: true, tier: 'pro', features: [...]}`") is **data, not code — fully compliant.** The Chrome docs literally name "determining enabled features" via a fetched remote config as an allowed pattern.
- The **gating logic must live inside the shipped extension** — i.e., the extension decides "if `tier === pro`, enable export." You must NOT fetch a JS blob that *implements* export, NOR build a mini-interpreter that runs server-sent commands.
- Practical, compliant license design: extension sends a license key / token to your endpoint (or to the processor's verify endpoint, or ExtensionPay's API) → endpoint returns signed JSON (ideally a signed token / JWT or Ed25519-signed payload so the result can be cached and offline-verified) → extension stores the entitlement in `chrome.storage.local` and flips local feature flags. All feature code is already in the package and merely toggled. This satisfies "full functionality discernible from submitted code."

**Reviewer-facing nuance:** even allowed remote communication "must still be possible to determine the full functionality of your extension and the interaction must still comply with user data policies." Keep the request/response minimal and documented.

### A3. Single-purpose policy — adding Pro features must not broaden the purpose

- Extensions must have a **single, narrow purpose.** "Extensions are assumed to utilize each of the permissions they request," and "excessive permissions unrelated to an extension's single purpose … will be viewed as enabling unrelated functionalities, resulting in a policy violation." ([CWS Program Policies — overview](https://developer.chrome.com/docs/webstore/program-policies/policies))
- New-tab override extensions get **extra scrutiny** — Google updated the **Quality Guidelines FAQ on 22 Jan 2025** specifically to clarify how the Single Purpose Policy applies to **new tab pages** (vertical vs. horizontal functionality). Totem already overrides the new tab; the Pro features (export, annotations, preservation, search filters, bulk ops) are all **the same single purpose** — "reading/searching/exporting your X bookmarks" — so they're safe *as long as the framing stays "bookmark management"* and you don't, e.g., bolt on an unrelated AI chat or a second product. ([CWS policy updates 2025](https://developer.chrome.com/blog/cws-policy-updates-2025), [Quality Guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq))
- **Action:** the single-purpose description in the Privacy practices tab should describe the whole feature set (free + pro) as one coherent purpose. Don't list "monetization" as a purpose.

### A4. Privacy policy + data-use disclosures triggered by the new license network call

Adding any outbound call that includes user-identifiable data (email, license key, possibly account identifier) interacts with the **Limited Use** and **User Data** policies and the **Privacy practices tab.**

**Privacy practices tab — required fields** ([CWS — Fill out the privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)):
1. **Single purpose description.**
2. **Permission justification** — one justification per requested permission and per host permission. ("The tab lets you state what the extension is for and list/justify its permissions.")
3. **Remote code declaration** — must declare whether the extension uses remote code. For Totem the honest answer is **No** (license response is data, not code) — declaring No correctly is important and defensible.
4. **Data usage disclosure checkboxes** — first group: which data types are collected (e.g., *personally identifiable information* like email, *authentication information*, *website content*). Second group: certifications.
5. **Three Limited-Use certifications** — certify you (a) do not sell user data / use it for unrelated purposes, (b) do not use/transfer data for ads or creditworthiness, (c) limit use to disclosed practices.
6. **Privacy policy URL** — required; must be consistent with the URL on the developer account. ("Your disclosures … should be consistent with the existing privacy policy URL that you provided.")

**Limited Use policy** ([CWS — Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)):
> "Limit your use of user data to providing or improving your single purpose." Data sharing with third parties is only allowed where necessary for the purpose, legal compliance, or with explicit consent. Banned: personalized ads, selling to data brokers, creditworthiness.

> "The privacy policy must, together with any in-Product disclosures, comprehensively disclose how your Product collects, uses and shares user data and all parties the user data will be shared with."

**Implication for Totem (currently has no server / no PII collection):**
- Adding a license check that transmits an **email + license key to a payment processor and/or a Totem endpoint** changes the data-collection answer from "none" to "personally identifiable information + authentication information." The Privacy practices disclosures and the privacy policy on `usetotem.xyz` **must be updated to name Stripe/Paddle/ExtensionPay (or whoever) as a third party** that receives the license/email data, and to state it is used solely for license validation — not for ads, not sold.
- Keep bookmark content **out** of the license call. Totem's whole pitch is local-first; the license payload should be license-key/email only, never bookmark data. This keeps "web browsing activity / website content" *not transmitted*, preserving the strongest privacy claim.

### A5. Permissions + CSP for the license endpoint

- The license endpoint host must be reachable. Two options:
  - **`host_permissions`** entry for the endpoint domain (e.g. `https://api.usetotem.xyz/*`) if you call it from a content script / need broad access, **or**
  - Simpler/cleaner: call it from the **service worker via `fetch()`**, which under MV3 is governed by `connect-src`-style network access but generally does **not** require a `host_permissions` grant for a plain `fetch` to your own HTTPS API from the background context (no extra host permission needed for cross-origin `fetch` from the service worker). Prefer this to avoid adding scary host-permission warnings.
- Any host permission you DO add must be **justified in the Privacy practices tab** and tied to the single purpose; unjustified/broad host permissions are a top rejection reason. Do not request `<all_urls>` for a license check — scope to the exact license host.
- If you use a strict `content_security_policy`, the `extension_pages` policy controls `connect-src`; ensure the license host is permitted there if you tighten CSP.

### A6. Paywalling / free-trial / "limited functionality" rules

- There is **no rule against gating features behind payment.** Free trials + upsell to a full version are **explicitly allowed/encouraged.** ([CWS Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms))
- The binding constraints are **honesty / anti-deception**, not the existence of a paywall:
  - **Deceptive Installation Tactics** policy: you must not gate *advertised* features behind unrelated actions, must not use misleading CTAs, and must "clearly state" the product's features in marketing. Translation: the Web Store listing and any install-time copy must **truthfully say what's free vs. what costs money.** ([CWS — Deceptive Installation Tactics](https://developer.chrome.com/docs/webstore/program-policies/deceptive-installation-tactics))
  - **"No cheating … by misleading users …"** — from Best Practices; misrepresenting what the extension does (including pretending a paid thing is free or vice versa) risks a ban. ([CWS — Best Practices](https://developer.chrome.com/docs/webstore/program-policies/best-practices))
- **Action:** the store listing must disclose that Totem is free with an **optional one-time Pro unlock**, and list which features are Pro. Don't advertise "export your bookmarks!" as a headline benefit and then reveal at the moment of use that it's paid without prior disclosure — that edges toward the deceptive-tactics line. (You *can* gate export behind Pro; you just have to have been upfront that export is a Pro feature.)

### A7. CWS COMPLIANCE CHECKLIST — shipping Totem Pro

**Payments / architecture**
- [ ] Use an external processor (Paddle/Lemon Squeezy as merchant-of-record recommended for one-time + global VAT; or Stripe + your own tax handling; or ExtensionPay wrapper). No native CWS payments.
- [ ] Checkout happens off-extension (web page / processor-hosted), not inside the extension UI flow that pretends to be a native purchase.
- [ ] License validation returns **JSON/data only** (signed token preferred). No fetched JS/WASM, no `eval`, no server-command interpreter.
- [ ] All Pro feature *logic* ships inside the extension package; the license result only flips local feature flags. (Satisfies "full functionality discernible from submitted code.")
- [ ] Prefer offline-verifiable signed license (Ed25519/JWT) cached in `chrome.storage.local` so Pro keeps working offline — reinforces local-first and avoids a hard server dependency.

**Single purpose / permissions**
- [ ] Pro features stay within the existing single purpose (bookmark reading/search/export/preservation). No unrelated functionality.
- [ ] License call made from the service worker via `fetch` to a **narrowly scoped** host; avoid `<all_urls>`; add `host_permissions` only if strictly necessary and justify it.
- [ ] If CSP is tightened, allow the license host in `connect-src` of `extension_pages`.

**Privacy / data**
- [ ] Update the **Privacy practices tab**: single-purpose description (free+pro as one purpose), per-permission justifications, remote-code = **No**, data-collected checkboxes now include **PII (email) + authentication info (license key)**, and the **3 Limited-Use certifications**.
- [ ] Update the **privacy policy** on `usetotem.xyz` to disclose: license/email sent to <processor> for validation; not sold, not used for ads; bookmark data never transmitted.
- [ ] Keep the Limited-Use affirmative statement and ensure the privacy-policy URL matches the developer-account URL.
- [ ] Ensure no bookmark/browsing content is included in the license request (preserve "no web browsing activity transmitted").

**Listing / honesty**
- [ ] Store listing clearly states: free core + optional **one-time** Pro unlock; lists which features are Pro.
- [ ] No misleading CTAs; don't gate an *advertised headline* feature without prior disclosure (Deceptive Installation Tactics).
- [ ] No nagging/forced-action dark patterns at install (see Part B).

---

## PART B — Freemium paywall UX for privacy / anti-subscription / local-first audiences

### B1. The macro data: where one-time vs. subscription and soft vs. hard gates land

- **RevenueCat 2026 benchmark (115k+ apps, $16B revenue):** hard paywalls convert ~**10.7%**, freemium ~**2.1%.** Hard gates win per-user economics; freemium wins on volume/word-of-mouth. **Trial-format screens beat visual-only paywalls in 64.5% of experiments.** ([Airbridge — hard vs soft paywalls](https://www.airbridge.io/en/blog/hard-vs-soft-paywalls), [Airbridge — hard paywall vs freemium 2026](https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026))
- **But Totem's audience is the exception that breaks the funnel-maximizing playbook.** For privacy/local-first/anti-subscription communities (r/selfhosted, r/nosurf, HN), the open-source + free-core + *optional one-time* model is itself the trust signal. A pure hard paywall would nuke the goodwill that makes these communities *evangelize* a tool. The right model here is **freemium with a generous free core + a one-time unlock**, optimized not for raw % conversion but for **trust-preserving conversion + word-of-mouth.**
- **The conversion lever that matters most: the "wow moment" before the ask.** Totango: users who achieve at least one meaningful outcome are **5x more likely to convert.** Show the upgrade prompt only after the user has felt value. ([Userpilot — freemium conversion](https://userpilot.com/blog/freemium-conversion-rate/), [GetMonetizely — paywall timing](https://www.getmonetizely.com/articles/mastering-freemium-paywalls-strategic-timing-for-saas-success))

### B2. The reference model: Obsidian (the gold standard this audience already trusts)

- Plain Markdown files on device, **no account, no cloud dependency, no telemetry, no data sold.** Paid add-ons (Sync/Publish) are optional; the **Catalyst license is a one-time payment framed as a "tip jar"/support-the-developers** with perks (early betas, badge). This is repeatedly cited as "one of the most honest pricing models in productivity software." ([Robin Landy — Obsidian pricing strategy](https://www.robinlandy.com/blog/obsidian-as-an-example-of-thoughtful-pricing-strategy-and-the-power-of-product-tradeoffs), [eesel — Obsidian pricing 2025](https://www.eesel.ai/blog/obsidian-pricing), [obsidian.md/pricing](https://obsidian.md/pricing))
- **Lesson for Totem:** lean into the same posture — "your data stays local, the app stays free and open source, Pro is a one-time unlock that funds the work." Frame Pro partly as *support*, not just *feature ransom*. The one-time (not subscription) structure is the single biggest trust-aligner with this crowd.

### B3. Anti-patterns that trigger backlash in these communities (the DON'T list)

From dark-patterns / deceptive-UX research ([NN/g — deceptive patterns](https://www.nngroup.com/articles/deceptive-patterns/), [TechCrunch — FTC dark-patterns study 2024](https://techcrunch.com/2024/07/10/ftc-study-finds-dark-patterns-used-by-a-majority-of-subscription-apps-and-websites/), [Arounda — dark pattern examples](https://arounda.agency/blog/dark-patterns-examples)):

- **Nagging.** Repeated upgrade pop-ups after the user declined = the #1 anger trigger; people mute, uninstall, and post screenshots. **One contextual prompt, dismissible, that stays dismissed.**
- **Crippleware / bait-and-switch on existing free features.** Taking a feature that's *currently free* (Totem already ships export-ish, search, sync) and moving it behind Pro for existing users feels like theft. **Grandfather current free features; only gate genuinely new Pro capabilities, or clearly new/enhanced versions.**
- **Forced action / fake "free trial" that demands a card up front.** This crowd reads a card-required trial as a trap. If you trial Pro, make it **no-card** or just use a generous free tier instead.
- **Dark-pattern checkout** (hidden recurring charge, pre-checked add-ons, confusing "cancel"). For a one-time purchase this is mostly avoided — *but make crystal clear it is one-time, not a sub.*
- **Surprise paywall at the moment of need with no prior disclosure** (also a CWS deceptive-tactics risk, A6).
- **Telemetry/"phone home" creep.** Any new network call is scrutinized. Be loud that the license check sends only email+key, never bookmarks; ideally make it offline-verifiable.
- **Manipulative urgency/scarcity** ("only 3 left!") — reads as scammy to a technical audience. The founders price is fine *if framed honestly* ("$14 founders price, going to $19" — a real, time-boxed thing, not a fake countdown).

### B4. The DO list — patterns that convert without backlash

- **Soft gates with lock badges, not walls.** Show the Pro features *in the UI*, visible but with a small lock/"Pro" badge, so users see what they'd get. Visible-but-locked teases create "something concrete to miss." ([Demogo — feature gating](https://demogo.com/2025/06/25/feature-gating-strategies-for-your-saas-freemium-model-to-boost-conversions/), [Appcues — free-to-paid](https://www.appcues.com/blog/free-to-paid-conversion))
- **"Try before you buy" via a free allowance, not a time bomb.** Let users **export the first N bookmarks free** (e.g., 25 rows of CSV/Markdown), preview the full export, then unlock unlimited. They feel the value on *their own data* before paying. This is the highest-trust analog of a trial for a one-time product. ([Rework — freemium model design 2026](https://resources.rework.com/libraries/saas-growth/freemium-model-design), [Appcues](https://www.appcues.com/blog/free-to-paid-conversion))
- **Contextual prompt at the moment of value, exactly once.** The upgrade ask appears *when the user reaches for the locked capability* (clicks Export, selects 50 bookmarks for a bulk op, opens a deleted-tweet they'd lose). This is the documented highest-intent moment. ([GetMonetizely](https://www.getmonetizely.com/articles/mastering-freemium-paywalls-strategic-timing-for-saas-success), [Airbridge — paywall setup](https://www.airbridge.io/en/blog/set-up-a-simple-paywall-flow))
- **Honest "what you're paying for" framing — solve the "no server, why does it cost money?" objection head-on.** Because there are no server costs, naive users may ask "what am I paying for?" Answer it in the paywall copy: *"You're paying for the work, not a subscription — Totem stays free and open source. Pro is a one-time unlock that funds ongoing development. Your data never leaves your machine."* Tie price to **outcomes** (own your archive forever, never lose a deleted tweet), not to infra.
- **Reverse-trial option (optional):** give new installs a short window where Pro is fully on, then drop to free. Exposure to Pro creates a concrete thing to upgrade *back* to. Only do this **no-card.** ([Appcues — reverse trial](https://www.appcues.com/blog/free-to-paid-conversion))
- **Status / support framing** (Obsidian Catalyst): a small "Founding supporter" badge or changelog credit makes Pro feel like patronage, not extortion. ([Robin Landy](https://www.robinlandy.com/blog/obsidian-as-an-example-of-thoughtful-pricing-strategy-and-the-power-of-product-tradeoffs))
- **Trial-format / value-first screen beats a bare price wall** (64.5% win rate in experiments) — i.e., a screen that shows what Pro does + the free allowance result, not just "$19, pay now." ([Airbridge — hard vs soft](https://www.airbridge.io/en/blog/hard-vs-soft-paywalls))

### B5. Recommended in-product upgrade MOMENT(S) for Totem

Ranked by intent. Each fires **once, contextually, dismissible**, after the user has felt value:

1. **At export, after a free preview.** User clicks "Export → Markdown/CSV/JSONL." Let them export/preview the **first ~25 items free**, show the full count behind a soft gate: *"Export all 3,412 bookmarks → Unlock Pro ($14 founders / $19)."* Highest intent: they're actively trying to get their data out. **Primary moment.**
2. **When a deleted/unavailable tweet is opened.** Totem can show the user it *preserved* something X removed: *"This tweet was deleted on X. Totem kept your copy. Pro preserves every deleted bookmark automatically."* This is an emotional, unique-value moment (loss aversion) — very strong for this audience. **Secondary moment.**
3. **On a bulk operation.** User multi-selects (e.g., 50 bookmarks) to tag/delete/move: *"Bulk actions are a Pro feature."* They've already invested effort selecting — high intent.
4. **On advanced search filter use.** User opens filters (by date/author/media/folder): show the filters with a lock badge; selecting one prompts upgrade.
5. **On first annotation.** User tries to add a note/highlight to a bookmark.

**Cross-cutting placement rules:** one persistent, quiet "Upgrade to Pro" / "Support Totem" entry in settings or a corner (always available, never a pop-up); never auto-popup on new-tab load; never re-prompt the same context after dismissal in a session; always state **one-time, not subscription** and **data stays local** in the prompt.

### B6. Presenting the $19 one-time unlock without feeling scammy — copy/structure

- **Headline the model, not the price:** "Totem Pro — one-time unlock. No subscription. Ever." (subscription-fatigue is the documented pain point for this crowd — [Yahoo/Android subscriptions](https://tech.yahoo.com/articles/why-many-android-apps-monthly-091110226.html), [Blind thread](https://www.teamblind.com/post/how-did-subscription-model-phone-apps-become-the-norm-ef1hmum1)).
- **Pre-empt the "no server, why pay?" question** with the funds-the-work / stays-open-source line (B4).
- **Founders price done honestly:** "$14 founders price (rising to $19)" — real and time-boxed, no fake countdown timers or "3 left."
- **Reassure on the license check:** small line near checkout — "Pro is verified by a one-time license check (email + key only). Your bookmarks never leave your device."
- **Receipt of ownership:** make the license restorable across machines via the key/email; "buy once, use on all your browsers" reinforces *ownership*, the core anti-subscription value.

---

## Sources

Chrome Web Store / MV3 policy:
- [CWS — Additional Requirements for Manifest V3 (RHC wording)](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [CWS — Deal with remote hosted code violations (RHC definition + allowed data fetch)](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
- [CWS — Improve extension security (MV3 background)](https://developer.chrome.com/docs/extensions/develop/migrate/improve-security)
- [CWS — Program Policies overview (single purpose / permissions)](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [CWS — Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [CWS — Fill out the privacy fields (Privacy practices tab)](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [CWS — Updated Privacy Policy & Secure Handling (User Data FAQ)](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [CWS — Disclosure Requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)
- [CWS — Deceptive Installation Tactics](https://developer.chrome.com/docs/webstore/program-policies/deceptive-installation-tactics)
- [CWS — Best Practices ("no cheating / misleading users")](https://developer.chrome.com/docs/webstore/program-policies/best-practices)
- [CWS — Developer Agreement / Terms (charging fees, trials/upsell allowed)](https://developer.chrome.com/docs/webstore/program-policies/terms)
- [CWS — Policy updates blog, Jan 2025 (new-tab single purpose, appeals)](https://developer.chrome.com/blog/cws-policy-updates-2025)
- [CWS — Quality Guidelines FAQ](https://developer.chrome.com/docs/webstore/program-policies/quality-guidelines-faq)
- [groups.google chromium-extensions — CWS Payments deprecation thread](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/5ytB3XWuA8I)
- [ExtensionKit — Chrome Web Store Payments Deprecation](https://extensionkit.io/blog/payments-deprecation/)
- [ExtensionPay — Web Store Payments replacement](https://extensionpay.com/articles/extensionpay-is-the-chrome-web-store-payments-replacement)
- [Dodo Payments — How to Monetize a Chrome Extension 2026](https://dodopayments.com/blogs/monetize-chrome-extension)
- [AverageDevs — Monetize Chrome Extensions 2025](https://www.averagedevs.com/blog/monetize-chrome-extensions-2025)

Freemium paywall UX / community sentiment:
- [Airbridge — Hard vs Soft Paywalls (RevenueCat 2026 benchmarks)](https://www.airbridge.io/en/blog/hard-vs-soft-paywalls)
- [Airbridge — Hard Paywall vs Freemium 2026](https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026)
- [Airbridge — Paywall Setup Guide](https://www.airbridge.io/en/blog/set-up-a-simple-paywall-flow)
- [Userpilot — Freemium Conversion Rate guide](https://userpilot.com/blog/freemium-conversion-rate/)
- [GetMonetizely — Paywall timing for SaaS](https://www.getmonetizely.com/articles/mastering-freemium-paywalls-strategic-timing-for-saas-success)
- [Demogo — Feature Gating Strategies](https://demogo.com/2025/06/25/feature-gating-strategies-for-your-saas-freemium-model-to-boost-conversions/)
- [Demogo — Feature Gating Practical Models (Nov 2025)](https://demogo.com/2025/11/24/feature-gating-in-saas-practical-models-for-freemium-conversion-with-examples/)
- [Appcues — Free-to-Paid conversion (reverse trial, soft gate)](https://www.appcues.com/blog/free-to-paid-conversion)
- [Rework — Freemium Model Design 2026](https://resources.rework.com/libraries/saas-growth/freemium-model-design)
- [Stackmatix — Freemium-to-paid conversion](https://www.stackmatix.com/blog/freemium-to-paid-conversion)
- [NN/g — Deceptive (Dark) Patterns](https://www.nngroup.com/articles/deceptive-patterns/)
- [TechCrunch — FTC dark-patterns study 2024](https://techcrunch.com/2024/07/10/ftc-study-finds-dark-patterns-used-by-a-majority-of-subscription-apps-and-websites/)
- [Arounda — Dark Patterns examples](https://arounda.agency/blog/dark-patterns-examples)
- [Robin Landy — Obsidian thoughtful pricing strategy](https://www.robinlandy.com/blog/obsidian-as-an-example-of-thoughtful-pricing-strategy-and-the-power-of-product-tradeoffs)
- [eesel — Obsidian pricing 2025 (Catalyst tip-jar)](https://www.eesel.ai/blog/obsidian-pricing)
- [Obsidian — official pricing](https://obsidian.md/pricing)
- [dev.to — Why local-first / offline-first is the future](https://dev.to/bertrand_atemkeng/why-local-first-and-offline-first-software-is-the-future-7mf)
- [dev.to — Killed SaaS subscription, switched to lifetime deal](https://dev.to/ethannoww/why-i-killed-my-saas-subscription-model-12mo-and-switched-to-a-lifetime-deal-3p50)
- [Yahoo Tech — Why many Android apps want monthly subscriptions](https://tech.yahoo.com/articles/why-many-android-apps-monthly-091110226.html)
- [Blind — How did subscription apps become the norm](https://www.teamblind.com/post/how-did-subscription-model-phone-apps-become-the-norm-ef1hmum1)
