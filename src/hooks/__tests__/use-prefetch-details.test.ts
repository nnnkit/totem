import { describe, expect, it, vi } from "vitest";
import { runPrefetchLoop } from "../../stores/prefetch-controller";

describe("runPrefetchLoop", () => {
  it("continues prefetching after an individual fetch failure", async () => {
    const fetched: string[] = [];
    const fetchDetail = vi.fn(async (tweetId: string) => {
      fetched.push(tweetId);
      if (tweetId === "2") throw new Error("DETAIL_ERROR_500");
    });
    const onSuccess = vi.fn();

    await runPrefetchLoop({
      tweetIds: ["1", "2", "3"],
      fetchDetail,
      onSuccess,
      shouldStop: () => false,
    });

    expect(fetched).toEqual(["1", "2", "3"]);
    expect(onSuccess).toHaveBeenCalledTimes(2);
  });

  it("stops without updating state when cancelled", async () => {
    let cancelled = false;
    const fetchDetail = vi.fn(async (tweetId: string) => {
      if (tweetId === "1") {
        cancelled = true;
      }
    });
    const onSuccess = vi.fn();

    await runPrefetchLoop({
      tweetIds: ["1", "2", "3"],
      fetchDetail,
      onSuccess,
      shouldStop: () => cancelled,
    });

    expect(fetchDetail).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
