# Codebase deep-dive — UI State, Settings/Flags & Upsell Mount Points

Scope: how to model an `isPro` entitlement and where to mount Pro upsell UI, grounded
in existing Totem patterns. All paths relative to repo root `/Users/ankit/Documents/make/totem`.

There is currently **no** pro / entitlement / premium / license / paywall code in `src/`
(grep for `isPro|entitlement|premium|license|upgrade|paywall|lifetime|gumroad|founders`
returns only unrelated hits: `capability upgrade` in runtime-store tests, an IDB
`upgrade()` migration callback, and a Twitter feature flag `premium_content_api_read_enabled`
in `src/service-worker/api-proxy.ts:62`). This is a greenfield surface.

---

## 1. The existing pattern for a boolean user preference / flag

There are **two** established persistence patterns. They differ on storage area and
on whether the SW owns the value. For `isPro` we want the **preference pattern**, not
the runtime-snapshot pattern.

### Pattern A — Synced user preference (chrome.storage.**sync**) — the cleanest analog

This is the model `useSettings`/`useTheme` use, and it is the **closest analog to
`isPro`**: a user-scoped flag, set rarely, that should follow the user across devices.

- **Where defined / shape:** `src/types/index.ts:283` — `interface UserSettings { ... }`
  (all booleans like `showSearchBar`, `showOpenInTotem` live here). Defaults at
  `src/hooks/useSettings.ts:33` (`DEFAULT_SETTINGS`).
- **How persisted:** `chrome.storage.sync`, under a single namespaced key.
  Keys are centralized in `src/lib/storage-keys.ts`:
  - `SYNC_SETTINGS = "totem_settings"` (`storage-keys.ts:70`)
  - `SYNC_THEME = "totem_theme"` (`storage-keys.ts:71`)
  - both enumerated in `CHROME_SYNC_KEYS` (`storage-keys.ts:73`)
  - legacy key remap in `LEGACY_CHROME_SYNC_KEY_MAP` (`storage-keys.ts:115`)
- **How read reactively in components:** a hook with three effects (see
  `src/hooks/useSettings.ts:93-148` and the near-identical `src/hooks/useTheme.ts:23-106`):
  1. `useState` seeded with a hardcoded default.
  2. Load-once effect: guard `hasChromeStorageSync()` (`src/lib/chrome.ts:1`), then
     `chrome.storage.sync.get({ [KEY]: DEFAULT })`, normalize, `setState`.
  3. Cross-context reactivity effect: guard `hasChromeStorageOnChanged()`
     (`src/lib/chrome.ts:5`), subscribe to `chrome.storage.onChanged`, filter
     `areaName === "sync"` and the specific key, re-normalize `change.newValue`.
     This is what makes the flag update live across the new-tab page, reader route,
     and any other open Totem surface without a reload.
  4. An `updateX` setter that optimistically `setState`s and writes
     `chrome.storage.sync.set({ [KEY]: next })` (fire-and-forget `.catch(() => {})`).
- **Normalization discipline:** every loader runs a `normalizeX(value: unknown)`
  pass (`useSettings.ts:45`, `useTheme.ts:17`) so a malformed/old stored value can
  never crash a render. Any `isPro` reader must do the same.
- **Consumed in components:** `useSettings()` is called once high in the tree
  (`src/App.tsx:411` in `NewTabRouteApp`, `src/App.tsx:751` in `ReaderRouteApp`) and
  the values are threaded down as props (e.g. `showSearchBar={settings.showSearchBar}`
  to `NewTabHome`, `src/App.tsx:672`). `useTheme()` is called at `App.tsx:410`.

> **Caveat for `isPro`:** `chrome.storage.sync` is the right *ergonomic* analog, but
> it is trivially user-editable and synced by Google, so it is appropriate for an
> **optimistic UX flag** only. The authoritative entitlement check (license validation)
> must live behind a verification step, not be trusted purely from synced storage. See
> §4 for the recommended split (cached flag in storage + verify-on-load).

### Pattern B — One-time / lifecycle growth flags (chrome.storage.**local**)

`src/lib/growth-state.ts` is the analog for **"show this once, then never again"**
gating — directly relevant to a one-time post-install Pro nudge (§3c).

