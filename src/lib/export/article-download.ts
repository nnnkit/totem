import type { ArticleContent } from "../../types";
import {
  articleToMarkdown,
  type ArticleMarkdownMetadata,
} from "./article-to-markdown";
import {
  articleToPrintDocumentHtml,
  type ArticlePrintHtmlMetadata,
} from "./article-to-print-html";
import { slugifyArticleBasename } from "./article-filename";

export { hasExportableArticle } from "./article-to-markdown";

export function suggestedArticleFilename(
  article: ArticleContent,
  extension: string,
): string {
  const base = slugifyArticleBasename(article);
  const ext = extension.replace(/^\./, "");
  return `${base}.${ext}`;
}

export function getArticleMarkdownString(
  article: ArticleContent,
  options?: {
    authorProfileImageUrl?: string;
    metadata?: ArticleMarkdownMetadata;
  },
): string {
  return articleToMarkdown(article, {
    authorProfileImageUrl: options?.authorProfileImageUrl,
    metadata: options?.metadata,
  });
}

export async function copyArticleMarkdownToClipboard(
  article: ArticleContent,
  options?: {
    authorProfileImageUrl?: string;
    metadata?: ArticleMarkdownMetadata;
  },
): Promise<boolean> {
  const md = getArticleMarkdownString(article, options);
  if (!navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    return false;
  }
}

export function downloadMarkdownFile(body: string, filename: string): void {
  const blob = new Blob([body], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so Safari doesn't cancel the pending download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadArticleMarkdown(
  article: ArticleContent,
  options?: {
    authorProfileImageUrl?: string;
    metadata?: ArticleMarkdownMetadata;
    filename?: string;
  },
): void {
  const md = getArticleMarkdownString(article, options);
  const name =
    options?.filename ?? suggestedArticleFilename(article, "md");
  downloadMarkdownFile(md, name);
}

export function printArticleAsPdf(
  article: ArticleContent,
  options?: {
    authorProfileImageUrl?: string;
    metadata?: ArticlePrintHtmlMetadata;
  },
): void {
  const html = articleToPrintDocumentHtml(article, {
    authorProfileImageUrl: options?.authorProfileImageUrl,
    metadata: options?.metadata,
  });

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:none;";
  iframe.srcdoc = html;
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    return;
  }

  const cleanup = () => {
    iframe.remove();
  };

  const triggerPrint = () => {
    const parentDoc = window.document;
    const previousParentTitle = parentDoc.title;
    const printSuggestedName = win.document.title;
    parentDoc.title = printSuggestedName;

    let finished = false;
    let fallbackId: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (fallbackId !== undefined) {
        window.clearTimeout(fallbackId);
      }
      parentDoc.title = previousParentTitle;
      cleanup();
    };

    win.addEventListener("afterprint", finish, { once: true });
    window.addEventListener("afterprint", finish, { once: true });
    fallbackId = window.setTimeout(finish, 15_000);

    try {
      win.focus();
      win.print();
    } catch {
      finish();
    }
  };

  const waitForImagesAndPrint = () => {
    const images = Array.from(win.document.querySelectorAll("img"));
    const pending = images.filter((img) => !img.complete);
    if (pending.length === 0) {
      requestAnimationFrame(triggerPrint);
      return;
    }

    let remaining = pending.length;
    const fallbackId = setTimeout(triggerPrint, 8000);
    const onReady = () => {
      remaining--;
      if (remaining <= 0) {
        clearTimeout(fallbackId);
        requestAnimationFrame(triggerPrint);
      }
    };
    for (const img of pending) {
      img.addEventListener("load", onReady, { once: true });
      img.addEventListener("error", onReady, { once: true });
    }
  };

  iframe.addEventListener(
    "load",
    () => {
      waitForImagesAndPrint();
    },
    { once: true },
  );
}
