import { clearAllLocalData } from "../db";

const READ_IDS_KEY = "tw_breath_read_ids";
export const MANUAL_LOGIN_REQUIRED_KEY = "xbt_manual_login_required";

export async function resetLocalData(): Promise<void> {
  await clearAllLocalData();

  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(READ_IDS_KEY);
    localStorage.removeItem("xbt_tour_completed");
  }

  if (typeof chrome === "undefined" || !chrome.storage?.local) {
    return;
  }

  await chrome.storage.local.clear();
  await chrome.storage.local.set({ [MANUAL_LOGIN_REQUIRED_KEY]: true });
}
