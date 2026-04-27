---
title: "Why Your Twitter/X Bookmarks 'Disappear' — The Real Bookmark Limit, Explained"
slug: twitter-x-bookmark-limit-explained
description: "X caps your visible bookmarks at the most recent 800 — that's why old ones go missing. Here's the official documentation, the storage gap nobody at X has cleaned up, and what to do about it."
publishedAt: 2026-04-26
draft: false
canonicalKeyword: twitter bookmarks limit
---

# Why Your Twitter/X Bookmarks 'Disappear' — The Real Bookmark Limit, Explained

**Your old bookmarks aren't deleted. They've fallen off a display window.** X shows you roughly your most recent 800 bookmarks and quietly hides the rest. Here is the citation that should end the debate, straight from X's own developer integration guide:

> **"With the GET method of the Bookmarks lookup endpoint you will get back 800 of your most recent Bookmarked Posts."**[^xapi]

That's the API ceiling. The bookmarks tab in the X app and on the web shows a comparable window. Once you cross 800, every new bookmark you add silently pushes an old one out of view — even though the old one almost certainly still exists on X's servers.

If you have ever bookmarked a thread, scrolled back to find it weeks later, and watched it not be there, this is what happened to you. You aren't crazy and X isn't deleting bookmarks to spite you. There are three different "limits" tangled together, and X has never officially reconciled them in plain language. The rest of this post does that.

## Three limits, often confused

1. **API limit:** the X Bookmarks API returns a maximum of **800 of your most recent bookmarked posts**. Officially documented.[^xapi]
2. **Display limit:** the X bookmarks tab in the app/web shows a similar window — roughly your most recent 800–1,000.
3. **Storage limit:** unknown. There is no published hard cap on what X stores server-side. Power users claim 200,000+ bookmarks intact. X has never officially confirmed the storage ceiling either way.

Items 1 and 2 are why old bookmarks disappear from your view. Item 3 is the open question that's been asked in X developer threads for years without a clean answer.

## The 800 cap, in detail

The endpoint is `GET /2/users/{id}/bookmarks`.[^xapi-ref] You can paginate up to 100 results per request, but the *total ceiling* is 800. The same docs spec rate limits at 180 requests per 15-minute window for GET and 50 per 15 minutes for POST/DELETE.[^xapi]

The Bookmarks API itself shipped on **March 24, 2022**[^api-launch] — and the 800 cap has been there since launch.

## "But I heard the limit was removed"

If you go searching, you will eventually find Twillot's tweet:

