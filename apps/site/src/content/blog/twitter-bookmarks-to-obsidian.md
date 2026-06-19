---
title: "Twitter Bookmarks to Obsidian: What Actually Works in 2026 (After the API Broke Everything)"
slug: twitter-bookmarks-to-obsidian
description: "Every plugin that connected Twitter to Obsidian broke when the API closed in 2023. Here's what still works in 2026 — and the one thing that decides whether a tool survives."
publishedAt: 2026-06-19
draft: false
canonicalKeyword: twitter bookmarks to obsidian
---

# Twitter Bookmarks to Obsidian: What Actually Works in 2026 (After the API Broke Everything)

There are two versions of this question, and they have different answers.

One is: *I found a good tweet — how do I drop it into my vault?*

The other is: *I have years of bookmarks — how do I get all of them into Obsidian?*

Almost every guide blurs these together. They are not the same job, and after 2023 they stopped having the same answer.

Here is the part nobody leads with: X's account archive does not include your bookmarks. You can request every post, DM, like, and follower you have ever had, and your saved posts will not be in the file.[^x-archive] So moving bookmarks into Obsidian always means a third-party tool.

The only real question is which one — and whether it will still work next year.

That last part is the whole post.

## The most-linked answer is a tombstone

Search "tweet to markdown obsidian" and the top result is the same plugin it has been for years: kbravh's *Tweet to Markdown*. Open its README and the first thing you see is a warning banner:

> "Due to recent changes to the Twitter API, the free access method listed below has stopped working as of April 27, 2023."[^kbravh]

It still runs. You just have to pay now — "you need at least a Basic plan in order to look up tweets. The Free plan is not sufficient,"[^kbravh] and X's free API tier can no longer read tweets at all.[^api] The plugin's last release was December 2022.[^kbravh] It has more than thirteen thousand installs and still ranks first, and almost nobody who clicks it today can use it for free.

It is not alone. There is a small graveyard of tools with names like `bookmarks-to-obsidian` — "a lil project to sync Twitter bookmarks with an Obsidian vault" — whose last commit lands in early 2023, right as the API closed.[^rusowsky] They were built the proper way: sign up for a developer account, get a token, ask Twitter's API for your data. Then Twitter changed the price of that question, and the tools stopped being able to ask it.

So the first thing to understand is not a tool. It is why the old ones died.

## The one thing that decides whether a tool survives

Every guide ranks these tools by features. Does it grab threads? Images? Tags? Does it write nice YAML?

Those are real questions. They are also not the question that matters most, because none of them predict whether the tool will still work in a year.

The variable that predicts that is boring and almost never mentioned: **how the tool talks to X.**

There are three ways, and they age very differently.

<div class="not-prose my-10 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
  <div class="border-b border-neutral-200 px-6 py-4">
    <p class="text-xs uppercase tracking-widest text-neutral-500">How a tool connects to X</p>
    <p class="mt-1 font-serif text-base leading-snug text-neutral-900">This, not the feature list, is what decides if it still works next year.</p>
  </div>
  <div class="grid divide-y divide-neutral-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
    <div class="p-6">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs uppercase tracking-widest text-neutral-500">The official API</p>
        <span class="inline-flex items-center rounded-full bg-accent-100 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-accent-700">Fragile</span>
      </div>
      <p class="mt-3 font-serif text-lg leading-snug text-neutral-900">Asks Twitter for permission.</p>
      <p class="mt-1.5 text-sm leading-relaxed text-neutral-600">Needs a developer account and a token. This is the path X paywalled in 2023. The free tier can no longer read tweets at all.</p>
      <p class="mt-4 text-xs font-medium text-neutral-500">Killed the old plugins.</p>
    </div>
    <div class="p-6">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs uppercase tracking-widest text-neutral-500">Your own session</p>
        <span class="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-emerald-700">Durable</span>
      </div>
      <p class="mt-3 font-serif text-lg leading-snug text-neutral-900">Reads what your browser already loaded.</p>
      <p class="mt-1.5 text-sm leading-relaxed text-neutral-600">You are logged in; the data is already on your screen. No key, no plan, nothing to revoke. The tools that survived all do this.</p>
      <p class="mt-4 text-xs font-medium text-neutral-500">What the survivors use.</p>
    </div>
    <div class="p-6">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs uppercase tracking-widest text-neutral-500">A third-party relay</p>
        <span class="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-amber-700">It depends</span>
      </div>
      <p class="mt-3 font-serif text-lg leading-snug text-neutral-900">Routes through someone else's server.</p>
      <p class="mt-1.5 text-sm leading-relaxed text-neutral-600">Keyless and easy — paste a link, get Markdown. But the fetch happens on a service you don't control. It works until that service doesn't.</p>
      <p class="mt-4 text-xs font-medium text-neutral-500">Fine for one tweet.</p>
    </div>
  </div>
