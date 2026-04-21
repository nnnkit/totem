/**
 * Reader-error presentation contract.
 *
 * Pairs with `classifyDetailError` in `detail-error.ts`. The classifier
 * decides WHICH kind of error happened; this module decides WHAT the user
 * sees and CAN DO about it. Together they enforce ARCHITECTURE.md §16
 * Invariant #5: every error screen has an action that resolves its own error.
 */

export type ReaderErrorViewKind = "auth" | "rate_limited" | "not_found" | "other";

export interface ReaderErrorView {
  title: string;
  message: string;
  showRetry: boolean;
  showLogin: boolean;
  primaryAction: "retry" | "login" | "view_on_x";
}

export function resolveReaderErrorView(
  kind: ReaderErrorViewKind,
  canLogin: boolean,
): ReaderErrorView {
  switch (kind) {
    case "auth":
      return {
        title: "Sign in to open this post",
        message: "Your X session has expired, so Totem can't load the full post.",
        showRetry: true,
        showLogin: true,
        primaryAction: "login",
      };
    case "rate_limited":
      return {
        title: "X is asking us to slow down",
        message:
          "Too many requests recently. Retrying now won't help — open the post on X, or come back in a minute.",
        showRetry: false,
        showLogin: false,
        primaryAction: "view_on_x",
      };
    case "not_found":
      return {
        title: "This post isn't available",
        message:
          "It may have been deleted, be from a protected account, or require a direct link on X.",
        showRetry: false,
        showLogin: false,
        primaryAction: "view_on_x",
      };
    default:
      return {
        title: "Couldn't open this post in Totem.",
        message: "Totem couldn't fetch the full tweet detail right now.",
        showRetry: true,
        showLogin: canLogin,
        primaryAction: "retry",
      };
  }
}
