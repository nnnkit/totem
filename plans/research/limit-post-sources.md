# Bookmark Limit Post — Source Material

For Post 3: "Why your Twitter/X bookmarks 'disappear' — the real bookmark limit, explained"

---

## The single most important citation (for the thesis)

### X Developer integration guide — VERIFIED VERBATIM
URL: https://developer.twitter.com/en/docs/twitter-api/tweets/bookmarks/integrate

> **"With the GET method of the Bookmarks lookup endpoint you will get back 800 of your most recent Bookmarked Posts."**

> GET requests: "user rate limit of 180 requests per 15 min window"
> POST and DELETE requests: "user rate limit of 50 requests per 15 minutes"

This is the X-published 800 cap. It is real, it is documented, and competitor blog posts hand-wave around it. Quote it verbatim, pull rank.

API endpoint reference: https://docs.x.com/x-api/users/get-bookmarks (note: `max_results` cap is **100 per request**; the 800 ceiling is total).

Auth note: requires OAuth 2.0 Authorization Code Flow with PKCE on the user's behalf.

API launched March 24, 2022:
- https://blog.x.com/developer/en_us/topics/community/2022/innovating-on-the-twitter-api-v2-and-investing-in-our-community
- https://devcommunity.x.com/t/build-with-bookmarks-on-the-twitter-api-v2/168804

---

## The "800 was removed years ago" counter-claim

### Twillot tweet — text confirmed via Google `<title>` index
URL: https://x.com/mytwillot/status/2012104116361929098

> **"Actually, Twitter removed the 800 bookmark limit years ago. You don't need to worry about clearing them anymore — some users now have over 200,000 bookmarks stored!"**
> — Simon @Twillot

**Crucial caveat:** there is **no @XEng / @TwitterEng / official X tweet** corroborating that the 800 limit was ever removed. Twillot's claim is the source. The post should report it accurately *and* note that X has not confirmed it — which fits the post's thesis (X has never published a clean reconciliation between the API cap and storage).

---

## Verified first-person panic quotes (Medium — fetched verbatim)

### Carmel Heydarian — "I Crack the Code to Twitter's Bookmarks"
https://medium.com/@heydarianc/i-crack-the-code-to-twitters-bookmarks-1b1716fd2593

> "I was perplexed. Were my previous Bookmarks lost? I began my dive into learning about Twitter Bookmarks."

> "I decided to test the major assumption about Bookmarks: were Bookmarks being deleted?"

> "Through this exploration, I discoverd [sic] that I am not the only user who is struggling with the display limit of the Bookmarks feature."

> "This does not even account for all the users who reached the Bookmark limit and remained silent."

### Julia Colen — "How I Exported My Twitter Bookmarks Before Losing Them"
https://medium.com/@juliacolen/how-i-exported-my-twitter-bookmarks-before-losing-them-and-why-you-should-too-f76de447a031

> "Tweets I clearly remembered saving — a thread about content strategy, a crypto explanation I wanted to revisit, a productivity tip I promised myself I'd try — were gone."

> "If the tweet owner deletes it, if they deactivate their account, if they go private, or if Twitter removes something — your bookmark silently disappears with it."

> "No message. No notification. Nothing."

> **"A bookmark on Twitter isn't a 'save.' It's a 'maybe it'll still be here later.'"** ← USE AS PULL QUOTE

> "Bookmarks vanish if anything happens to the original tweet. And because Twitter doesn't show you which ones disappeared, you only notice when it's too late."

### Onurdan — "How I Finally Exported All My Twitter Bookmarks"
https://onurdan.medium.com/how-i-finally-exported-all-my-twitter-bookmarks-11ae887b8b0a

> "I've always been a bit of a digital hoarder. If I see something useful on Twitter — an article, a thread, a tip — I bookmark it so I can refer back. Over time, though, the list got huge."

> "bookmarks are private, unorganized, and there's no built-in export feature."

### Saverything — verbatim
https://saverything.com/en/blog/twitter-bookmarks-limit/

> "Free Twitter/X accounts can save up to 800 bookmarks."

> "No warning before you reach the cap. Twitter does not show you a bookmark count anywhere."

> "the icon may still briefly animate as if the save was successful. But if you navigate to your bookmarks list, the tweet is not there."

> "No search within bookmarks" — described as "arguably the most significant gap."

---

## Recent regression — "Clear all bookmarks" removed from desktop

