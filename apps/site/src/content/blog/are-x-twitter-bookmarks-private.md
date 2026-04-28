---
title: "Are X / Twitter Bookmarks Private? The Real Answer (2026)"
slug: are-x-twitter-bookmarks-private
description: "Yes — your X bookmarks are private. Nobody sees what you saved. But the rumor that they're going public has resurfaced twice, and X did make one bookmark-related thing public in 2023. Here's exactly what is and isn't visible."
publishedAt: 2026-04-25
draft: false
canonicalKeyword: are twitter bookmarks public
---

# Are X / Twitter Bookmarks Private? The Real Answer (2026)

**Yes. Your X bookmarks are private.** Nobody — not the author of the tweet you saved, not your followers, not the public — can see *which* posts you've bookmarked or *that you bookmarked any specific post*. X says so in its own help docs:

> "Bookmarks are private and are only viewable to you within your X account."[^helpx]

If you came here to confirm that and leave, you're done. If you've seen the recurring "bookmarks are going public!" panic and want to know where it comes from, keep reading — there's one real change that started the rumor, and it's not the change people think it is.

## The one thing that did change: counts, not identities

On **March 16, 2023**, X added a bookmark count to the engagement row on tweet details. The author of a tweet now sees how many people bookmarked it. Nobody — including the author — sees who. X's own announcement was explicit on both halves:

> "Starting today on iOS, you'll now see the total number of times a Tweet has been bookmarked on Tweet details."[^twsupport]
>
> "We will never display which accounts have added a Tweet to their Bookmarks."[^twsupport]

The seed of the panic was Elon Musk's tweet two months earlier:

