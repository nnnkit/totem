import { useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const TOUR_KEY = "xbt_tour_completed";

interface Props {
  enabled: boolean;
  hasBookmarks: boolean;
  showSearchBar: boolean;
}

export function useProductTour({
  enabled,
  hasBookmarks,
  showSearchBar,
}: Props) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !hasBookmarks || startedRef.current) return;
    if (localStorage.getItem(TOUR_KEY) === "1") return;

    startedRef.current = true;

    const timeout = window.setTimeout(() => {
      const steps: DriveStep[] = [
        {
          element: '[data-tour="bookmark-card"]',
          popover: {
            title: "Browse bookmarks",
            description:
              "Use <kbd>←</kbd> <kbd>→</kbd> to browse through your saved posts",
          },
        },
        {
          element: '[data-tour="bookmark-card"]',
          popover: {
            title: "Open to read",
            description:
              "Press <kbd>Enter</kbd> or <kbd>O</kbd> to open any bookmark in the reader",
          },
        },
        {
          element: '[data-tour="reading-btn"]',
          popover: {
            title: "Reading list",
            description:
              "Press <kbd>L</kbd> to see all bookmarks organized by reading progress",
          },
        },
      ];

      if (showSearchBar) {
        steps.push({
          element: '[data-tour="search-bar"]',
          popover: {
            title: "Search",
            description:
              "Press <kbd>/</kbd> to search through your bookmarks",
          },
        });
      }

      steps.push({
        element: '[data-tour="settings-btn"]',
        popover: {
          title: "Settings",
          description:
            "Customize your theme, search bar, and quick links",
        },
      });

      const tour = driver({
        popoverClass: "xbt-tour-popover",
        stagePadding: 6,
        stageRadius: 12,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0, 0, 0, 0.6)",
        steps,
        onDestroyed: () => {
          localStorage.setItem(TOUR_KEY, "1");
        },
      });

      tour.drive();
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [enabled, hasBookmarks, showSearchBar]);
}
