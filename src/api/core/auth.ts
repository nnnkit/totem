import type { AuthStatus } from "../../types";

export interface ReauthStatus {
  inProgress: boolean;
}

interface CheckAuthOptions {
  probe?: boolean;
}

export async function checkAuth(options: CheckAuthOptions = {}): Promise<AuthStatus> {
  return chrome.runtime.sendMessage({ type: "CHECK_AUTH", probe: options.probe === true });
}

export async function startAuthCapture(): Promise<{ tabId?: number }> {
  return chrome.runtime.sendMessage({ type: "START_AUTH_CAPTURE" });
}

export async function closeAuthTab(): Promise<void> {
  await chrome.runtime.sendMessage({ type: "CLOSE_AUTH_TAB" });
}

export async function checkReauthStatus(): Promise<ReauthStatus> {
  return chrome.runtime.sendMessage({ type: "REAUTH_STATUS" });
}
