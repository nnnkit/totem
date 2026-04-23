/**
 * Load-bearing architectural invariants, enforced at CI time.
 *
 * Every test in this file corresponds to a specific invariant documented
 * in ARCHITECTURE.md §16. The tests scan the source tree for the specific
 * patterns that would regress the invariant. A failure here means "you're
 * about to re-create a bug class that a previous refactor specifically
 * killed."
 *
 * These tests are source-grep-based on purpose:
 * - fast (runs in milliseconds)
 * - no runtime cost (only runs in tests/CI)
 * - no new toolchain (no ESLint custom rules, no TypeScript plugin)
 * - catches the exact regression pattern, not a proxy
 */
import { describe, expect, it } from "vitest";

// Vite's native glob import — returns a map of { path: source-string } for
// every matching file, resolved at test-run time. Zero extra deps.
// The `as: "raw"` (eager) form gives us the file contents as strings.
const SOURCES = import.meta.glob("../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// Paths from import.meta.glob are relative to THIS test file:
//   src/lib/__tests__/storage-invariants.test.ts
// A glob of "../../**/*.{ts,tsx}" therefore returns paths like:
//   "../reset.ts"           → src/lib/reset.ts
//   "../storage-keys.ts"    → src/lib/storage-keys.ts
//   "../../App.tsx"         → src/App.tsx
//   "../../stores/foo.ts"   → src/stores/foo.ts
// We normalize every path to be src-relative ("lib/reset.ts", "App.tsx",
// "stores/foo.ts") so the ALLOWED_* lists read naturally.
function normalizeToSrcRelative(globPath: string): string {
  if (globPath.startsWith("../../")) return globPath.slice("../../".length);
  if (globPath.startsWith("../")) return `lib/${globPath.slice("../".length)}`;
  return globPath;
}

function readAllSourceFiles(): Array<{ path: string; content: string }> {
  return Object.entries(SOURCES)
    .filter(([path]) => {
      const isTest =
        path.includes(".test.ts") ||
        path.includes(".test.tsx") ||
        path.includes("__tests__/");
      return !isTest;
    })
    .map(([path, content]) => ({
      path: normalizeToSrcRelative(path),
      content,
    }));
}

describe("Invariant #1 — single writer per persisted fact (ARCHITECTURE.md §16)", () => {
  // Keys whose values are written exclusively by the service worker.
  // Runtime code reads them through the SW-owned RuntimeSnapshot. Writing
  // any of these from runtime code is the dual-writer pattern that the
  // original Phase 1 refactor specifically killed — it was the root of the
  // "loading loop on every reload" bug.
  const SW_OWNED_KEY_NAMES = [
    "CS_SYNC_ORCHESTRATOR_STATE",
    "CS_RUNTIME_STATE_V2",
    "CS_LAST_SYNC",
    "CS_LAST_SOFT_SYNC",
    "CS_SOFT_SYNC_NEEDED",
  ] as const;

  // Literal string values, in case someone bypasses the symbolic constant
  // and inlines the string.
  const SW_OWNED_KEY_STRINGS = [
    "totem_sync_orchestrator_state",
    "totem_runtime_state_v2",
    "totem_last_sync",
    "totem_last_light_sync",
    "totem_light_sync_needed",
  ] as const;

  // Files allowed to write these keys. Every entry needs a justification in
  // a comment. Adding to this list should be a deliberate architectural
  // decision, not an accident.
  const ALLOWED_WRITERS = [
    "service-worker/",  // the canonical writer
  ];

  function isAllowedWriter(path: string): boolean {
    return ALLOWED_WRITERS.some((prefix) => path.startsWith(prefix));
  }

  it("no non-service-worker file calls chrome.storage.local.set/remove on SW-owned keys", () => {
    const files = readAllSourceFiles();
    const violations: string[] = [];

    for (const file of files) {
      if (isAllowedWriter(file.path)) continue;

      // Find every chrome.storage.local.set({ ... }) or .remove(...) call,
      // then check if any SW-owned key (by name or by string literal) appears
      // syntactically nearby.
      const writePattern =
        /chrome\.storage\.local\.(?:set|remove)\s*\(\s*[\s\S]{0,400}?\)/g;
      const matches = file.content.match(writePattern) ?? [];

      for (const match of matches) {
        const touchesSwKey =
          SW_OWNED_KEY_NAMES.some((name) =>
            new RegExp(`\\b${name}\\b`).test(match),
          ) ||
          SW_OWNED_KEY_STRINGS.some((str) =>
            match.includes(`"${str}"`) || match.includes(`'${str}'`),
          );
        if (touchesSwKey) {
          violations.push(`${file.path}: ${match.slice(0, 120)}…`);
        }
      }
    }

    expect(
      violations,
      `Runtime code is writing a SW-owned key directly. This is the dual-writer
pattern that Phase 1 killed — see ARCHITECTURE.md §16 Invariant #1.
Violations:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("Invariant #1 (import boundary) — non-SW runtime must not import from service-worker/storage-keys-sw", () => {
  // An import from storage-keys-sw.ts is a signal that the caller has
  // symbolic access to an SW-owned key. Most of the time that's a red flag
  // (the caller wants to WRITE the key). Two files are allowed because
  // they demonstrably do not write: reset.ts wipes storage, and
  // RuntimeProvider subscribes to change events by key name.
  const ALLOWED_IMPORTERS = [
    "service-worker/",
    "lib/reset.ts",             // wipes the keys; does not write values
    "runtime/RuntimeProvider.tsx", // matches change-event keys; does not write
  ];

  function isAllowedImporter(path: string): boolean {
    return ALLOWED_IMPORTERS.some((prefix) => path.startsWith(prefix));
  }

  it("no unauthorized file imports from service-worker/storage-keys-sw", () => {
    const files = readAllSourceFiles();
    const violations: string[] = [];

    for (const file of files) {
      if (isAllowedImporter(file.path)) continue;
      if (/from\s+["'][^"']*service-worker\/storage-keys-sw["']/.test(file.content)) {
        violations.push(file.path);
      }
    }

    expect(
      violations,
      `Unauthorized import of SW-owned storage keys. If this file legitimately
needs read-only access, add it to ALLOWED_IMPORTERS with a justifying
comment. See ARCHITECTURE.md §16 Invariant #1.
Violations:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

describe("Invariant #6 — retry is for transport failures only (ARCHITECTURE.md §16)", () => {
  // The only legitimate place to retry is inside fetchTweetDetail itself,
  // where sendWithTransientRetry catches a thrown sendMessage and retries
  // exactly once. Callers that wrap fetchTweetDetail in their own retry
  // loop would stack a second request on top of an already-failing
  // classified error (NO_AUTH, RATE_LIMITED, etc.) — the exact pattern
  // that caused the "why isn't the Log in button showing up" UX bug.
  const ALLOWED_CALLERS = [
    "api/core/posts.ts", // the canonical retry site
  ];

  function isAllowedCaller(path: string): boolean {
    return ALLOWED_CALLERS.some((prefix) => path.startsWith(prefix));
  }

  it("no caller wraps fetchTweetDetail (or actions.loadReaderDetail) in a retry loop", () => {
    const files = readAllSourceFiles();
    const violations: Array<{ path: string; snippet: string }> = [];

    // Four retry shapes:
    //   try { ... } catch (e) { ... fetch() }          block-form catch
    //   .catch(() => { ... fetch() })                  promise-chain catch
    //   for (...)   { ... fetch() }                    for-loop retry
    //   while (...) { ... fetch() }                    while-loop retry
    const retryPatterns = [
      /catch\s*(?:\([^)]*\))?\s*\{[\s\S]{0,500}?(?:fetchTweetDetail|loadReaderDetail)\s*\(/g,
      /\.catch\s*\(\s*(?:[^)]*\)\s*=>|function\s*\([^)]*\))\s*\{[\s\S]{0,500}?(?:fetchTweetDetail|loadReaderDetail)\s*\(/g,
      /\bfor\s*\([^)]*\)\s*\{[\s\S]{0,500}?(?:fetchTweetDetail|loadReaderDetail)\s*\(/g,
      /\bwhile\s*\([^)]*\)\s*\{[\s\S]{0,500}?(?:fetchTweetDetail|loadReaderDetail)\s*\(/g,
    ];

    for (const file of files) {
      if (isAllowedCaller(file.path)) continue;

      for (const pattern of retryPatterns) {
        const matches = file.content.match(pattern) ?? [];
        for (const match of matches) {
          violations.push({ path: file.path, snippet: match.slice(0, 200) });
        }
      }
    }

    expect(
      violations.map((v) => `${v.path}: ${v.snippet}…`),
      `A caller is retrying fetchTweetDetail / loadReaderDetail. This stacks
a second request on top of a classified error (NO_AUTH, RATE_LIMITED,
DETAIL_NOT_FOUND) and prevents the user from reaching the action that
actually resolves the problem. Retry lives inside fetchTweetDetail itself,
scoped to transport-level sendMessage failures. See ARCHITECTURE.md §16
Invariant #6.`,
    ).toEqual([]);
  });
});

describe("Invariant #7 — reading progress must be joined to the full bookmark set", () => {
  // useContinueReading drives the Continue / Unread / Read tabs. It joins
  // progress rows against the bookmark list it's given. If a caller passes
  // `displayBookmarks` (the cache-restricted subset used for offline-safe
  // recommendations), rows whose bookmarks are temporarily filtered out
  // silently disappear from the reading tab — even though the progress
  // record is fine. This was the root cause of the "opened articles don't
  // land in the reading tab" regression after the dual-writer refactor.
  it("no caller passes displayBookmarks to useContinueReading", () => {
    const files = readAllSourceFiles();
    const violations: Array<{ path: string; snippet: string }> = [];

    const pattern = /useContinueReading\s*\(\s*displayBookmarks\b/g;

    for (const file of files) {
      const matches = file.content.match(pattern) ?? [];
      for (const match of matches) {
        violations.push({ path: file.path, snippet: match });
      }
    }

    expect(
      violations.map((v) => `${v.path}: ${v.snippet}`),
      `useContinueReading is being called with displayBookmarks. That set is
cache-restricted — during connecting/reauthing it omits bookmarks whose
detail isn't cached, which silently drops their progress rows from the
reading tab. Pass the full set (useAllBookmarks) instead.`,
    ).toEqual([]);
  });
});