- **Shape:** `interface GrowthState` (`growth-state.ts:18`) with nested `onboarding`,
  `activation`, `review` namespaces, each holding `*At: number | null` timestamps
  (the "set once" idiom: `x ?? now`, e.g. `growth-state.ts:316`).
- **Persisted:** `chrome.storage.local` under `CS_GROWTH_STATE = "totem_growth_state"`
  (`storage-keys.ts:45`). Local (not sync) because it's device-lifecycle state.
- **Access:** module-level async functions, not a hook. `readGrowthState()`
  (`growth-state.ts:256`) and `mutateGrowthState(mutator)` (`growth-state.ts:244`),
  which does read → mutate → `chrome.storage.local.set`. Pure reducers
  (`applyBookmarksSynced`, `applyReaderOpen`) and pure predicates
  (`shouldShowReviewPrompt:205`, `shouldShowOnboarding:213`,
  `shouldShowReengagementNudge:227`) are exported and unit-tested independently
  (`src/lib/__tests__/growth-state.test.ts`).
- **Wired into UI imperatively from `App.tsx`:** e.g. review prompt at
  `App.tsx:805-813` (`recordReaderOpen → shouldShowReviewPrompt → markReviewPrompted →
  setState visible`), reengagement at `App.tsx:614-639`. The mark/dismiss handlers sit
  at `App.tsx:928-936` and `App.tsx:641-650`.

### Recommendation for the `isPro` flag

Model the **cached** entitlement exactly like `useTheme` (the simplest single-value
hook): one synced key, one normalize function, three effects, one setter. Model the
**"have we shown the upsell" / "license verified at"** bookkeeping like `growth-state.ts`
(local, set-once timestamps). Concretely:

- Add `SYNC_PRO = "totem_pro"` to `src/lib/storage-keys.ts` and to `CHROME_SYNC_KEYS`.
- Add an entitlement type to `src/types/index.ts` (e.g. `interface ProEntitlement {
  status: "free" | "pro"; licenseKey: string | null; unlockedAt: number | null;
  verifiedAt: number | null; }`).
- New hook `src/hooks/usePro.ts` mirroring `useTheme.ts` line-for-line.

---

## 2. Reusable Dialog/Modal primitives + the modal template

### The shared `Modal` wrapper (use this — do not hand-roll Base UI)

`src/components/ui/Modal.tsx` wraps `@base-ui/react/dialog` (`Dialog.Root` /
`Dialog.Portal` / `Dialog.Backdrop` / `Dialog.Popup`) into one component. It already
handles: portal, backdrop (`bg-black/50` passed via `className`), enter/leave animation
via `data-[starting-style]`/`data-[ending-style]` (`Modal.tsx:47-53`), title header +
close button (`Modal.tsx:59-84`), `aria-labelledby` wiring, backdrop-click and
Escape-to-close (`onOpenChange`, `Modal.tsx:40`), and a `closeDisabled` lock for
in-progress operations. Props: `open`, `onClose`, `title`, `titleId`, `panelClassName`,
`bodyClassName`, `closeLabel`, `closeDisabled` (`Modal.tsx:7-19`).

A Pro modal should pass `title="Upgrade to Totem Pro"`, `titleId="upgrade-title"`,
`className="bg-black/50"`, and (optionally) `panelClassName="max-w-lg"`.

### Best existing templates to clone

- **`src/components/OnboardingModal.tsx`** — the simplest, closest template for an
  upsell/paywall sheet: a `Modal` with prose blocks in bordered `rounded border
  border-border bg-surface` cards (`OnboardingModal.tsx:34-56`) and a right-aligned
  footer action row mixing `ghost` / `secondary` / primary `Button`s plus an `href`
  CTA (`OnboardingModal.tsx:71-81`). An "Upgrade to Pro" sheet is structurally this
  plus a feature-benefit list and a primary CTA `<Button href={CHECKOUT_URL}>`.
- **`src/components/ExportModal.tsx`** — the template for a **stateful** modal with
  internal phases. It drives a `quickState` discriminated union
  (`{ phase: "idle" | "exporting" | "done" | "error" }`, `ExportModal.tsx:30-34`) and
  renders one of several sub-views (`IdleView`, `DoneView`, `ErrorView`, …) inside a
  single `<Modal>` (`ExportModal.tsx:105-162`). Reuse this if the upgrade flow needs
  states (e.g. `idle → enter-license → verifying → success/error`). The radio-card
  selection block (`ExportModal.tsx:200-289`) is a ready-made pattern if a pricing
  modal ever offers tiers (lifetime vs founders).
