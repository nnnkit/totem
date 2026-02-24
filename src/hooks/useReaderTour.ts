import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { LS_READER_TOUR_COMPLETED } from "../lib/storage-keys";
import { READER_TOUR_DELAY_MS } from "../lib/constants";

interface Props {
  contentReady: boolean;
}

export function useReaderTour({ contentReady }: Props) {
  const startedRef = useRef(false);
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    if (!contentReady || startedRef.current) return;
    if (localStorage.getItem(LS_READER_TOUR_COMPLETED) === "1") return;

    startedRef.current = true;

    const steps: DriveStep[] = [
      {
        element: '[data-tour="reader-content"]',
        popover: {
          title: "Highlight & take notes",
          description:
            "Select any text to highlight it or add a note. Your annotations save automatically.",
        },
      },
      {
        element: '[data-tour="reader-back"]',
        popover: {
          title: "Navigation",
          description:
            "Press <kbd>Esc</kbd> to go back. Use <kbd>←</kbd> <kbd>→</kbd> to read the next post.",
        },
      },
    ];

    const timeout = window.setTimeout(() => {
      const tour = driver({
        popoverClass: "xbt-tour-popover",
        stagePadding: 6,
        stageRadius: 12,
        animate: true,
        allowClose: true,
        overlayColor: "rgba(0, 0, 0, 0.6)",
        showProgress: true,
        prevBtnText: "<kbd>←</kbd> Previous",
        nextBtnText: "Next <kbd>→</kbd>",
        doneBtnText: "Done",
        steps,
        onDestroyed: () => {
          localStorage.setItem(LS_READER_TOUR_COMPLETED, "1");
          driverRef.current = null;
        },
      });

      driverRef.current = tour;
      tour.drive();
    }, READER_TOUR_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [contentReady]);

  const dismiss = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  return { dismiss };
}
