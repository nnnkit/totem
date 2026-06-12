import { describe, expect, it } from "vitest";
import { resolveHomeReadingTab } from "../home-reading-tab";

describe("resolveHomeReadingTab", () => {
  it("opens active Today's Read cards on the Today tab", () => {
    expect(
      resolveHomeReadingTab({
        recommendationSource: "today",
        todayQueueDone: false,
      }),
    ).toBe("today");
  });

  it("keeps done Today's Read cards pointed at unread", () => {
    expect(
      resolveHomeReadingTab({
        recommendationSource: "today",
        todayQueueDone: true,
      }),
    ).toBe("unread");
  });

  it("preserves explicit tab requests and non-Today restore behavior", () => {
    expect(
      resolveHomeReadingTab({
        requestedTab: "continue",
        recommendationSource: "today",
        todayQueueDone: false,
      }),
    ).toBe("continue");
    expect(
      resolveHomeReadingTab({
        recommendationSource: "random",
        todayQueueDone: false,
      }),
    ).toBeUndefined();
  });
});
