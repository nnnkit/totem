import { clearAllLocalData } from "../db";

export const MANUAL_LOGIN_REQUIRED_KEY = "xbt_manual_login_required";

export async function resetLocalData(): Promise<void> {
  await clearAllLocalData();

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("xbt_tour_completed");
  }

  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.clear();
  await chrome.storage.local.set({ [MANUAL_LOGIN_REQUIRED_KEY]: true });
}