### TechIssuesToday — verbatim
https://techissuestoday.com/x-removed-clear-all-bookmarks-option-on-desktop-version/

> "the more icon (those three dots in the top corner) was nowhere to be found"

> The X Help Center previously documented the feature but it is "now gone" from the desktop web version.

> User comment from "Jerry," October 25, 2025: **"Gone from the app too"**

This is a fresh news angle — bulk-clear is regressing. Worth a sidebar in the post.

---

## How to clear bookmarks (mobile, while it still works)

### iDownloadBlog — verbatim
https://www.idownloadblog.com/2022/05/31/how-to-remove-all-twitter-bookmarks-at-once/

1. "Open the X app and tap your profile picture from the top left."
2. "Select Bookmarks."
3. "Choose the three-dots button from the top right."
4. "Finally, pick Clear all Bookmarks and confirm by tapping Yes, I'm sure."

### Tools to bulk-delete (cite as alternatives)
- **Sajjad-s/twitter-remove-bookmarks-extension** (open source) — https://github.com/Sajjad-s/twitter-remove-bookmarks-extension
  - Description: "Quickly remove all your Twitter/X bookmarks in one click. Simple, private, and fast."
- **Twitter Remove All Bookmarks** (paid Chrome extension, ~$4.99/mo) — https://chromewebstore.google.com/detail/twitter-remove-all-bookma/iihkahkpecadocofnadfnlppjhgbpndk
- **Archivlyx** (free browser tool, date-range) — https://www.archivlyx.com/blog/how-to-delete-all-bookmarks-on-twitter
- **x-cleanup-tool** (bookmarklet) — https://x-cleanup-tool.pages.dev/en/

---

## X Help Center — bookmarks page (snippet-level only)
URL: https://help.x.com/en/using-x/bookmarks

> "To remove a saved Bookmark, tap the share icon from the post within your Bookmarks timeline and select Remove post from Bookmarks."

> "You can tap the more icon at the top of your Bookmarks timeline to remove all of your bookmarks at once."

> "Bookmarks are private and are only viewable to you within your X account."

---

## Recent product change — Bookmark search
URL: https://usa.inquirer.net/152912/x-formerly-twitter-now-allows-you-to-search-through-your-bookmarks
- X added in-bookmark search for Premium users (long-requested feature, fixes one of the gaps Saverything called out).

Bookmark counts page: https://help.x.com/en/using-x/bookmark-counts
> "Only the total number of bookmarks is shown, not the specific accounts."

---

## Devcommunity threads (existence confirmed, verbatim quotes blocked)

These threads exist and corroborate the 800-cap confusion among developers. Cite by URL as evidence the question is asked frequently:
- https://devcommunity.x.com/t/there-are-no-limits-on-number-of-bookmarks-stored/144781 (Oct 2020 — dev with 5,000+ bookmarks worried about a limit)
- https://devcommunity.x.com/t/how-to-get-more-than-800-bookmarks/204704
- https://devcommunity.x.com/t/bookmark-retrieves-only-800-most-recent/169433
- https://devcommunity.x.com/t/usage-cap-exceeded-for-my-bookmarks-endpoint-even-though-it-is-not-capped/213367

X DevRel contact for bookmarks API: Suhem Parack (@suhemparack).

---

## Reddit gap (manual fill before publishing)

- r/Twitter "Twitter Bookmark Limits: How it actually works" — https://www.reddit.com/r/Twitter/comments/np28dh/twitter_bookmark_limits_how_it_actually_works/
- Crawler blocked. Pull OP + top 3 comments manually.

---

## Killer narrative beats unlocked

1. **The 800 cap IS officially documented.** Quoting the X dev docs verbatim is the post's killer move — every competitor post hand-waves around this.
2. **Three different limits exist** and X has never published a reconciliation:
   - **API limit:** 800 most recent (documented)
   - **Display limit:** ~800–1,000 in the X UI (not officially documented but consistent with API)
   - **Storage limit:** unknown; Twillot claims 200k+ stored but X has not confirmed
3. **Julia Colen's pull quote** — *"A bookmark on Twitter isn't a 'save.' It's a 'maybe it'll still be here later.'"* — is the conceptual hook.
4. **The October 2025 regression** (clear-all removed from desktop) is fresh news no other post has tied in.
5. **Bookmarks vanish silently** when source tweets are deleted/account goes private — Julia Colen's full explainer is gold.