</div>

The clearest proof is a small natural experiment sitting in the search results.

The tools that beg the official API — kbravh's plugin, the bulk Python pipelines that want your developer tokens — are the ones that died or now cost money.[^kbravh][^rusowsky][^deriq] The tools that read your logged-in session are the ones still running. The most-starred Twitter exporter on GitHub, `prinsss/twitter-web-exporter`, was created in September 2023 — *after* the break — specifically so it would never touch the API. It watches the data your browser already receives and lets you export it. It has over 2,500 stars and was updated last month.[^prinsss]

The route Twitter blesses is the route Twitter killed. The route that feels like a workaround is the one that lasts.

## People have been asking this for years

This is not a new problem, and the questions keep the same shape.

<div class="not-prose my-10">
  <p class="text-xs uppercase tracking-widest text-neutral-500">Field notes</p>
  <p class="mt-1 font-serif text-base leading-snug text-neutral-900">The same request, asked across five years and a broken API.</p>
  <div class="mt-4 flex flex-col gap-3">
    <figure class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-semibold text-neutral-700">Obsidian forum</span>
        <span class="text-neutral-400">·</span>
        <span class="text-neutral-500">2021</span>
      </figcaption>
      <p class="mt-2 text-sm leading-relaxed text-neutral-800">"Is there an elegant solution for capturing content from Twitter?" — <span class="font-medium text-neutral-900">"e.g. saving Tweets and Tweet Thread to markdown form."</span></p>
      <a href="https://forum.obsidian.md/t/is-there-an-elegant-solution-for-capturing-content-from-twitter/12911" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-xs font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900">Read the thread →</a>
    </figure>
    <figure class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-semibold text-neutral-700">Obsidian forum</span>
        <span class="text-neutral-400">·</span>
        <span class="text-neutral-500">2023 — Twitter favorites as a vault</span>
      </figcaption>
      <p class="mt-2 text-sm leading-relaxed text-neutral-800">"I download all my favorites, and then dump them into an obsidian vault with some python code to link stuff up." <span class="font-medium text-neutral-900">"The flat list of favorites in twitter is terrible and I have no motivation to interact with it."</span></p>
      <a href="https://forum.obsidian.md/t/twitter-favorites-as-an-obsidian-brain-with-graphs-and-canvases/54342" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-xs font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900">Read the thread →</a>
    </figure>
    <figure class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-semibold text-neutral-700">r/ObsidianMD</span>
        <span class="text-neutral-400">·</span>
        <span class="text-neutral-500">after the plugin broke</span>
      </figcaption>
      <p class="mt-2 text-sm leading-relaxed text-neutral-800">"Is there an alternative way to download tweets to Obsidian <span class="font-medium text-neutral-900">beside tweet to markdown plugin?</span>"</p>
      <a href="https://www.reddit.com/r/ObsidianMD/comments/13j14p8/is_there_an_alternative_way_to_download_tweets_to/" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-xs font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900">Read the thread →</a>
    </figure>
    <figure class="rounded-xl border border-neutral-200 bg-neutral-50 p-5">
      <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span class="font-semibold text-neutral-700">Obsidian forum</span>
        <span class="text-neutral-400">·</span>
        <span class="text-neutral-500">2021 — a builder's reason</span>
      </figcaption>
      <p class="mt-2 text-sm leading-relaxed text-neutral-800">"A majority of the most valuable info I consume online comes from tweets and threads <span class="font-medium text-neutral-900">and I wanted a way to easily sync these to Obsidian (without manually copy-pasting)."</span></p>
      <a href="https://forum.obsidian.md/t/i-built-a-free-tool-to-save-tweets-and-threads-on-twitter-to-obsidian/28510" target="_blank" rel="noopener noreferrer" class="mt-3 inline-block text-xs font-medium text-neutral-500 underline underline-offset-2 transition-colors hover:text-neutral-900">Read the thread →</a>
    </figure>
  </div>
</div>

Two things stand out. The need is old and steady — people have wanted their saved tweets as plain Markdown notes since long before the API closed. And the favorite tools keep changing, because the cloud relays come and go while the underlying request stays exactly the same.

So let's answer it by job.

## If you just want one tweet

This is the easy half, and it is still easy.