- **`src/components/ImportModal.tsx`** — third example of the same stateful-modal idiom.

### Supporting primitives available

- `src/components/ui/Button.tsx` — variants `primary | secondary | ghost | destructive |
  accent-soft` (`Button.tsx:4-11`); the **`accent-soft`** variant
  (`bg-accent-surface text-accent`) is the natural "Upgrade" CTA tint. Supports `href`
  (renders `<a target="_blank">` for `https://` — ideal for an external checkout link,
  `Button.tsx:36-51`).
- `src/components/ui/Badge.tsx` — variants `accent` (filled) and `muted`
  (`Badge.tsx:3-6`). The `accent` badge is the ready-made **"PRO" lock badge** for
  gated buttons.
- `src/components/ui/Popover.tsx` (`PopoverContent` over `@base-ui/react/popover`) —
  for an inline "this is a Pro feature" tooltip/popover on a locked control.
- `src/components/ui/Toast.tsx`, `Switch.tsx`, `Select.tsx`, `Separator.tsx` round out
  the kit.

---

## 3. Where UI upsell surfaces would mount

### (a) "Upgrade" entry in Settings — primary surface

`src/components/SettingsModal.tsx` is a single `Modal` whose body is a stack of
`<section className="py-4 first:pt-0 last:pb-0">` blocks separated by
`divide-y divide-border` (`SettingsModal.tsx:147`). Sections today: Appearance (149),
Highlight/Open-in-Totem (193), New Tab (234), Storage (347).

- **Mount point:** add a new `<section>` (e.g. "Totem Pro" as the first section, or a
  dedicated row at the top of Storage right above Export at `SettingsModal.tsx:374`,
  since Export/CSV/Markdown is the headline gated feature). Use the same
  label + sub-label + right-aligned `Button` row shape already used for Import/Export
  (`SettingsModal.tsx:352-394`).
- For a **free** user: a row "Totem Pro — Unlock export formats, deleted-tweet
  preservation, bulk ops" + an `accent-soft` `Button` "Upgrade" that calls a new
  `onOpenUpgrade()` prop. For a **pro** user: same row showing a `Badge variant="accent"`
  "PRO" and "Manage license".
- **Prop wiring:** `SettingsModal` is fully prop-driven (`Props` at
  `SettingsModal.tsx:23-35`, callbacks like `onExport`/`onImport` threaded from
  `App.tsx:705-706`). Add `isPro: boolean` and `onOpenUpgrade: () => void` props, pass
  from `App.tsx:693-707` (right where `onExport`/`onImport` are passed).

### (b) Lock badge on gated buttons + intercepted clicks

Gated actions and their exact mount points:

- **Export** — two surfaces:
  - Settings row "Export your data" `Button` (`SettingsModal.tsx:383-394`). The
    sub-label already literally reads "Download your bookmarks as CSV, Markdown, and
    JSONL" (`SettingsModal.tsx:379`) — the headline Pro features. Render a
    `Badge variant="accent">PRO</Badge>` next to the label and, when `!isPro`, have
    the button call `onOpenUpgrade()` instead of `onExport()`.
  - New-tab "full export ready" / export entry points in `NewTabHome.tsx` (the
    `onOpenExport` callback is threaded through `NewTabHome` props at
    `NewTabHome.tsx:93`, used at `:1331`, `:1446`, `:1493`). Gating belongs at the
    `onOpenExport` boundary in `App.tsx:708-719` (where `<ExportModal>` is wired):
    swap the handler to open the upgrade modal for free users, OR keep the ExportModal
    open and gate the *format* choices inside it (the radio cards at
    `ExportModal.tsx:200-289` are the place — e.g. "Markdown/CSV" marked PRO).
- **Settings header toolbar** — the gear button lives in the new-tab header at
  `NewTabHome.tsx:1086-1095` (next to the Sync button `:1070-1085`). A small "Upgrade"
  pill or star icon-button could sit beside the gear here for an always-visible entry
  point. This `<header>`/toolbar (`NewTabHome.tsx:~1060-1097`) is the single most
  visible chrome on the new tab.
