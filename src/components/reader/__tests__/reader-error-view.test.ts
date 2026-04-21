import { describe, expect, it } from "vitest";
import { resolveReaderErrorView } from "../reader-error-view";

/**
 * These tests encode ARCHITECTURE.md §16 Invariant #5:
 *   every error screen has an action that resolves its own error.
 *
 * If someone changes the primary action for a kind (e.g. makes `not_found`
 * show Retry, which wouldn't help — the tweet is gone), or drops the
 * Log-in button from the `auth` branch, one of these tests fails.
 */

describe("resolveReaderErrorView", () => {
  describe("auth kind", () => {
    it("primary action is Log in; Retry stays visible as a fallback", () => {
      const view = resolveReaderErrorView("auth", true);
      expect(view.primaryAction).toBe("login");
      expect(view.showLogin).toBe(true);
      expect(view.showRetry).toBe(true);
    });

    it("canLogin is irrelevant for the auth kind — login is always offered", () => {
      // The kind itself *is* the evidence that auth needs attention. The
      // separate canLogin hint only gates login for the generic `other`
      // bucket; for auth errors we always show the button.
      const withFlag = resolveReaderErrorView("auth", true);
      const withoutFlag = resolveReaderErrorView("auth", false);
      expect(withFlag.showLogin).toBe(true);
      expect(withoutFlag.showLogin).toBe(true);
      expect(withFlag.primaryAction).toBe(withoutFlag.primaryAction);
    });
  });

  describe("rate_limited kind", () => {
    it("primary action is View on X; Retry is hidden", () => {
      // Retry would stack on top of the orchestrator's cooldown — useless
      // for the user. The canonical fallback is the tweet URL on X itself.
      const view = resolveReaderErrorView("rate_limited", true);
      expect(view.primaryAction).toBe("view_on_x");
      expect(view.showRetry).toBe(false);
      expect(view.showLogin).toBe(false);
    });

    it("copy explicitly discourages retry", () => {
      const view = resolveReaderErrorView("rate_limited", false);
      expect(view.message.toLowerCase()).toContain("retrying");
    });
  });

  describe("not_found kind", () => {
    it("primary action is View on X; Retry is hidden", () => {
      // A not_found result doesn't get better by retrying — the tweet is
      // gone. The user's only actionable next step is opening on X, which
      // may succeed if the tweet is simply protected on our side.
      const view = resolveReaderErrorView("not_found", true);
      expect(view.primaryAction).toBe("view_on_x");
      expect(view.showRetry).toBe(false);
      expect(view.showLogin).toBe(false);
    });
  });

  describe("other kind (generic fallback)", () => {
    it("primary action is Retry", () => {
      const view = resolveReaderErrorView("other", true);
      expect(view.primaryAction).toBe("retry");
      expect(view.showRetry).toBe(true);
    });

    it("shows Log in only when canLogin is true", () => {
      const withFlag = resolveReaderErrorView("other", true);
      const withoutFlag = resolveReaderErrorView("other", false);
      expect(withFlag.showLogin).toBe(true);
      expect(withoutFlag.showLogin).toBe(false);
    });
  });

  describe("invariant: every kind produces a meaningful primary action", () => {
    it("no kind falls through to an action that does nothing for the user", () => {
      // Generic contract: every resolved view has a primary action that
      // takes the user somewhere useful given the error class.
      const kinds = ["auth", "rate_limited", "not_found", "other"] as const;
      for (const kind of kinds) {
        const view = resolveReaderErrorView(kind, true);
        expect(["retry", "login", "view_on_x"]).toContain(view.primaryAction);
        // Every view has a non-empty title and message.
        expect(view.title.length).toBeGreaterThan(0);
        expect(view.message.length).toBeGreaterThan(0);
      }
    });

    it("when Retry is shown it must be a legitimate action (auth or other)", () => {
      // Invariant: we never show Retry for rate_limited or not_found,
      // where retrying would definitely not help.
      const rate = resolveReaderErrorView("rate_limited", true);
      const nf = resolveReaderErrorView("not_found", true);
      expect(rate.showRetry).toBe(false);
      expect(nf.showRetry).toBe(false);
    });
  });
});
