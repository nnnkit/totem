---
title: "Are X / Twitter Bookmarks Private? The Real Answer (2026)"
slug: are-x-twitter-bookmarks-private
description: "Short answer: yes. But the rumor that they're going public has resurfaced twice, and X did make one bookmark-related thing public in 2023. Here's exactly what is and isn't visible — with citations."
publish_target: 2026-W19
canonical_keyword: are twitter bookmarks public
---

# Are X / Twitter Bookmarks Private? The Real Answer (2026)

> "bookmarks are now public???"
> — [@slvppy on X](https://x.com/slvppy/status/1636429704105426945), March 16, 2023

That tweet went semi-viral on the day X first added bookmark counts to tweets. Three years and one likes-went-private cycle later, the same panic comes back every few months — usually attached to a fake screenshot impersonating @XEng. Here's the boring, true answer with citations.

## The TL;DR

**Your bookmarks are private.** Nobody — not the author of the tweet you bookmarked, not your followers, not the public — can see *which* tweets you've saved or *that you saved any specific tweet*.

X says this in its own help docs:

> "Bookmarks are private and are only viewable to you within your X account."[^helpx]

What changed in 2023 is that the **total bookmark count** on a tweet became public. The author of a tweet now sees how many people bookmarked it; nobody — including the author — sees who.

X's announcement of that change was explicit:

> "Starting today on iOS, you'll now see the total number of times a Tweet has been bookmarked on Tweet details."[^twsupport]

And, in the same breath:

> "We will never display which accounts have added a Tweet to their Bookmarks."[^twsupport]

That distinction — count yes, identities no — is what most of the recurring "are bookmarks going public??" rumors miss.

## The two things that actually happened

If you remember nothing else, remember these two dates and what each one did to bookmark privacy.

### March 16, 2023 — bookmark *counts* became public

X (then under Elon's first year) added the bookmark count to the engagement metrics row on tweet detail pages, alongside likes, retweets, replies, and views.[^smt-2023] The first hint had come earlier:

> "Yes, that will be added in an upcoming release. Also, if your tweet is bookmarked, it will be treated as a 'quiet like' and increment your likes counter."
> — [Elon Musk, January 20, 2023](https://x.com/elonmusk/status/1611932793130438656)[^smt-2023]

The "quiet like" / increment-likes part of that tweet **never shipped**. What shipped was simpler: a public count, no identities. That nuance got lost in the panic.

### June 11, 2024 — *likes* went private

Roughly a year later, X did the opposite move on a different feature: the Likes tab on profiles, previously public, was hidden for everyone.

> "This week we're making Likes private for everyone to better protect your privacy."
> — [@XEng, June 11, 2024](https://www.socialmediatoday.com/news/likes-are-now-private-on-x-formerly-twitter/718679/)[^smt-likes]

The reasoning came from Haofei Wang, X's Director of Engineering:

> "Public likes are incentivizing the wrong behavior. For example, many people feel discouraged from liking content that might be 'edgy' in fear of retaliation from trolls, or to protect their public image. Soon you'll be able to like without worrying who might see it."[^register]

This is the change that has made many people second-guess bookmark privacy ever since. Reasonable thought: *if likes went private, are bookmarks going public to compensate?*

No. They're not. Bookmarks were always private and remain private. What's confusing is that two opposite-direction changes happened to two different features in adjacent years, and people remember "X changed something about engagement privacy" and assume the worst.

## The recurring "X is making bookmarks public" rumor

Twice now (mid-2024 and mid-2025), screenshots impersonating @XEng have circulated claiming bookmarks would be made public. Both were fake. Soch Fact Check ran the more recent debunk:

> "Bookmarks remain private and only viewable to the user themselves."[^soch]

If you ever see a screenshot saying X is making bookmarks public, **assume it's fake until you find the actual @XEng or @Support tweet**. There has never been an official announcement of any such change.

## Specific questions, specific answers

### Can the author of a tweet see who bookmarked it?
No. They can see the count. They cannot see the names. X has explicitly committed to "never display which accounts have added a Tweet to their Bookmarks."[^twsupport]

### Does the bookmarker get notified to the tweet author?
No. The author is not notified when someone bookmarks their post. It is a silent action, by design.[^helpx]

### What if the tweet author opens their analytics?
The author sees aggregate numbers — total bookmarks alongside other engagement metrics — in the post-engagements drawer and at `x.com/i/account_analytics`. Bookmarks are one of the toggleable engagement metrics in the analytics CSV export. Identities are still not exposed.[^helpx]

### What happens to my bookmarks if I switch from a public account to a private one?
Nothing changes for the bookmarks themselves. Your bookmarks are private regardless of your account's public/private setting. They were always only visible to you.

### What about the people I follow — can they see what I bookmark?
No. Followers do not see your bookmarks under any circumstance.

### Is there any setting that *makes* my bookmarks public?
No. There is no toggle, no opt-in, no premium feature that exposes which posts you've bookmarked.

## Why bookmarks "go missing" sometimes (and it's not a privacy thing)

The other source of "are bookmarks public??" anxiety is people noticing that some of their old bookmarks have disappeared from the bookmarks tab. **That is not a privacy event.** It's a separate display-limit issue — X only renders roughly your most recent 800 bookmarks in the bookmarks tab, and the official X API endpoint confirms an 800-most-recent ceiling.[^xapi]

We covered that in [Why your Twitter/X bookmarks 'disappear' — the real bookmark limit, explained](#). If your bookmarks "feel" public because tweets you saved are showing up unexpectedly in someone else's view, the explanation is almost always something else: the tweet was retweeted by someone you follow, or the algorithm resurfaced it. The bookmark itself is invisible.

## A practical aside

Bookmarks are private. That is the good news. The bad news, behaviorally, is that they're *also* invisible to **you** most of the time — buried behind the X bookmarks tab, which you have to remember to open, which means visiting X, which usually means twenty minutes of scrolling instead of reading.

We built [**Totem**](https://totem.app) for that gap: a free Chrome extension that puts your X bookmarks on every new tab, so the things you saved show up in front of you instead of staying hidden. It's local-first — your bookmarks never leave your browser. No login, no server, no privacy trade-off.

If your concern about bookmark privacy is "I want my saves to *stay* private and *also* be useful," that's the right install.

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
