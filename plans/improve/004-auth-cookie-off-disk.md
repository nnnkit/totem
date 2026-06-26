# F4 — Stop persisting the HttpOnly X session cookie to disk in plaintext

Planned at: 1ea034a0

## Problem
The webRequest capture in `src/service-worker/index.ts` writes the full captured
`cookie` header — including `auth_token`, which *is* the X session secret and is
HttpOnly — into `chrome.storage.local` (`totem_auth_headers`). That storage is
unencrypted and readable by the extension/anything with disk access. The cookie
header is largely redundant for actual auth because every proxied request already
uses `credentials: "include"` (api-proxy.ts), so the browser re-attaches the real
session cookie automatically at request time.

## Chosen approach (simplest correct, lowest-risk, behavior-preserving)
Redact sensitive session cookies (`auth_token`, plus other HttpOnly session
secrets like `auth_multi`, `kdt`) from the `cookie` header **before** it is
written to `chrome.storage.local`, at the single capture site in `index.ts`.

- Add a pure helper `redactSensitiveAuthCookies(cookieHeader)` in
  `src/lib/twitter-auth.ts` (it owns auth-header parsing). It strips the
  named secret cookies and returns the remaining cookie string.
- In `index.ts`, redact `headers["cookie"]` before storing `totem_auth_headers`.
  The auth-trio gate (`hasAuthTrio`) and userId extraction run on the *raw*
  captured headers, so logged-in detection is unaffected.

Why this over moving to `chrome.storage.session`:
- It removes the actual secret from disk (the stated threat), rather than just
  moving the full secret to a different store that the extension can still read.
- It is one pure function + one call site — no threading a second storage handle
  through api-proxy/auth/twitter-auth and their `onChanged` listeners (large,
  risky, test-churning). The existing suites keep validating behavior unchanged.

Behavior preserved:
- `twid` (→ userId) and `ct0` cookies are NOT HttpOnly and remain in the header,
  so `parseCapturedAuthHeaders` still finds `twid`/`ct0` and the `ct0===csrf`
  cross-check, `usableAuthHeaderUserId`, and the live-twid mismatch check all
  behave identically.
- `auth_token` is supplied live by `credentials: "include"` on the proxy fetch.

## Files touched
- `src/lib/twitter-auth.ts` — add `redactSensitiveAuthCookies` + `SENSITIVE_AUTH_COOKIES`.
- `src/service-worker/index.ts` — redact cookie before persisting auth headers.
- `src/lib/__tests__/twitter-auth.test.ts` — unit-test the redactor (drops
  auth_token, keeps twid/ct0, still parses via parseCapturedAuthHeaders).

## Verify
- `pnpm typecheck`
- `pnpm test src/lib/__tests__/twitter-auth.test.ts src/service-worker/__tests__/api-proxy.test.ts src/service-worker/__tests__/auth.test.ts`
