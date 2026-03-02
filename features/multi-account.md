# Multi-Account (Phase 4) UX Handoff

Status: deferred by design.  
Current runtime remains `single active account context` for reliability.

## Current State (Implemented)

- Account-scoped data storage exists (`totem_acct_<accountId>` DBs).
- Worker sync policy/locks are account-scoped.
- Account context is preserved for logged-out offline cache routing.
- Explicit multi-account UX (account picker/switcher) is not shipped yet.

## Phase 4 UX Goal

Provide explicit, predictable multi-account switching without data mixing and without breaking reliability guarantees from earlier phases.

## Proposed UX

1. Add an account switcher in the header (`avatar + @handle`).
2. Clicking opens an account panel listing known accounts:
   - `@handle`
   - cache status (`cached` or `empty`)
   - last sync time
   - current account badge
3. Row actions:
   - `Switch`
   - `Sync now`
4. Panel-level actions:
   - `Add account` (opens `https://x.com/i/bookmarks`)
   - `Manage local data`

## Behavior Rules

1. Switch is cache-first:
   - switch account context immediately
   - render that account’s local cache immediately
   - only then allow policy-driven background refresh (if enabled)
2. No data mixing:
   - bookmarks, details, and reading progress remain account-scoped
3. In-flight sync isolation:
   - switching foreground account must not cancel another account’s in-flight sync
4. Empty states are account-specific:
   - `No bookmarks for @account`
5. Offline states are account-specific:
   - `Showing cached bookmarks for @account`

## Settings UX (Future)

1. `Clear current account data`
2. `Clear all accounts data`
3. Show per-account local usage and account count

## Runtime Contract Notes

- Existing scaffold API is available for explicit account switch intent:
  - `SET_ACCOUNT_CONTEXT` runtime message
  - `setAccountContext(accountId)` core API helper
- Full UI wiring to this contract is pending.

## Suggested Implementation Order (When Resumed)

1. Account switcher UI + account list rendering
2. Wire switch intent to `SET_ACCOUNT_CONTEXT` + cache-first render
3. Per-account settings/reset controls