If you only need to drop a single post or thread into your vault, you do not need a sync engine or an account. You need something that turns a URL into Markdown.

The fastest path in 2026 is the kind of relay tool described above. `tweet.md` lets you swap `x.com` for `tweet.md` in the address bar and hands back clean Markdown of the post or thread.[^tweetmd] Inside Obsidian, the *X/Twitter Post Embed* plugin does the same from a pasted link, including full threads and nested quote tweets — and it stays keyless by fetching through public relays like FxTwitter rather than the official API.[^postembed]

The catch is exactly the one in the card: these are convenient because someone else's server does the fetch. That is a different kind of fragility from the API — not a price change, but a service that can quietly go offline. For one tweet, that risk is fine. You are copying something now, while it loads.

For a one-off, a clipboard extension or even a careful copy-paste is also perfectly reasonable. The friction only becomes a real problem at scale.

## If you want your whole library

This is the half the API break actually broke, and where the connection method matters most.

A bookmark library is hundreds or thousands of posts. You cannot paste them one at a time, and you cannot ask the API for them without a paid plan. What is left is the durable middle column: tools that read your own logged-in session.

<div class="not-prose my-8 grid gap-3 sm:grid-cols-2">
  <div class="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
    <p class="text-xs uppercase tracking-widest text-neutral-500">One tweet</p>
    <p class="mt-1.5 font-serif text-base text-neutral-900">Turn a URL into a note.</p>
    <ul class="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-neutral-600">
      <li class="flex items-start gap-2"><span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400"></span><span>Paste-a-link relays (tweet.md, Post Embed)</span></li>
      <li class="flex items-start gap-2"><span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400"></span><span>No account, no setup</span></li>
      <li class="flex items-start gap-2"><span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-400"></span><span>Depends on a third-party server staying up</span></li>
    </ul>
  </div>
  <div class="rounded-2xl border border-neutral-200 bg-white p-5">
    <p class="text-xs uppercase tracking-widest text-neutral-500">Your whole library</p>
    <p class="mt-1.5 font-serif text-base text-neutral-900">Read your own session, in bulk.</p>
    <ul class="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-neutral-600">
      <li class="flex items-start gap-2"><span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300"></span><span>Browser-session tools (X Bookmarks Sync, Totem)</span></li>
      <li class="flex items-start gap-2"><span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300"></span><span>No API key, no developer plan</span></li>
      <li class="flex items-start gap-2"><span class="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300"></span><span>Survives Twitter's pricing changes</span></li>
    </ul>
  </div>
</div>

The most Obsidian-native of these is the *X Bookmarks Sync* community plugin. Its pitch is the whole thesis in one line: **"No API key. No OAuth. Just your existing browser session."**[^xbookmarks] It piggybacks on your logged-in X tab, pulls your bookmarks into Markdown notes with real YAML front matter and inline quoted tweets, and remembers what it already imported so re-running it doesn't duplicate. The honest caveats: it is young, it is desktop-only (it needs Obsidian's webview, so no mobile), and its images are saved as links to X's CDN rather than downloaded — which means if X moves the file, the link can rot.[^xbookmarks]

There is also a Chrome extension, *X to Obsidian Saver*, that auto-saves your likes and bookmarks as Markdown and can download images locally — newer and less proven, but on the same durable side of the line.[^saver] And if you only want the raw data out, `prinsss/twitter-web-exporter` is the workhorse: it exports bookmarks, lists, and tweets to JSON, CSV, and HTML, and it is the most actively maintained of the bunch.[^prinsss]

What you should skip, unless you enjoy the setup, is the impressive-looking AI pipeline. Repos like `deriqsocial/x-bookmarks-to-obsidian` build a Claude-enriched, wikilinked vault with tags and a knowledge graph — but they run on the official API *and* a paid Claude key, where "ingesting 100 bookmarks costs roughly $0.50–2.00."[^deriq] The README is gorgeous. The repo has almost no users, two paid dependencies, and the same fragile foundation that took down the last generation.

## Be honest about what survives the trip

No tool gives you a perfect copy, and the SERP is shy about saying so.

Threads are the first casualty. Some tools reconstruct them; many give you the single tweet you bookmarked and drop the rest. Quote tweets either nest cleanly or become a dead link to nothing. Long posts can arrive truncated. Video usually becomes a thumbnail. Images are often saved as links back to X rather than real files — which is the difference between an archive and a folder of future broken images.

When you compare tools, this is the table to build in your head: thread, quote tweet, long text, image, video. Most "Obsidian support" claims quietly mean "the text, and a link for everything else."

## The part nobody says: this is archival, not note-taking

