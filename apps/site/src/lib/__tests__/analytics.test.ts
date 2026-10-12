// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { analyticsScript, OPENPANEL_ORIGIN } from "../analytics";

type FakeWindow = {
  top: unknown;
  self: unknown;
  umami: { track: ReturnType<typeof vi.fn> };
  op?: { q: unknown[][] };
};

function load(url: string, clientId?: string) {
  const document = window.document.implementation.createHTMLDocument();
  document.body.innerHTML = `<a id="install" href="https://chromewebstore.google.com/detail/totem/abc">Install</a>`;
  const fakeWindow = { umami: { track: vi.fn() } } as unknown as FakeWindow;
  fakeWindow.top = fakeWindow.self = fakeWindow;
  new Function("window", "location", "document", analyticsScript(clientId))(fakeWindow, new URL(url), document);
  const click = () => document.getElementById("install")!.click();
  const openPanelScripts = () =>
    Array.from(document.querySelectorAll("script")).filter((script) => script.src.startsWith(OPENPANEL_ORIGIN));
  return { fakeWindow, click, openPanelScripts };
}

describe("analyticsScript", () => {
  it("leaves OpenPanel out entirely when no client id is set", () => {
    expect(analyticsScript()).not.toContain(OPENPANEL_ORIGIN);
    expect(analyticsScript("  ")).not.toContain("window.op");

    const { fakeWindow, click, openPanelScripts } = load("https://usetotem.xyz/");
    click();

    expect(fakeWindow.op).toBeUndefined();
    expect(openPanelScripts()).toHaveLength(0);
    expect(fakeWindow.umami.track).toHaveBeenCalledWith("install_click", { destination: "chromewebstore.google.com" });
  });

  it("sends custom events to OpenPanel with the Umami name and properties", () => {
    const { fakeWindow, click, openPanelScripts } = load("https://www.usetotem.xyz/", "client-123");
    click();

    expect(openPanelScripts()).toHaveLength(1);
    const queue = fakeWindow.op!.q;
    expect(queue[0][0]).toBe("init");
    expect(queue[0][1]).toMatchObject({
      clientId: "client-123",
      apiUrl: `${OPENPANEL_ORIGIN}/api`,
      trackScreenViews: true,
      trackOutgoingLinks: true,
    });
    expect(fakeWindow.umami.track).toHaveBeenCalledWith("install_click", { destination: "chromewebstore.google.com" });
    expect(queue).toContainEqual(["track", "install_click", { destination: "chromewebstore.google.com" }]);
  });

  it.each(["https://totem-preview.vercel.app/", "http://localhost:4321/", "https://usetotem.xyz/?embed=1"])(
    "keeps OpenPanel inert on %s",
    (url) => {
      const { fakeWindow, click, openPanelScripts } = load(url, "client-123");
      click();

      expect(fakeWindow.op).toBeUndefined();
      expect(openPanelScripts()).toHaveLength(0);
    },
  );

  it("strips query strings and fragments except campaign tags", () => {
    const { fakeWindow } = load("https://usetotem.xyz/", "client-123");
    const { filter } = fakeWindow.op!.q[0][1] as { filter: (event: unknown) => boolean };
    const properties = {
      __path: "https://usetotem.xyz/blog/?utm_source=x&token=secret#top",
      __referrer: "https://example.com/search?q=private",
    };

    expect(filter({ payload: { properties } })).toBe(true);
    expect(properties).toEqual({
      __path: "https://usetotem.xyz/blog/?utm_source=x",
      __referrer: "https://example.com/search",
    });
  });
});
