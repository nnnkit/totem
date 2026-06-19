---
title: "Pocket Alternatives for 2026: A Decision Tree"
slug: pocket-alternatives-2026
description: "There is no single best Pocket alternative — there's the one that fits the kind of stuff you actually save. A decision tree, an honest comparison table, and the branch most listicles miss."
publishedAt: 2026-04-27
draft: false
canonicalKeyword: pocket alternative
---

# Pocket Alternatives for 2026: A Decision Tree

**There is no single "best Pocket alternative."** There is the alternative that fits **the kind of stuff you save** and **the place you want it to live**. The four-line answer:

- **Long-form articles, RSS, newsletters →** Readwise Reader (power) or Instapaper (simple).
- **Self-hosted / "this can't shut down on me" →** Wallabag, Readeck, or Linkwarden.
- **Already living in a notes app →** Obsidian Web Clipper.
- **Mostly Twitter/X threads →** keep reading; this is the branch every listicle skips.

The rest of this post is the why, an honest comparison table, and the small detour into the read-later tool nobody tells you about because it only does one thing well.

## A quick read on the room

Mozilla announced Pocket's shutdown on **May 22, 2025**. The service went dark on **July 8, 2025**. As of **November 12, 2025**, exports were disabled and all user data was queued for permanent deletion.[^moz-support] Annual subscribers got prorated refunds.[^verge] Mozilla's framing of why:

> "Pocket has helped millions save articles and discover stories worth reading. But the way people save and consume content on the web has evolved, so we're channeling our resources into projects that better match browsing habits today."[^moz-blog]

That last sentence is the one to chew on. *The way people save content has evolved.* Mostly: a lot of it is now Twitter/X threads. None of the popular Pocket alternatives are built for that.

The day Mozilla announced the shutdown, the Hacker News thread filled with users explaining why they had already left Pocket *before* it shut down. The reasons were the same as the reasons Pocket itself cited:

