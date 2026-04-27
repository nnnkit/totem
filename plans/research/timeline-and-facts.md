# X / Twitter Bookmarks — Verified Timeline & Facts

Source material gathered via web research with verbatim quotes and citations.
Use this as the factual spine for all three blog posts.

---

## Verified events, oldest to newest

### 1. February 28, 2018 — Twitter launches Bookmarks
- Twitter rolls out Bookmarks globally on iOS, Android, Twitter Lite, mobile web. Private by design.
- **Official blog post:** https://blog.x.com/official/en_us/topics/product/2018/an-easier-way-to-save-and-share-tweets.html
- **Quote (TechCrunch citing Twitter):** "Bookmarks will be private, and no one will know what you saved to read later."
  https://techcrunch.com/2018/02/28/twitter-launches-bookmarks-a-private-way-to-save-tweets/

### 2. January 5, 2023 — Musk frames bookmarks as a "silent like"
- **Source:** https://x.com/elonmusk/status/1611932793130438656

### 3. March 16, 2023 — Public bookmark COUNT added to tweets
- Bookmark identities stay private; the aggregate count becomes visible on tweet detail pages, iOS first.
- **@Support tweet:** https://twitter.com/Support/status/1636440696176427032
- **Quote:** "Starting today on iOS, you'll now see the total number of times a Tweet has been bookmarked on Tweet details."
- News: https://www.iphoneincanada.ca/2023/03/17/twitter-begins-rolling-out-bookmark-count-via-tweet-details/

### 4. 2022 (NOT 2023) — Bookmark Folders launched as Twitter Blue feature
- **Correction:** I previously said 2023. Folders shipped as a Twitter Blue feature in 2022.
- **Source:** https://help.twitter.com/en/using-twitter/twitter-blue-features
- Adweek how-to: https://www.adweek.com/media/twitter-blue-how-to-use-bookmark-folders/
- Use phrasing: "introduced as a Twitter Blue subscriber feature in 2022."

### 5. June 12, 2024 — X makes Likes private for everyone
- Default-on for all accounts (was Premium-only since Aug 2023). The Likes tab on profiles is hidden.
- **Engineer announcement:** Haofei Wang (Director of Engineering, X) — https://x.com/wanghaofei/status/1793096366132195529 (preview posted May 22, 2024)
- **Quote (Wang, via The Register):** "Public likes are incentivizing the wrong behavior. For example, many people feel discouraged from liking content that might be 'edgy' in fear of retaliation from trolls, or to protect their public image."
  https://www.theregister.com/2024/06/12/x_hides_likes/
- **Quote (Musk):** "Important to allow people to like posts without getting attacked for doing so!"
  https://www.siliconrepublic.com/business/x-twitter-private-hidden-likes-privacy-elon-musk

### 6. May 22, 2025 — Mozilla announces Pocket shutdown
### 6b. July 8, 2025 — Pocket actually shuts down
### 6c. October 8, 2025 — Pocket export window closes; accounts deleted
- **Correction:** I previously said "Pocket shut down July 2025" — the announcement was May 22, 2025; shutdown July 8, 2025.
- **Mozilla blog:** https://blog.mozilla.org/en/mozilla/building-whats-next/
- **Mozilla support page:** https://support.mozilla.org/en-US/kb/future-of-pocket — "We made the difficult decision to shut down Pocket on July 8, 2025."
- **Quote (Mozilla, via 9to5Mac):** "Pocket has helped millions save articles and discover stories worth reading. But the way people save and consume content on the web has evolved, so we're channeling our resources into projects that better match browsing habits today."
  https://9to5mac.com/2025/05/22/mozilla-announces-shutdown-of-pocket/
- TechCrunch: https://techcrunch.com/2025/05/22/mozilla-is-shutting-down-read-it-later-app-pocket/

---

## The 800 bookmark cap — IS officially documented

This is critical: the cap is not folklore. Quote it.

- **Endpoint:** `GET /2/users/:id/bookmarks`
- **Official docs:** https://developer.x.com/en/docs/x-api/tweets/bookmarks/integrate
- **Direct quote from X Developer docs (integration guide):**
  > "With the GET method of the Bookmarks lookup endpoint you will get back 800 of your most recent Bookmarked Posts."
- Newer docs page omits this: https://docs.x.com/x-api/users/get-bookmarks (only mentions `max_results` 1–100 per page).
- **Rate limits (official):** 180 GET / 15 min user window; 50 POST/DELETE / 15 min.
- Dev forum corroboration:
  - https://devcommunity.x.com/t/bookmark-retrieves-only-800-most-recent/169433
  - https://devcommunity.x.com/t/how-to-get-more-than-800-bookmarks/204704

**Conclusion**: the X *display* limit and *API* limit appear to share the same 800-most-recent ceiling. Underlying storage has no documented hard cap.

---

## Things flagged as DO NOT PUBLISH (or correct before publishing)

1. **"X is making bookmarks public."** No official statement, ever. Both 2024 and 2025 viral claims traced to fake @XEng screenshots.
   Debunk source: https://www.sochfactcheck.com/x-twitter-is-not-making-bookmarks-visible-to-public/
   "Bookmarks remain private and only viewable to the user themselves."
2. **"Bookmark folders launched in 2023."** Wrong — Twitter Blue, 2022.
3. **"Premium+ unlocks unlimited bookmarks / more folders."** No primary source verified. Don't claim without a help.x.com citation.
4. **"Pocket shut down in July 2025"** as a single date — split it: announced May 22, shut down July 8, exports until Oct 8.
5. **"Elon announced public bookmark counts via personal tweet."** It was the @Support account, not Elon, on March 16, 2023.

---

## Useful angles unlocked by this research

- **The "bookmarks going public" rumor is itself a story** — fake @XEng screenshots have made the rounds twice (2024, 2025). Post 1 (privacy) can debunk this directly with the SochFactCheck citation. Strong hook.
- **Musk's "silent like" framing** (Jan 2023) is the philosophical backdrop for why X added public bookmark counts — bookmarks were the only real engagement signal not visible.
- **Likes-went-private context** (June 2024) explains why so many people now wonder if bookmarks are next. Post 1 can use this directly.
- **The 800 cap is real and documented** — Post 3 should quote the developer docs verbatim. This is the post's killer move; competitors are all hand-waving.
- **Mozilla's actual reasoning** ("the way people save and consume content has evolved") is a great quote to riff on for Post 2 — *yes, it has evolved: most of what people save is now Twitter threads.*