- **Reader gated features** (annotations, advanced highlight options) — `BookmarkReader`
  is rendered at `App.tsx:945-978`; highlight color is already a prop
  (`defaultHighlightColor`, `App.tsx:967`). Lock badges for annotation/thread-capture
  features mount inside `src/components/reader/` controls.

Implement gating with a `<ProGate>` wrapper (see §4) so each call site stays a
one-line change and the lock-badge + intercept logic isn't copy-pasted.

### (c) One-time post-install nudge

Reuse the `growth-state.ts` set-once idiom and the existing dismissible-banner
components verbatim:

- **Visual template:** `src/components/ReviewPrompt.tsx` and
  `src/components/ReengagementNudge.tsx` — both are `fixed inset-x-0 bottom-5 z-40`
  bottom-center cards with a message, a primary action, and an `XIcon` dismiss button
  (`ReviewPrompt.tsx:9-37`, `ReengagementNudge.tsx:10-43`). A `ProNudge` would be a
  copy with copy like "Totem is free forever. Pro unlocks exports + deleted-tweet
  preservation — $19 lifetime."
- **Gating logic:** add a `pro` namespace to `GrowthState` (`growth-state.ts:18`)
  with `nudgePromptedAt`/`nudgeDismissedAt` (mirror `review`/`activation` at
  `growth-state.ts:36-41`), a `shouldShowProNudge(state)` predicate next to
  `shouldShowReviewPrompt` (`growth-state.ts:205`), and `markProNudgePrompted/Dismissed`
  mirroring `growth-state.ts:320-357`. Gate on activation (`activatedAt !== null`) so it
  only fires for engaged users — never on day one.
- **Orchestration mount:** the same `App.tsx` effect pattern used for review/reengagement
  (`App.tsx:614-639` for reengagement; `App.tsx:805-813` for review). Render the
  component conditionally next to `<ReviewPrompt>`/`<ReengagementNudge>`
  (`App.tsx:726-732` and `App.tsx:987-992`). Crucially, suppress when `isPro` is true.

### (d) Banner

For a non-blocking persistent banner, `src/components/ui/OfflineBanner.tsx` is the
in-repo banner pattern. Prefer (a)+(c) over a banner to avoid nagging; a banner is the
weakest of the four and should be reserved for a time-boxed founders-price promo.

---

## 4. Proposed `usePro()` hook + `<ProGate>` component

Both live beside existing analogs and follow their conventions exactly.

### `src/hooks/usePro.ts` — mirrors `src/hooks/useTheme.ts`

Rationale: entitlement is a single user-scoped value that should sync across devices and
update live in every open surface — identical requirements to `useTheme`. Clone its
three-effect structure (load-once, `onChanged` subscription, setter) and its
`normalizeX(unknown)` discipline.

```ts
// src/hooks/usePro.ts  (shape only)
import { useCallback, useEffect, useState } from "react";
import { hasChromeStorageSync, hasChromeStorageOnChanged } from "../lib/chrome";
import { SYNC_PRO } from "../lib/storage-keys";          // new key, added to CHROME_SYNC_KEYS
import type { ProEntitlement } from "../types";          // new type in src/types/index.ts

const DEFAULT_PRO: ProEntitlement = {
  status: "free", licenseKey: null, unlockedAt: null, verifiedAt: null,
};

function normalizePro(value: unknown): ProEntitlement { /* same guard style as useTheme.ts:17 */ }

export function usePro() {
  const [entitlement, setEntitlement] = useState<ProEntitlement>(DEFAULT_PRO);

  // effect 1: chrome.storage.sync.get({ [SYNC_PRO]: DEFAULT_PRO }) → normalize → setState
  // effect 2: chrome.storage.onChanged (areaName === "sync", key SYNC_PRO) → setState
  // (verification — license re-check — can be a 3rd effect or a service-worker call;
  //  keep storage as the optimistic cache, verifiedAt as the trust timestamp.)

  const setEntitlementValue = useCallback((next: ProEntitlement) => {
    setEntitlement(next);
    if (hasChromeStorageSync()) chrome.storage.sync.set({ [SYNC_PRO]: next }).catch(() => {});
  }, []);

  return { isPro: entitlement.status === "pro", entitlement, setEntitlement: setEntitlementValue };
}
```

