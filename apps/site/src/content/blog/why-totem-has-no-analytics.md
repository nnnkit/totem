---
title: "Why Totem Has No Analytics Tracker"
slug: why-totem-has-no-analytics
description: "Why Totem keeps X / Twitter bookmark data local-first, uses no app analytics, and avoids tracking pixels inside the Chrome extension."
publishedAt: 2026-06-02
draft: false
canonicalKeyword: local first bookmark manager
---

# Why Totem Has No Analytics Tracker

Totem does not have app analytics inside the extension.

No event stream. No tracking pixel. No product analytics SDK. No hidden "anonymous usage" collector.

That is not because analytics would be technically hard. It is because the core material in Totem is too personal for casual measurement: the posts you save, the threads you return to, the notes you write, the highlights you make, and the reading state that shows what you actually finished.

![Totem privacy screen with callouts for x.com access, local cache, auth headers, and no tracking.](/blog/totem-extension-guides/local-first-annotated.png)

## The product is local-first by design

Totem stores your bookmark library in the browser.

Your notes, highlights, reading progress, cached bookmark details, and local search index live on this device. There is no Totem account to create and no Totem server-side library to sync with.

The extension uses your existing X session in the same browser profile. If you are logged in to X, Totem can sync from that session. It does not ask for your X password.

That design creates constraints:

- no cloud dashboard
- no cross-device Totem account
- no server-side recommendation graph
- no team analytics console

Those constraints are the point.

## Why no analytics?

Analytics would make some founder questions easier:

- Which button gets clicked most?
- How many people export?
- How often do people search?
- Which reader action is sticky?
- Where do users drop off?

Those are useful questions for us.

They are not more important than the user's saved reading being private by default.

Bookmark behavior is not neutral telemetry. It can reveal work projects, political interests, health worries, financial research, personal relationships, job searches, and half-formed thoughts. A bookmark app does not need to know that at the server level to be useful.

There is a second, quieter reason: an analytics pipeline is a liability waiting to change hands. The trust people place in an extension is in the version they installed, not the one it becomes after an acquisition. One recent example — an engineer noticed the StayFocusd extension had been bought by an app-analytics company and started making "a ton more BugSnag JS calls," and uninstalled it on the spot.[^stayfocusd] A backend that phones home is exactly the thing that changes behavior after the org behind it changes.

So Totem does not collect it.

## What the extension can access

Totem needs a small set of browser permissions to do its job:

| Permission area | Why it exists |
|---|---|
| `x.com` access | Sync bookmark data from your active X session |
| cookies | Scope the local cache to the right X account |
| webRequest | Read auth headers from your own X browser traffic |
| local browser storage | Store bookmarks, notes, highlights, reading progress, and settings |

Those permissions are uncomfortable if a product also has a tracking backend.

The cleaner answer is not "trust us with analytics." It is "there is no Totem analytics pipeline in the extension."

## What Totem sends

Totem sends bookmark requests to X so it can fetch the posts you saved.

It does not send your library to a Totem backend. There is no backend library.

It does not send your notes, highlights, reading progress, searches, opened bookmarks, export actions, or settings to a product analytics service.

When you export, the file is generated locally and downloaded by your browser. When you search, the local search index runs in the browser. When you mark something read, that reading state is stored locally.

## What we give up

No analytics means we lose visibility.

We cannot see which feature is most popular. We cannot build a funnel chart for export. We cannot tell whether a user opened the reader ten times or zero times. We cannot debug a user's library from a server console.

That makes product work slower.

But it keeps the boundary simple. If Totem does not collect the data, Totem cannot leak it, sell it, subpoena it from a backend, or accidentally join it to another identity system.

That "cannot leak it" is a response to named, documented events, not paranoia. In 2019, the DataSpii disclosure showed browser extensions scraping PII, browsing history, and even tax returns and genetic profiles from up to four million users, then monetizing it.[^dataspii] In June 2026, the malext.io "SearchJack" report documented 23 deceptive Chrome extensions that silently rerouted users' searches through monetization middleware, affecting roughly 758,000 users.[^searchjack] And a 2025 Incogni study of 238 AI-powered Chrome extensions found about 41% collect personally identifiable information such as passwords, financial details, and location.[^incogni] The pattern is consistent: the data a backend holds is the data that eventually leaks, sells, or gets re-pointed.

<div class="not-prose my-10">
  <p class="text-xs uppercase tracking-widest text-neutral-500">Field notes</p>
  <p class="mt-1 font-serif text-base leading-snug text-neutral-900">The worry about extension backends is earned, not abstract.</p>
  <div class="mt-4 flex flex-col gap-3">
    <figure class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-semibold text-neutral-700">infosec.exchange</span>
        <span class="text-neutral-400">·</span>
        <span class="text-neutral-500">Royce Williams, June 2026</span>
      </figcaption>
      <p class="mt-2 text-sm leading-relaxed text-neutral-800">A focus extension gets acquired, starts making <span class="font-medium text-neutral-900">"a ton more BugSnag JS calls"</span> — and gets uninstalled the same day.</p>
      <a href="https://infosec.exchange/@tychotithonus/116687260905870772" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-xs font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900">Read the post →</a>
    </figure>
    <figure class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-semibold text-neutral-700">malext.io</span>
        <span class="text-neutral-400">·</span>
        <span class="text-neutral-500">SearchJack report, June 2026</span>
      </figcaption>
      <p class="mt-2 text-sm leading-relaxed text-neutral-800">Because the operators control the traffic, the report warns, they can <span class="font-medium text-neutral-900">switch from regular results to phishing links or malicious downloads at any time.</span></p>
      <a href="https://malext.io/reports/SearchJack/" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-xs font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900">Read the report →</a>
    </figure>
  </div>
</div>

## How we learn instead

We still need feedback.

We use slower, more explicit channels:

- public issues
- direct email
- support messages
- user interviews
- local reproduction
- voluntary screenshots or exports when a user chooses to share them

That is less convenient than an event stream. It is also more honest. A bookmark reader should not silently turn the act of reading into product telemetry.

The cost is real, and it cuts both ways. Privacy-conscious defaults make work slower on our side, and they ask something of the user too — local-first means no cross-device sync, no "we already know what's broken" support. We accept the slower channels anyway, because the alternative is a backend that has to be trusted not to drift. Increasingly that tradeoff reads as a feature, not a limitation: "runs in the browser, nothing uploaded" and "no account needed" are now things people seek out and upvote, rather than apologize for.

## The rule

Totem is allowed to use your X session to fetch your bookmarks.

Totem is allowed to store your reading library locally so the product works.

Totem is allowed to export that library when you ask.

Totem is not allowed to watch your reading habits for our convenience.

That is the line.

[^stayfocusd]: Royce Williams (@tychotithonus), infosec.exchange, ["TIL the StayFocusd browser extension was purchased by an app analytics company..."](https://infosec.exchange/@tychotithonus/116687260905870772), accessed June 19, 2026.
[^dataspii]: DataSpii disclosure (Sam Jadali, July 2019), ["DataSpii: The catastrophic data leak via browser extensions"](https://dataspii.com/), accessed June 19, 2026.
[^searchjack]: malext.io, ["SearchJack" report](https://malext.io/reports/SearchJack/), accessed June 19, 2026.
[^incogni]: Incogni, ["Ranking AI-powered Chrome extensions by privacy risk in 2025"](https://blog.incogni.com/ranking-ai-powered-chrome-extensions-by-privacy-risk-in-2025/), accessed June 19, 2026.
