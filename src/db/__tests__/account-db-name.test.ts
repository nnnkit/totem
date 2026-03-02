import { describe, expect, it } from "vitest";
import { getDbNameForAccount } from "../index";

describe("account-scoped db naming", () => {
  it("falls back to legacy db name when account id is missing", () => {
    expect(getDbNameForAccount(null)).toBe("totem");
    expect(getDbNameForAccount(undefined)).toBe("totem");
    expect(getDbNameForAccount("")).toBe("totem");
    expect(getDbNameForAccount("   ")).toBe("totem");
  });

  it("uses account-scoped name when account id is present", () => {
    expect(getDbNameForAccount("123456789")).toBe("totem_acct_123456789");
  });

  it("sanitizes account id for safe IndexedDB naming", () => {
    expect(getDbNameForAccount(" user:id/42 ")).toBe("totem_acct_user_id_42");
  });
});
