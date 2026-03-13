const TWEET_SELECTOR = 'article[data-testid="tweet"]';
const BUTTON_ATTR = "data-totem-open-button";
const STYLE_ID = "totem-open-in-totem-style";

declare global {
  interface Window {
    __totemOpenInTotemInstalled?: boolean;
  }
}

function isElement(value: unknown): value is Element {
  return value instanceof Element;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .totem-open-in-totem {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 28px;
      block-size: 28px;
      min-inline-size: 28px;
      min-block-size: 28px;
      margin-inline-end: 6px;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
      cursor: pointer;
      transition: opacity 150ms ease, transform 150ms ease;
    }

    .totem-open-in-totem:focus-visible {
      outline: 2px solid rgba(224, 122, 95, 0.65);
      outline-offset: 2px;
    }

    @media (hover: hover) {
      .totem-open-in-totem:hover {
        opacity: 0.88;
        transform: translateY(-1px);
      }
    }

    .totem-open-in-totem svg {
      inline-size: 20px;
      block-size: 20px;
      display: block;
      pointer-events: none;
    }

    .totem-open-in-totem::after {
      content: attr(data-tooltip);
      position: absolute;
      inset-inline-end: 0;
      inset-block-end: calc(100% + 10px);
      padding: 6px 9px;
      border-radius: 999px;
      background: rgba(17, 17, 19, 0.96);
      color: white;
      font-size: 12px;
      font-weight: 500;
      line-height: 1;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 150ms ease, transform 150ms ease;
    }

    @media (hover: hover) {
      .totem-open-in-totem:hover::after {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .totem-open-in-totem:focus-visible::after {
      opacity: 1;
      transform: translateY(0);
    }
  `;

  document.head.appendChild(style);
}

function closestTweetArticle(node: Node | null): HTMLElement | null {
  if (!node) return null;

  let current: Element | null = isElement(node) ? node : node.parentElement;
  while (current) {
    if (current.matches(TWEET_SELECTOR)) {
      return current as HTMLElement;
    }
    current = current.parentElement;
  }
  return null;
}

function belongsToArticle(node: Element, article: Element): boolean {
  return closestTweetArticle(node) === article;
}

function querySameTweet<T extends Element>(
  article: HTMLElement,
  selector: string,
): T[] {
  return Array.from(article.querySelectorAll<T>(selector)).filter((node) =>
    belongsToArticle(node, article)
  );
}

function isNestedTweet(article: HTMLElement): boolean {
  const parentArticle = article.parentElement?.closest(TWEET_SELECTOR);
  return parentArticle instanceof HTMLElement;
}

function parseTweetIdFromHref(href: string): string {
  if (!href) return "";
  try {
    const url = new URL(href, window.location.origin);
    const match = url.pathname.match(/\/status\/(\d+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function findStatusLink(article: HTMLElement): HTMLAnchorElement | null {
  const links = querySameTweet<HTMLAnchorElement>(article, 'a[href*="/status/"]');
  if (links.length === 0) return null;

  const candidates = links
    .map((link) => ({
      link,
      tweetId: parseTweetIdFromHref(link.getAttribute("href") || ""),
      hasTime: Boolean(link.querySelector("time")),
    }))
    .filter((item) => Boolean(item.tweetId));

  if (candidates.length === 0) return null;

  const timed = candidates.find((item) => item.hasTime);
  return timed?.link || candidates[0]?.link || null;
}

function getInteractiveLabel(node: Element): string {
  const parts = [
    node.getAttribute("aria-label") || "",
    node.getAttribute("data-testid") || "",
    node.getAttribute("title") || "",
    node.textContent || "",
  ];
  return parts.join(" ").toLowerCase();
}

function findGrokControl(article: HTMLElement): Element | null {
  const candidates = querySameTweet<Element>(
    article,
    "button[aria-label], button[title], div[role='button'][aria-label], div[role='button'][title]",
  );
  return candidates.find((node) => getInteractiveLabel(node).includes("grok")) || null;
}

function findMoreControl(article: HTMLElement): Element | null {
  const candidates = querySameTweet<Element>(
    article,
    "button, a, div[role='button']",
  );
  return candidates.find((node) => {
    const ariaLabel = (node.getAttribute("aria-label") || "").toLowerCase();
    const dataTestId = (node.getAttribute("data-testid") || "").toLowerCase();
    return ariaLabel === "more" ||
      ariaLabel.includes("more menu items") ||
      dataTestId === "caret";
  }) || null;
}

function findInsertionPoint(article: HTMLElement): {
  container: HTMLElement;
  before: Element;
} | null {
  const anchor = findMoreControl(article) || findGrokControl(article);
  if (!(anchor?.parentElement instanceof HTMLElement)) {
    return null;
  }

  return {
    container: anchor.parentElement,
    before: anchor,
  };
}

function stopEvent(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function openTotemReader(tweetId: string) {
  void chrome.runtime.sendMessage({
    type: "OPEN_TOTEM_READER",
    tweetId,
  }).catch(() => {});
}

function createButton(tweetId: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "totem-open-in-totem";
  button.setAttribute(BUTTON_ATTR, "");
  button.dataset.totemTweetId = tweetId;
  button.dataset.tooltip = "Open in Totem Bookmark Reader";
  button.setAttribute("aria-label", "Open in Totem");
  button.title = "Open in Totem Bookmark Reader";
  button.innerHTML = `
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect width="100" height="100" rx="18" fill="#1c1c1e"></rect>
      <path d="M20 80L80 80L80 20Z" fill="#e07a5f"></path>
      <path d="M80 20L52.5 47.5L80 80Z" fill="#c96b50"></path>
      <path d="M52.5 47.5L80 20" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"></path>
    </svg>
  `;

  button.addEventListener("mousedown", (event) => {
    event.stopPropagation();
  });
  button.addEventListener("click", (event) => {
    stopEvent(event);
    openTotemReader(tweetId);
  });

  return button;
}

function findManagedButton(article: HTMLElement): HTMLButtonElement | null {
  return querySameTweet<HTMLButtonElement>(article, `button[${BUTTON_ATTR}]`)[0] || null;
}

function ensureButton(article: HTMLElement) {
  if (!article.isConnected) return;

  const existing = findManagedButton(article);
  if (isNestedTweet(article)) {
    existing?.remove();
    return;
  }

  const statusLink = findStatusLink(article);
  const tweetId = parseTweetIdFromHref(statusLink?.getAttribute("href") || "");
  if (!tweetId) {
    existing?.remove();
    return;
  }

  const insertionPoint = findInsertionPoint(article);
  if (!insertionPoint) return;

  if (
    existing &&
    existing.dataset.totemTweetId === tweetId &&
    existing.parentElement === insertionPoint.container
  ) {
    if (existing.nextSibling !== insertionPoint.before) {
      insertionPoint.container.insertBefore(existing, insertionPoint.before);
    }
    return;
  }

  existing?.remove();
  insertionPoint.container.insertBefore(
    createButton(tweetId),
    insertionPoint.before,
  );
}

const pendingArticles = new Set<HTMLElement>();
let frameRequested = false;

function flushPendingArticles() {
  frameRequested = false;
  const articles = Array.from(pendingArticles);
  pendingArticles.clear();
  for (const article of articles) {
    ensureButton(article);
  }
}

function scheduleArticle(article: HTMLElement | null) {
  if (!article) return;
  pendingArticles.add(article);
  if (frameRequested) return;

  frameRequested = true;
  requestAnimationFrame(flushPendingArticles);
}

function scheduleFromNode(node: Node | null) {
  const closestArticle = closestTweetArticle(node);
  scheduleArticle(closestArticle);

  if (!isElement(node)) return;

  if (node.matches(TWEET_SELECTOR)) {
    scheduleArticle(node as HTMLElement);
  }

  for (const article of node.querySelectorAll<HTMLElement>(TWEET_SELECTOR)) {
    scheduleArticle(article);
  }
}

function scanDocument() {
  ensureStyles();
  for (const article of document.querySelectorAll<HTMLElement>(TWEET_SELECTOR)) {
    scheduleArticle(article);
  }
}

function startObserver() {
  scanDocument();
  if (!(document.body instanceof HTMLElement)) return;

  const root = document.querySelector<HTMLElement>('main[role="main"]') || document.body;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          scheduleFromNode(node);
        }
      }
    }
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
  });
}

function init() {
  if (window.__totemOpenInTotemInstalled) return;
  window.__totemOpenInTotemInstalled = true;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    return;
  }

  startObserver();
}

init();