> "The latest iteration's search was *abysmal*… it became a FIFO basically. Unless you consume the list directly, hitting something you are looking for was nigh impossible."
> — bayindirh, [HN](https://news.ycombinator.com/item?id=44063662)

> "I have 32k saves and hit the same problems with search being extremely unreliable… quotes stopped working in search five years ago."
> — gxqoz, [HN](https://news.ycombinator.com/item?id=44063662)

But the comment that caught me was this one:

> "I came to the realization… I never actually read things I save."
> — al_borland, ["Ask HN: What Pocket alternatives did you move to?"](https://news.ycombinator.com/item?id=44597668)

That is the real read-later problem. It's not a tooling problem; it's a behavioral one. Anything you choose has to make you actually look at the thing you saved, not just collect more of them. Hold that thought — it's the whole reason the last branch of the decision tree exists.

This is also why Chrome's built-in Reading List is useful but limited: the save action exists, but the return surface is still easy to miss. The separate breakdown is here: [Chrome Reading List: where it is, how it works, and why nobody uses it](/blog/chrome-reading-list-why-nobody-uses-it).

The same return-surface question applies to your browser start point: [what to put on your Chrome new tab page](/blog/what-to-put-on-your-chrome-new-tab-page).

<a id="decision-tree"></a>
## The decision tree

Pick the branch that matches what you actually save and how you want to read it.

### Branch 1 — "I save a lot of long-form articles from RSS, newsletters, and random websites"

Use **Readwise Reader** if you want power features. It is the closest thing to a one-to-one Pocket-replacement-with-superpowers: highlights, RSS, PDFs, EPUBs, YouTube transcripts, Twitter thread compilation, full-text search, TTS. $9.99/mo on the annual plan ($12.99/mo monthly), 30-day free trial, 50% student discount.[^readwise]

Use **Instapaper** if you want simple. Zapier called it "the closest one-to-one Pocket replacement, but if it's not a good fit for you, you've still got options."[^zapier] Free tier is generous (unlimited saves, 5 notes/month). Premium is $5.99/mo or $59.99/yr.[^instapaper] Direct Pocket import:

> "It's simple and sleek. Provides direct import from Pocket."
> — isthistheme, [HN](https://news.ycombinator.com/item?id=44597668)

Use **Raindrop.io** if you want bookmarks-and-articles in one place with a visual UI. The free tier is unusually generous — unlimited bookmarks, 100 MB/month uploads, browser+iOS+Android+Mac apps.[^raindrop]

> "Imported all the Pocket stuff with no issues, free plan is enough for me."
> — pentagrama, [HN](https://news.ycombinator.com/item?id=44597668)

### Branch 2 — "I want self-hosted / open source / 'this can't shut down on me'"

After Pocket, after Omnivore (acquired by ElevenLabs in late October 2024 and shut down November 15, 2024[^elevenlabs]), this branch is increasingly busy.

Omnivore is the cautionary tale that makes this branch worth taking seriously. It gave users only about a two-week export window; after November 15, 2024, all hosted user data — saved articles, highlights, notes — was deleted with no recovery.[^heise] The most-shared independent-maker post-mortem was Steph Ango's (Obsidian's CEO):

> "Many people enjoyed Omnivore because it was free, but being free was part of its demise… As a user you must demand a way to pay makers for the products you love."
> — kepano, [X](https://x.com/kepano/status/1851555417165598790)

A free cloud read-later service with no revenue is a queue that can be switched off. The only versions that can't are the ones you host or store yourself. Three live options:

- **Wallabag** — free if self-hosted, €11/year for the hosted `wallabag.it`.[^wallabag] Pocket CSV import works.
- **Readeck** — newer, self-hosted only, very nice UI.
- **Linkwarden** — self-hosted with iOS app.

Voices from the migration:

> "I switched from Pocket to Wallabag years ago because I didn't like sponsored content and ads."
> — extr0pian, [HN](https://news.ycombinator.com/item?id=44597668)

> "I'm self hosting Readeck and I really like it. It's nicer than Pocket was… and it can't ever be shut down."
> — marklar423, [HN](https://news.ycombinator.com/item?id=44597668)

> "running on my TrueNAS and I connect their iOS app via Tailscale. Pure joy to use."
> — Lunatic666, on Linkwarden, [HN](https://news.ycombinator.com/item?id=44597668)

### Branch 3 — "I clip into a notes system anyway"

Use **Obsidian Web Clipper** ([obsidian.md/clipper](https://obsidian.md/clipper)). Free, open source, drops clips into your local Obsidian vault. No cloud lock-in. Browsers covered: Chrome, Firefox, Safari, Edge, Brave, Orion, Vivaldi, Arc.[^obsidian] If your "read later" is really "I will think about this later," this is the right shape.

> "I use Pocket to quickly capture an interesting article so I can a) read it later when I'm offline and b) move it manually to my notes."
> — Juha-Matti Santala, [hamatti.org](https://hamatti.org/posts/mozilla-is-shutting-down-pocket-what-next/)

### Branch 4 — "Most of what I bookmark is Twitter threads"

This branch is the one almost no listicle covers, and it's probably you. The Medium piece that floats around when this comes up calls it a graveyard:

> "**Your X (Twitter) Bookmarks Are a Graveyard.**"
>
> "The bookmark folder becomes a digital graveyard of ideas, particularly because most people save tweets impulsively. Very few process them systematically. This leads to information overload, unfinished intentions, forgotten signals, and mental noise."[^graveyard]

Or in the words of a developer who built a tool because his X bookmarks broke him:

> "I bookmark around 20-30 tweets a day on X… The problem? I would never go back, and if I did, I would never find what I needed again."
>
> X's bookmark feature is "a write-only database. Very disorganized and useless."
>
> — enzovarela, [Show HN](https://news.ycombinator.com/item?id=47384765)

This is the use case Pocket was *not* great at. Twitter thread compilation in Readwise Reader is good but lives behind a $9.99/mo paywall. Instapaper, Raindrop, Wallabag — they all save the URL, not the thread. And none of them ever lived where you actually start your day: a new browser tab.

This keeps surfacing in PKM communities on its own. One r/PKMS thread describes trying Raindrop and other bookmark managers and finding they can't pull a tweet's image, video, or text metadata — you keep the link but lose the visual and textual reference, which the poster says defeats the purpose.[^pkms-twitter] A saved URL to a media-heavy thread is a dead reference once you're not looking at the original.

That's the wedge our extension, **Totem**, fills. More on it below — and an honest disclaimer about who it's *not* right for.

If your Pocket replacement problem is really a Twitter-thread problem, [add Totem to Chrome](https://chromewebstore.google.com/detail/acpkgdfhoaalmnhjifhneghcgfnjkglo?utm_source=blog&utm_medium=inline_cta&utm_campaign=pocket-alternatives-2026) so those saves appear on every new tab instead of another read-later inbox.

<a id="comparison-table"></a>
## Honest comparison table

| Tool | Free? | Where it lives | Best for | Twitter threads? | Self-hosted? | Status |
|---|---|---|---|---|---|---|
| **Readwise Reader** | 30-day trial | Web app + extensions + mobile | Power users; highlights | Yes (compiles threads) | No | Active |
| **Instapaper** | Yes (5 notes/mo) | Web app + mobile | Simplicity; closest 1:1 Pocket | URL only | No | Active |
| **Raindrop.io** | Yes (unlimited) | Web + browser + mobile | Visual bookmarking | URL only | No | Active |
| **Wallabag** | Self-hosted | Web (your server) | Self-host stalwart | URL only | Yes | Active |
| **Readeck / Linkwarden** | Self-hosted | Web (your server) | New self-host options | URL only | Yes | Active |
| **Obsidian Web Clipper** | Yes | Local Obsidian vault | Notes-first workflows | URL only | Yes (local) | Active |
| **Matter** | Free tier | Mobile-first | iOS readers; AI TTS | URL only | No | Active |
| **Omnivore** | — | — | — | — | — | **Shut down Nov 15, 2024**[^elevenlabs] |
| **Pocket** | — | — | — | — | — | **Shut down July 8, 2025**[^moz-support] |
| **Totem** | Yes, free forever | Chrome new tab | X/Twitter bookmarks specifically | Yes (every bookmark) | Yes (local-first, in browser) | Active |

<a id="totem"></a>
## What we built, and the disclaimer

We made [Totem](https://usetotem.xyz) — a Chrome extension that replaces your new tab with the X/Twitter bookmarks you actually meant to read. Free, no login, no server, everything stored in your browser's local IndexedDB.

**It is not a 1:1 Pocket replacement.** This matters more than the marketing instinct. If most of what you save is articles from RSS or newsletters, install Readwise Reader or Instapaper. If you want self-hosted, install Wallabag or Readeck. We will wait.

Totem is right for you if all of the following are true:

- A meaningful chunk of what you save is on X/Twitter.
- You've ever opened X to "check bookmarks" and lost twenty minutes to the feed.
- You'd actually read the thing you saved if it were sitting in front of you.

If two of three are true, give it five minutes. If one of three is true, you probably want a different tool.

The reason we lean into the narrow scope: the post-Pocket era is full of cloud-hosted tools that promise to be everything to everyone, and a chunk of them disappear (Pocket, Omnivore, eventually others). Local-first means there's no server we can shut off. New-tab placement means the *behavioral* problem — saving more than you read — gets a daily nudge instead of a "remember to open this app" expectation.

Mozilla said the way people save content has evolved. If your saving has shifted toward Twitter threads, the tool you pick should know that.

## What to do today

1. **Migrate before the export window closes on the next tool.** The two big shutdowns set very different precedents: Pocket gave months of export; Omnivore gave roughly two weeks before permanent deletion.[^heise] The next tool's window may look more like Omnivore's than Pocket's — and there will be a next tool. People are still launching read-later apps positioned explicitly around the gap, like "Reeed… built after Pocket shut down," a Show HN from June 2026.[^reeed] The churn is not a closed chapter.
2. **Pick by what you save**, not by what the listicle ranks. Use the decision tree above.
3. **If a third or more of what you save is from X**, install [Totem](https://usetotem.xyz) alongside whatever long-form tool you pick. They don't conflict — they cover different surface area.

[^moz-support]: Mozilla, ["Future of Pocket"](https://support.mozilla.org/en-US/kb/future-of-pocket): "We made the difficult decision to shut down Pocket on July 8, 2025." And: "As of November 12, 2025, user data export has been disabled, and all user data has been queued for permanent deletion."
[^moz-blog]: Mozilla blog, ["Building what's next"](https://blog.mozilla.org/en/mozilla/building-whats-next/), May 22, 2025.
[^verge]: The Verge, ["Mozilla is shutting down Pocket and Fakespot"](https://www.theverge.com/news/672924/mozilla-pocket-fakespot-shutting-down): "Mozilla says it will start automatically canceling subscriptions… and will issue prorated refunds to users subscribed to its annual plan on July 8th."
[^readwise]: [readwise.io/pricing](https://readwise.io/pricing).
[^zapier]: Zapier, ["The 9 best Pocket alternatives"](https://zapier.com/blog/pocket-alternatives/), May 28, 2025.
[^instapaper]: [instapaper.com/premium](https://www.instapaper.com/premium).
[^raindrop]: [raindrop.io](https://raindrop.io).
[^elevenlabs]: ElevenLabs, ["Omnivore joins ElevenLabs"](https://elevenlabs.io/blog/omnivore-joins-elevenlabs).
[^wallabag]: [wallabag.org](https://wallabag.org) and [wallabag.it](https://wallabag.it/en/).
[^obsidian]: [obsidian.md/clipper](https://obsidian.md/clipper).
[^graveyard]: ["Your X (Twitter) Bookmarks Are a Graveyard"](https://medium.com/@kombib/notebooklm-twitter-bookmarks-signal-mining-04a97f1d474c), Medium.
[^heise]: heise online, ["Later-reading app Omnivore closes down"](https://www.heise.de/en/news/Later-reading-app-Omnivore-closes-down-9998733.html): Omnivore's hosted service went offline on November 15, 2024 after roughly a two-week export window, with user data deleted and no recovery; the AGPL-3.0 code remains on GitHub as self-host-only. Accessed June 19, 2026.
[^reeed]: Hacker News, ["Show HN: Reeed – a read-it-later app for iOS, built after Pocket shut down"](https://news.ycombinator.com/item?id=48449568), June 8, 2026. Accessed June 19, 2026.
[^pkms-twitter]: Reddit, r/PKMS, ["How can I effectively manage my Twitter (X) bookmarks without paying?"](https://www.reddit.com/r/PKMS/comments/1u58bom/how_can_i_effectively_manage_my_twitter_x/), accessed June 19, 2026. Paraphrased; thread content not independently re-verified.
