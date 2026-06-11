import type { RecommendationSource } from "../types";
import type { ReadingTab } from "./reading-list";

export function resolveHomeReadingTab({
  requestedTab,
  recommendationSource,
  todayQueueDone,
}: {
  requestedTab?: ReadingTab;
  recommendationSource: RecommendationSource;
  todayQueueDone: boolean;
}): ReadingTab | undefined {
  if (requestedTab) return requestedTab;
  if (recommendationSource !== "today") return undefined;
  return todayQueueDone ? "unread" : "today";
}