Naming note: the task allows `useEntitlement()`; given the repo's terse domain-named
hooks (`useSettings`, `useTheme`, `useTodayQueue`), **`usePro()` returning `{ isPro }`**
reads best at call sites. Optionally export a thin `useIsPro()` selector that returns the
boolean only, matching the `useShallow`/selector ergonomics in `src/stores/selectors.ts`.

Call it once high in the tree alongside `useSettings()`/`useTheme()` at `App.tsx:410-411`
(in both `NewTabRouteApp` and `ReaderRouteApp`) and thread `isPro` down as a prop, exactly
as `settings.*` is threaded today. Do **not** put `isPro` in the Zustand `runtime-store`:
that store is the SW-owned auth/sync snapshot (`RuntimeState`, `runtime-store.ts:154`) and
the codebase deliberately keeps user *preferences* out of it (storage-keys.ts:47-60 and
the `storage-invariants.test.ts` guard).

### `<ProGate>` — lives beside the gated UI, in `src/components/`

A small wrapper that renders children for Pro users, and for free users renders the
locked affordance (a `Badge variant="accent">PRO</Badge>` + intercepts click to open the
upgrade modal). Keeps every call site a one-liner and centralizes the lock visuals.

```tsx
// src/components/ProGate.tsx  (shape only; Badge from ui/Badge.tsx, accent variant)
interface ProGateProps {
  isPro: boolean;
  onUpgrade: () => void;          // opens the Upgrade modal (App.tsx route state, §3a)
  children: React.ReactNode;      // the real control when unlocked
  lockedLabel?: string;           // e.g. "Pro feature"
  showBadge?: boolean;            // render the PRO badge inline
}
// if isPro → return <>{children}</>
// else → render the same control visually but route onClick → onUpgrade, append <Badge variant="accent">PRO</Badge>
```

Two usage flavors, both already supported by the codebase:

1. **Hard gate** (replace action): wrap the Export button so a free user's click opens
   the upgrade modal instead of `onExport` — applied at `SettingsModal.tsx:383` and at
   the `onOpenExport` boundary in `App.tsx:708`.
2. **Badge-only hint** (`showBadge`): annotate a control that stays interactive but
   surfaces locked sub-options downstream (e.g. the export-format radio cards,
   `ExportModal.tsx:200-289`).

The upgrade modal itself (`UpgradeModal.tsx`, cloned from `OnboardingModal.tsx`) is
opened via the existing route-reducer pattern: add `upgradeOpen` to `NewTabRouteState`
(`App.tsx:117-125`), an `onOpenUpgrade` setter, and render `<UpgradeModal open={upgradeOpen}
…/>` next to `<ExportModal>`/`<ImportModal>` at `App.tsx:708-725`. This is the identical
mechanism already used for settings/export/import modals — no new modal-management
infrastructure is needed.

---

## Summary of concrete files to add / touch

| Action | File |
|---|---|
| Add `SYNC_PRO` key + add to `CHROME_SYNC_KEYS` + legacy map | `src/lib/storage-keys.ts:70,73` |
| Add `ProEntitlement` type | `src/types/index.ts` (beside `UserSettings:283`) |
| New `usePro()` hook (clone `useTheme.ts`) | `src/hooks/usePro.ts` |
| Extend growth state for one-time nudge (set-once idiom) | `src/lib/growth-state.ts:18,205,320` |
| New `<ProGate>` wrapper | `src/components/ProGate.tsx` |
| New `UpgradeModal` (clone `OnboardingModal.tsx`) | `src/components/UpgradeModal.tsx` |
| New `ProNudge` banner (clone `ReviewPrompt.tsx`) | `src/components/ProNudge.tsx` |
| Add Pro section + gate Export button | `src/components/SettingsModal.tsx:374-394` |
| Call `usePro()`, add `upgradeOpen` route state, render modals/nudge, thread `isPro` | `src/App.tsx:117-125,410-411,693-732,805-813,987-992` |
| Optional always-visible upgrade entry in toolbar | `src/components/NewTabHome.tsx:1086-1095` |