> "Actually, Twitter removed the 800 bookmark limit years ago. You don't need to worry about clearing them anymore — some users now have over 200,000 bookmarks stored!"
> — [Simon @Twillot](https://x.com/mytwillot/status/2012104116361929098)

This is plausibly correct *about underlying storage*. Third-party tools that scrape X (Twillot, Dewey, our own [Totem](https://usetotem.xyz)) routinely capture far more than 800 bookmarks per user without hitting a server-side cap. But there has been **no @XEng or @TwitterEng tweet** announcing the cap was removed; the official Bookmarks API documentation still states 800. The honest summary:

- **API ceiling:** still 800. Documented.
- **Storage:** appears uncapped in practice. Not officially documented.
- **App display window:** still ~800. Not officially documented.

That gap between "what X published" and "what users actually experience" is the entire reason this confusion exists.

## Why this feels like deletion

It feels like deletion because the failure mode is silent. From [Saverything's writeup](https://saverything.com/en/blog/twitter-bookmarks-limit/):

> "Free Twitter/X accounts can save up to 800 bookmarks."
>
> "**No warning before you reach the cap.** Twitter does not show you a bookmark count anywhere."
>
> "the icon may still briefly animate as if the save was successful. But if you navigate to your bookmarks list, the tweet is not there."[^saverything]

That last point is the cruel one: the bookmark button gives you the success animation even when the bookmark won't show up in your list afterward. The interaction is dishonest about its state.

People notice eventually. Carmel Heydarian wrote up the moment it clicked:

> "I was perplexed. Were my previous Bookmarks lost? I began my dive into learning about Twitter Bookmarks."[^heydarian]
>
> "I am not the only user who is struggling with the display limit of the Bookmarks feature. This does not even account for all the users who reached the Bookmark limit and remained silent."[^heydarian]

X developers ask the same question in the official forum, repeatedly. A thread from **October 2020** has a developer reporting they had "accumulated over 5,000 bookmarks and feared Twitter might have some limit on them."[^devcom-1] The thread sits without a clear official answer. A more recent one asks the question that exposes the ceiling-vs-storage gap directly:

> "considering the 800 limit for bookmark retrieval, if I remove my 100 most recent bookmarks, will I be able to get 100 older bookmarks that wouldn't be accessible otherwise?"[^devcom-2]

Unresolved. The developers asking are mostly building third-party tools — itself a tell about how widely the 800 cap is felt.

## The other reason bookmarks vanish: the source tweet was destroyed

Even under 800, bookmarks can vanish for a second reason that has nothing to do with caps. From Julia Colen's exit interview with Pocket-for-tweets:

> "Tweets I clearly remembered saving — a thread about content strategy, a crypto explanation I wanted to revisit, a productivity tip I promised myself I'd try — were gone."[^colen]
>
> "If the tweet owner deletes it, if they deactivate their account, if they go private, or if Twitter removes something — your bookmark silently disappears with it."[^colen]
>
> "**No message. No notification. Nothing.**"[^colen]

Bookmarks aren't snapshots — they're pointers. If the underlying tweet gets deleted, deactivated, taken down, or goes private (and you don't follow that account), the pointer goes with it. Your record of *what you saved* depends on someone else not changing their mind.

## A new wrinkle (October 2025): "Clear all" disappeared from desktop

In late 2025 a separate change made cleanup harder. The "Clear all bookmarks" action that used to live behind the more-icon (•••) at the top of the bookmarks tab on desktop **was quietly removed**:

> "the more icon (those three dots in the top corner) was nowhere to be found"[^techissues]
>
> The X Help Center previously documented the feature, but it is "now gone" from the desktop web version.[^techissues]

A user comment on the same article on October 25, 2025: **"Gone from the app too."**[^techissues]

We don't know if this is a regression that gets fixed, an intentional removal, or a phased rollout of something new. But for now, on desktop, you cannot easily clear all bookmarks at once within X.

## How to actually clear your bookmarks (mobile, while it still works)

If the mobile bulk-clear is still live for you:

1. Open the X app, tap your profile picture in the top left.
2. Select **Bookmarks**.
3. Tap the **three-dots** button at the top right.
4. Pick **Clear all Bookmarks** and confirm.[^idb]

If those options are missing, you have two choices:

- **One at a time** — tap the share icon on each post in your bookmarks timeline, then *Remove post from Bookmarks*.[^helpx]
- **Use a tool** that does it in bulk:
  - [Sajjad-s/twitter-remove-bookmarks-extension](https://github.com/Sajjad-s/twitter-remove-bookmarks-extension) — open source, free.
  - [Archivlyx](https://www.archivlyx.com/blog/how-to-delete-all-bookmarks-on-twitter) — free browser tool with date-range support.
  - [Twitter Remove All Bookmarks](https://chromewebstore.google.com/detail/twitter-remove-all-bookma/iihkahkpecadocofnadfnlppjhgbpndk) — paid Chrome extension.
  - [x-cleanup-tool](https://x-cleanup-tool.pages.dev/en/) — bookmarklet, no install required.

For posterity: X *did* recently add **search within bookmarks** for X Premium users[^bookmark-search] — the longest-requested fix to this whole feature. Useful, paywalled.

## What to do if you want your old bookmarks back

If you're under 800, no action needed — they're all there.

If you're over 800 and want the old ones recovered, you need a tool that has been **incrementally indexing your bookmarks** as you scrolled past them, *before* they fell off the cliff. Popular options:

- **Dewey** — paid, cloud-hosted.
- **Twillot** — freemium.
- **Tweetsmash** — freemium.
- **[Totem](https://usetotem.xyz)** — free, local-first (the bookmarks live in your browser's IndexedDB, not on a server we run).

Disclosure: we make Totem. The honest reason it exists isn't "we found a clever scraping trick." It's that the X bookmark experience is structurally bad — silent failures, vanishing tweets, no surface area for the things you saved — and the simplest fix is to capture your bookmarks locally as you encounter them and put them back in front of you on every new tab.

That last part — *in front of you* — is the part most third-party tools skip. Dewey lives at getdewey.co. You have to remember to open it. Twillot lives at app.twillot.com. Same. The bookmark you saved is back in another website you have to choose to visit. The whole reason you bookmarked it in the first place was that you didn't want to keep choosing.

## The takeaways

- The 800-most-recent ceiling is real and **officially documented** on the X Developer integration guide.[^xapi]
- The X app and web bookmarks tab show a comparable display window. Older bookmarks aren't deleted — they're hidden.
- Underlying server-side storage appears uncapped in practice, but X has not published a hard limit.
- Bookmarks vanish *separately* when the source tweet is deleted, the author deactivates/goes private, or X removes the post.
- Bulk-clear from desktop was removed in October 2025. Mobile bulk-clear may also be regressing.
- If you've ever searched "twitter bookmarks disappeared," what you actually need is a third-party tool that captures bookmarks locally before they fall off the display window.

We made one — [Totem](https://usetotem.xyz). Free, local-first, lives on your new tab. If you bookmark heavily and the disappearing-bookmark thing has bitten you even once, install it.

[^xapi]: X Developer documentation, [Bookmarks integration guide](https://developer.twitter.com/en/docs/twitter-api/tweets/bookmarks/integrate). Also corroborated in dev forum thread [#169433](https://devcommunity.x.com/t/bookmark-retrieves-only-800-most-recent/169433).
[^xapi-ref]: X API reference, [GET /2/users/{id}/bookmarks](https://docs.x.com/x-api/users/get-bookmarks). The reference page documents `max_results` (1–100 per request) and pagination tokens but does not restate the 800 total ceiling, which lives on the integration guide.
[^api-launch]: X (then Twitter) developer announcement, March 24, 2022: [Innovating on the Twitter API v2 and investing in our community](https://blog.x.com/developer/en_us/topics/community/2022/innovating-on-the-twitter-api-v2-and-investing-in-our-community), and the [community thread](https://devcommunity.x.com/t/build-with-bookmarks-on-the-twitter-api-v2/168804): "With the Bookmarks lookup endpoint, you will be able to get back up to 800 of your most recent bookmarked Tweets."
[^saverything]: Saverything, ["Twitter Bookmarks Limit in 2026"](https://saverything.com/en/blog/twitter-bookmarks-limit/).
[^heydarian]: Carmel Heydarian, ["I Crack the Code to Twitter's Bookmarks"](https://medium.com/@heydarianc/i-crack-the-code-to-twitters-bookmarks-1b1716fd2593).
[^colen]: Julia Colen, ["How I Exported My Twitter Bookmarks Before Losing Them"](https://medium.com/@juliacolen/how-i-exported-my-twitter-bookmarks-before-losing-them-and-why-you-should-too-f76de447a031).
[^devcom-1]: X Developer Community, ["There are no limits on number of bookmarks stored?"](https://devcommunity.x.com/t/there-are-no-limits-on-number-of-bookmarks-stored/144781), October 2020.
[^devcom-2]: X Developer Community, ["Bookmark retrieves only '800 most recent'?"](https://devcommunity.x.com/t/bookmark-retrieves-only-800-most-recent/169433).
[^techissues]: TechIssuesToday, ["X removed Clear All Bookmarks option on desktop version"](https://techissuestoday.com/x-removed-clear-all-bookmarks-option-on-desktop-version/).
[^idb]: iDownloadBlog, ["How to remove all Twitter bookmarks at once"](https://www.idownloadblog.com/2022/05/31/how-to-remove-all-twitter-bookmarks-at-once/).
[^helpx]: [help.x.com — About Bookmarks](https://help.x.com/en/using-x/bookmarks): "To remove a saved Bookmark, tap the share icon from the post within your Bookmarks timeline and select Remove post from Bookmarks."
[^bookmark-search]: Inquirer USA, ["X (Formerly Twitter) Now Allows You to Search Through Your Bookmarks"](https://usa.inquirer.net/152912/x-formerly-twitter-now-allows-you-to-search-through-your-bookmarks).
