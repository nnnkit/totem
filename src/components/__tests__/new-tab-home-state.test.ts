import { describe, expect, it } from "vitest";
import { resolveHomeFooterPrimaryState } from "../new-tab-home-state";

describe("resolveHomeFooterPrimaryState", () => {
  it("prefers cached content over login card when item exists", () => {
    expect(resolveHomeFooterPrimaryState("need_login", true)).toBe("content");
  });

  it("shows login card when logged out and no cached item exists", () => {
    expect(resolveHomeFooterPrimaryState("need_login", false)).toBe(
      "need_login",
    );
  });

  it("prefers cached content over connecting card when item exists", () => {
    expect(resolveHomeFooterPrimaryState("connecting", true)).toBe("content");
  });

  it("shows connecting card when no cached item exists", () => {
    expect(resolveHomeFooterPrimaryState("connecting", false)).toBe(
      "connecting",
    );
  });
});
