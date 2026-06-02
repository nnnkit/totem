import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  CHROME_WEB_STORE_REVIEW_URL,
  PRIVACY_POLICY_URL,
  X_BOOKMARKS_URL,
} from "../../lib/constants/growth";

vi.mock("../ui/Modal", () => ({
  Modal({
    open,
    title,
    children,
  }: {
    open: boolean;
    title?: ReactNode;
    children: ReactNode;
  }) {
    if (!open) return null;
    return (
      <section>
        {title ? <h2>{title}</h2> : null}
        {children}
      </section>
    );
  },
}));

import { OnboardingModal } from "../OnboardingModal";
import { ReengagementNudge } from "../ReengagementNudge";
import { ReviewPrompt } from "../ReviewPrompt";

describe("Phase 2 growth UI", () => {
  it("renders onboarding setup, permission, and privacy copy", () => {
    const html = renderToStaticMarkup(
      <OnboardingModal
        open
        bookmarkCount={0}
        onClose={vi.fn()}
        onSync={vi.fn()}
      />,
    );

    expect(html).toContain("Set up Totem");
    expect(html).toContain("Visit x.com/bookmarks once");
    expect(html).toContain("cookies");
    expect(html).toContain("webRequest");
    expect(html).toContain("No Totem account or server is involved.");
    expect(html).toContain(`href="${PRIVACY_POLICY_URL}"`);
    expect(html).toContain(`href="${X_BOOKMARKS_URL}"`);
  });

  it("renders the review prompt with the Chrome Web Store reviews URL", () => {
    const html = renderToStaticMarkup(
      <ReviewPrompt onDismiss={vi.fn()} onReview={vi.fn()} />,
    );

    expect(html).toContain("Enjoying Totem? A quick review helps others find it.");
    expect(html).toContain(`href="${CHROME_WEB_STORE_REVIEW_URL}"`);
    expect(html).toContain('aria-label="Dismiss review prompt"');
  });

  it("renders singular and plural re-engagement copy", () => {
    const one = renderToStaticMarkup(
      <ReengagementNudge
        unreadCount={1}
        onOpenReading={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    const many = renderToStaticMarkup(
      <ReengagementNudge
        unreadCount={1240}
        onOpenReading={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(one).toContain("You have 1 unread Twitter bookmark waiting.");
    expect(many).toContain("You have 1,240 unread Twitter bookmarks waiting.");
    expect(many).toContain('aria-label="Dismiss unread bookmark nudge"');
  });
});
