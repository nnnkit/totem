import { describe, expect, it } from "vitest";
import {
  getFullExportReadyDismissalSignature,
  isFullExportReadyForCurrentLibrary,
} from "../full-export-ready-dismissal";

describe("full export ready dismissal", () => {
  it("only treats the current library as ready when every bookmark has detail", () => {
    expect(
      isFullExportReadyForCurrentLibrary({ bookmarkCount: 5, readyCount: 5 }),
    ).toBe(true);
    expect(
      isFullExportReadyForCurrentLibrary({ bookmarkCount: 5, readyCount: 4 }),
    ).toBe(false);
    expect(
      isFullExportReadyForCurrentLibrary({ bookmarkCount: 0, readyCount: 0 }),
    ).toBe(false);
  });

  it("builds a stable signature from the visible library counts", () => {
    expect(
      getFullExportReadyDismissalSignature({ bookmarkCount: 12, readyCount: 12 }),
    ).toBe("12:12");
    expect(
      getFullExportReadyDismissalSignature({ bookmarkCount: 12, readyCount: 20 }),
    ).toBe("12:12");
  });
});
