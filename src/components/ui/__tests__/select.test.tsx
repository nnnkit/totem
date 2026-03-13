import { renderToStaticMarkup } from "react-dom/server";
import { ArrowsDownUpIcon } from "@phosphor-icons/react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "../Select";

describe("Select", () => {
  it("renders the selected label in the trigger", () => {
    const html = renderToStaticMarkup(
      <Select
        value="recent"
        onValueChange={vi.fn()}
        options={[
          { value: "recent", label: "Recent" },
          { value: "oldest", label: "Oldest" },
        ]}
        ariaLabel="Sort bookmarks"
        leadingIcon={<ArrowsDownUpIcon className="size-4" />}
      />,
    );

    expect(html).toContain("Sort bookmarks");
    expect(html).toContain("Recent");
  });
});