Most of these guides frame the goal as a workflow — feed your second brain, connect ideas, build a graph.

That is a nice side effect. It is not the real reason this matters.

The real reason is that the moment a tweet becomes plain-text Markdown in a folder you own, it stops being able to disappear. The author can delete it, the account can get suspended, X can change a policy, and your note is unaffected — because the content now lives in a second place you control. As one current export guide puts it, exporting "is the path that actually survives a tweet getting deleted, because the content lives in a second place you control."[^keepmd] Another is blunter about the stakes: "if a creator deletes their post, your bookmark disappears forever."[^bookmarksbrain]

This is also the quiet reason the official API was never the right tool for the job. You cannot fetch a deleted tweet from the API — once it is gone from the timeline, it is gone from the endpoint. The only way to keep a post is to have already captured it while you could see it. The durable connection method and the archival goal turn out to be the same point from two directions: the tools that read what is in front of you are the only ones that can save something before it vanishes.

Getting your bookmarks into Obsidian is not really a note-taking task. It is the act of making a copy before the platform changes its mind.

## What "Obsidian-ready" actually means

One more honest distinction, because exporters blur it.

A folder of `.md` files is not the same thing as a vault that can do anything with them. Obsidian reads YAML front matter as **Properties**, which is what makes a note queryable — you can ask Dataview for every saved tweet by a given author, or tagged a certain way, or saved this month.[^properties] An export with rich, typed front matter slots into that. An export that is just the tweet text in a file does not; it is readable, but it is inert.

So "exports to Markdown" and "works with Obsidian" are different claims. The first is table stakes. The second means the front matter, links, and structure are shaped for the vault, not just dropped into it. Most tools deliver the first and describe it as the second.

## Where Totem fits

Totem is a local-first Chrome extension for X / Twitter bookmarks. It is worth being precise about what it does here, because this post is built on being precise about everyone else.

Totem sits on the durable side of the line. It captures bookmarks by reading the data your browser already receives on x.com — your own session, not the official API — and stores them locally, in your browser, with no account and no Totem server.[^totem-export] So it does not break when Twitter reprices the API, for the same reason the survivors above don't.

Its export is a ZIP: one Markdown file per bookmark, each with YAML front matter, plus a readme index, a CSV, the canonical JSONL, and a checksummed manifest.[^totem-export] That Markdown is Obsidian-ready in the literal sense — unzip the `bookmarks` folder into your vault and the notes are right there, Properties and all.

What it is not, today, is a one-click "sync to your vault" button. There is no live folder connection yet; getting the notes in is an unzip, not a background sync. If a native vault writer is exactly what you want, the *X Bookmarks Sync* plugin above is built for that specific job, and it is good at it. Totem's angle is different: a local, searchable reading queue of your bookmarks that you can also export to clean Markdown whenever you want a copy.

If your problem is "I want all my bookmarks somewhere I own, in a format I can read and re-read," you can [add Totem to Chrome](https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo) — free, no login. If your problem is the broader question of how to get bookmarks out of X at all, start with [how to export your Twitter bookmarks](/blog/how-to-export-twitter-bookmarks) and [what actually gets exported](/blog/what-gets-exported-twitter-bookmarks). And if the honest reason your bookmarks are piling up is that you never go back to them, that is a different post: [why your bookmarks become a graveyard](/blog/twitter-bookmarks-are-a-graveyard).

## The short answer

Every plugin that connected Twitter to Obsidian through the API broke in 2023, and the most-linked one is still broken behind a paywall most people will never pay.

What works now reads your own logged-in session instead of asking Twitter's API for permission. That single design choice — not the feature list — is what decides whether a tool still works next year.

So pick by connection, not by checkbox:

- For one tweet, a paste-a-link tool is fine.
- For your whole library, use something that reads your session in bulk.
- And remember what you are actually doing. You are not building a workflow. You are making a copy of things that can otherwise disappear — which is the one job the official, "proper" route was never able to do.

