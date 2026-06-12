import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  getTodayQueueProgress,
  TodayQueueProgressIndicator,
} from "../new-tab-home-progress";

describe("NewTabHome Today's Read progress", () => {
  it("renders handled progress copy and width", () => {
    const progress = getTodayQueueProgress({
      handledCount: 2,
      totalCount: 5,
    });

    expect(progress?.handledLabel).toBe("2 / 5 handled");
    expect(progress?.leftLabel).toBe("3 left today");
    expect(progress?.ariaLabel).toBe(
      "Today's Read progress: 2 / 5 handled",
    );

    const html = renderToStaticMarkup(
      progress ? <TodayQueueProgressIndicator progress={progress} /> : null,
    );

    expect(html).toContain('title="2 / 5 handled"');
    expect(html).toContain("width:40%");
  });

  it("clamps invalid handled counts and hides missing totals", () => {
    expect(
      getTodayQueueProgress({ handledCount: 8, totalCount: 5 })?.handledLabel,
    ).toBe("5 / 5 handled");
    expect(getTodayQueueProgress({ handledCount: 1, totalCount: 0 })).toBeNull();
  });
});
