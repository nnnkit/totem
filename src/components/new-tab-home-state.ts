import type { AuthPhase } from "../hooks/useAuth";

export type HomeFooterPrimaryState =
  | "connecting"
  | "need_login"
  | "content"
  | "empty";

export function getEffectiveHomeAuthPhase(
  authPhase: AuthPhase | undefined,
  hasCurrentItem: boolean,
): AuthPhase | undefined {
  return hasCurrentItem ? undefined : authPhase;
}

export function resolveHomeFooterPrimaryState(
  authPhase: AuthPhase | undefined,
  hasCurrentItem: boolean,
): HomeFooterPrimaryState {
  const effectiveAuthPhase = getEffectiveHomeAuthPhase(authPhase, hasCurrentItem);
  if (effectiveAuthPhase === "connecting") return "connecting";
  if (effectiveAuthPhase === "need_login") return "need_login";
  if (hasCurrentItem) return "content";
  return "empty";
}

export function shouldShowHomeCardButtons(
  hasCurrentItem: boolean,
  effectiveAuthPhase: AuthPhase | undefined,
): boolean {
  return Boolean(
    hasCurrentItem &&
      effectiveAuthPhase !== "connecting" &&
      effectiveAuthPhase !== "need_login",
  );
}