[^x-archive]: X Help Center, ["How to download your X archive and Posts"](https://help.x.com/managing-your-account/how-to-download-your-twitter-archive). The archive lists profile data, posts, Direct Messages, media, followers, and Lists — bookmarks are not included. See also [how to export your Twitter bookmarks](/blog/how-to-export-twitter-bookmarks).
[^kbravh]: [kbravh/obsidian-tweet-to-markdown](https://github.com/kbravh/obsidian-tweet-to-markdown), README banner: "Due to recent changes to the Twitter API, the free access method listed below has stopped working as of April 27, 2023," and "You need at least a Basic plan in order to look up tweets. The Free plan is not sufficient." As of June 2026 the repo's last release (2.12.1) dates to December 2022 and its last commit to May 2023 — ~13,600 downloads, 220 stars — yet it still ranks at the top for "tweet to markdown obsidian." Accessed June 19, 2026.
[^api]: X's free API tier is write-only and cannot look up tweets; reading requires a paid developer plan. Note that as of early 2026 X moved new developers toward pay-per-use rather than the old flat Basic/Pro tiers. See [The X API price hike](https://www.wearefounders.uk/the-x-api-price-hike-a-blow-to-indie-hackers/), accessed June 19, 2026.
[^rusowsky]: [0xrusowsky/bookmarks-to-obsidian](https://github.com/0xrusowsky/bookmarks-to-obsidian), described as "a lil project to sync Twitter bookmarks with an Obsidian vault." Created January 2023, last commit February 2023; it uses a Twitter developer account and OAuth2. A representative example of the API-route tools that went dormant as the API closed. Accessed June 19, 2026.
[^prinsss]: [prinsss/twitter-web-exporter](https://github.com/prinsss/twitter-web-exporter), an MIT-licensed userscript that exports tweets, bookmarks, and lists by reading the responses the browser already receives — no API key. Created September 2023, 2,500+ stars, last pushed May 2026. Accessed June 19, 2026.
[^deriq]: [deriqsocial/x-bookmarks-to-obsidian](https://github.com/deriqsocial/x-bookmarks-to-obsidian), a pipeline that builds an enriched vault using the official X API plus the Anthropic API: "ingesting 100 bookmarks costs roughly $0.50–2.00 depending on article length and image count." New repo, near-zero adoption. Accessed June 19, 2026.
[^xbookmarks]: [X Bookmarks Sync](https://community.obsidian.md/plugins/x-bookmarks-sync) (Obsidian community plugin, source: [teddy0605/xbookmarks](https://github.com/teddy0605/xbookmarks)): "No API key. No OAuth. Just your existing browser session." Works by piggybacking on your logged-in X tab; desktop-only; latest release 1.2.1 (March 2026). Accessed June 19, 2026.
[^saver]: [X to Obsidian Saver](https://chromewebstore.google.com/detail/x-to-obsidian-saver/bionmgfimcihmbnfgbckfmbnkdlcdnfk), a Chrome extension that auto-saves liked and bookmarked tweets as Markdown with local image download; version 1.0.0, last updated March 2026. Accessed June 19, 2026.
[^tweetmd]: tweet.md — replace `x.com` with `tweet.md` in a post's URL to get clean Markdown of the post or thread, with an API for scripts. A relay service: the conversion happens on its servers, not in your browser. Accessed June 19, 2026.
[^postembed]: [X/Twitter Post Embed](https://www.obsidianstats.com/plugins/x-twitter-post-embed), an Obsidian plugin that turns a pasted link into a formatted tweet with full thread and nested quote-tweet support. It stays keyless by fetching through public relays (the FxTwitter API, with Twitter's oEmbed as a fallback) rather than the official API. Accessed June 19, 2026.
[^keepmd]: keep.md, ["The complete guide to Twitter bookmarks"](https://keep.md/blog/twitter-bookmarks-guide): "This is the path that actually survives a tweet getting deleted, because the content lives in a second place you control." Its companion ["How to export your X bookmarks in 2026"](https://keep.md/blog/export-x-bookmarks) notes that "X's platform changes broke a lot of these integrations in 2023 and 2024, and the rebuilt versions use the official X API, which now charges." Accessed June 19, 2026.
[^bookmarksbrain]: BookmarksBrain, ["Exporting Twitter Bookmarks to Obsidian: The Complete Guide"](https://www.bookmarksbrain.com/blog/export-twitter-bookmarks-obsidian): "if a creator deletes their post, your bookmark disappears forever." Accessed June 19, 2026.
[^properties]: Obsidian Help, ["Properties"](https://help.obsidian.md/Editing+and+formatting/Properties). Obsidian reads YAML front matter as typed Properties, which tools like Dataview can query. Accessed June 19, 2026.
[^totem-export]: Totem is local-first: bookmarks are captured from the data your browser already receives on x.com and stored in IndexedDB, with no account and no server. Its export is a ZIP containing one Markdown file per bookmark with YAML front matter, a `readme.md` index, `bookmarks.csv`, canonical `data/*.jsonl`, and a checksummed `manifest.json`. See [Export Format v1](/export-format/v1) and [what actually gets exported](/blog/what-gets-exported-twitter-bookmarks).