> "Yes, that will be added in an upcoming release. Also, if your tweet is bookmarked, it will be treated as a 'quiet like' and increment your likes counter."
> — [Elon Musk, January 20, 2023](https://x.com/elonmusk/status/1611932793130438656)[^smt-2023]

The "quiet like / increment likes counter" half **never shipped**. What shipped was a public count with no identities attached. That nuance got lost, and one tweet from @slvppy on launch day caught the vibe:

> "bookmarks are now public???"
> — [@slvppy, March 16, 2023](https://x.com/slvppy/status/1636429704105426945)

They weren't. They aren't.

## Why people keep re-asking: likes went private a year later

Here's the move that confuses everyone. On **June 11, 2024**, X did the opposite thing to a different feature — Likes, previously public on profiles, were hidden:

> "This week we're making Likes private for everyone to better protect your privacy."
> — [@XEng, June 11, 2024](https://www.socialmediatoday.com/news/likes-are-now-private-on-x-formerly-twitter/718679/)[^smt-likes]

Haofei Wang, X's Director of Engineering, explained:

> "Public likes are incentivizing the wrong behavior. For example, many people feel discouraged from liking content that might be 'edgy' in fear of retaliation from trolls, or to protect their public image."[^register]

Now picture the average user reading the news in 2024: *X just changed engagement privacy. Did bookmarks change too? Are they going public to compensate?* That's the source of the recurring rumor — two opposite-direction changes to two different features in adjacent years, collapsed in memory into "X did something to bookmarks."

It didn't. Bookmarks were always private and remain private.

## The fake @XEng screenshots

Twice now (mid-2024 and mid-2025), screenshots impersonating @XEng have circulated claiming bookmarks are about to be made public. Both fake. Soch Fact Check ran the more recent debunk:

> "Bookmarks remain private and only viewable to the user themselves."[^soch]

If you see one of these screenshots in the future: assume it's fake until you find the actual @XEng or @Support tweet on x.com. There has never been an official announcement of any such change.

## Specific questions, specific answers

### Can the author of a tweet see who bookmarked it?
No. They see the count. They cannot see the names. X has explicitly committed to "never display which accounts have added a Tweet to their Bookmarks."[^twsupport]

### Does the author get notified when I bookmark?
No. Silent action, by design.[^helpx]

### What does the author see in their analytics?
Aggregate numbers — total bookmarks alongside other engagement metrics — in the post-engagements drawer and at `x.com/i/account_analytics`. Bookmarks are one of the toggleable engagement metrics in the analytics CSV export. Identities are still not exposed.[^helpx]

### What if I switch from a public to a private account?
Nothing changes for the bookmarks. They were always only visible to you, regardless of your account setting.

### Can my followers see what I bookmark?
No. Followers do not see your bookmarks under any circumstance.

### Is there a setting that makes bookmarks public?
No. No toggle, no opt-in, no premium feature.

## Why bookmarks "go missing" — and why it isn't a privacy thing

The other source of bookmark-privacy anxiety is the moment people notice old bookmarks have disappeared from the bookmarks tab. That's not a privacy event. It's a display limit — X renders roughly your most recent 800 bookmarks in the tab, and the official API endpoint confirms an 800-most-recent ceiling.[^xapi] We covered that in [Why your Twitter/X bookmarks 'disappear' — the real bookmark limit, explained](/blog/twitter-x-bookmark-limit-explained).

If a tweet you bookmarked is showing up unexpectedly in someone else's feed, the explanation is almost always something other than your bookmark — usually a retweet by someone they follow, or the algorithm resurfacing it. The bookmark itself is invisible.

## A practical aside

Bookmarks are private. That's the good news. The bad news, behaviorally, is that they're *also* invisible to **you** most of the time — buried behind the X bookmarks tab, which you have to remember to open, which means visiting X, which usually means twenty minutes of scrolling instead of reading.

We built [**Totem**](https://usetotem.xyz) for that gap: a free Chrome extension that puts your X bookmarks on every new tab, so the things you saved sit in front of you instead of staying hidden. Local-first — your bookmarks never leave your browser. No login, no server, no privacy trade-off.

If your concern is "I want my saves to *stay* private and *also* be useful," that's the right install.

## Sources

- X Help Center, ["About Bookmarks"](https://help.x.com/en/using-x/bookmarks)
- X Help Center, ["About bookmark counts"](https://help.x.com/en/using-x/bookmark-counts)
- @TwitterSupport, March 16, 2023 — bookmark counts announcement (cited via Social Media Today)
- @XEng, June 11, 2024 — likes-private announcement (cited via Social Media Today)
- Haofei Wang, [tweet preview May 22, 2024](https://x.com/wanghaofei/status/1793096366132195529)
- Soch Fact Check, ["X (Twitter) is not making bookmarks visible to public"](https://www.sochfactcheck.com/x-twitter-is-not-making-bookmarks-visible-to-public/)
- X Developer documentation, [Bookmarks integration guide](https://developer.twitter.com/en/docs/twitter-api/tweets/bookmarks/integrate)

[^helpx]: [help.x.com — About Bookmarks](https://help.x.com/en/using-x/bookmarks). The page text reads, in part: "Bookmarks lets you save posts in a timeline for easy, quick access at any time… Bookmarks are private and are only viewable to you within your X account."
[^twsupport]: @TwitterSupport, March 16, 2023, announcing the public bookmark counts change: "Starting today on iOS, you'll now see the total number of times a Tweet has been bookmarked on Tweet details." And in the same announcement: "We will never display which accounts have added a Tweet to their Bookmarks." Cited via [Social Media Today](https://www.socialmediatoday.com/news/twitter-adds-tweet-bookmark-count-to-details-view/645268/).
[^smt-2023]: Social Media Today, ["Twitter Adds Tweet Bookmark Count to Details View"](https://www.socialmediatoday.com/news/twitter-adds-tweet-bookmark-count-to-details-view/645268/), March 16, 2023.
[^smt-likes]: Social Media Today, ["Likes Are Now Private on X, Formerly Twitter"](https://www.socialmediatoday.com/news/likes-are-now-private-on-x-formerly-twitter/718679/), June 2024.
[^register]: The Register, ["X to make user 'likes' private"](https://www.theregister.com/2024/06/12/x_hides_likes/), June 12, 2024.
[^soch]: Soch Fact Check, ["X (Twitter) is not making bookmarks visible to public"](https://www.sochfactcheck.com/x-twitter-is-not-making-bookmarks-visible-to-public/).
[^xapi]: X Developer documentation, [Bookmarks integration guide](https://developer.twitter.com/en/docs/twitter-api/tweets/bookmarks/integrate): "With the GET method of the Bookmarks lookup endpoint you will get back 800 of your most recent Bookmarked Posts."
