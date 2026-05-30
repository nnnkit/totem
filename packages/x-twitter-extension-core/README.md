# @make/x-twitter-extension-core

Private workspace package for shared X/Twitter web-extension primitives.

This is not a publishable product SDK. It exports TypeScript source for Vite/TS
consumers inside this workspace and keeps app policy out of the shared layer.

Owned primitives:

- `pure`: cookie parsing, GraphQL endpoint parsing, bundle query-id extraction,
  and X/Twitter tweet URL normalization.
- `auth` / `auth-primitives`: captured-header validation, live `twid` reads,
  auth identity comparison, and `twid` cookie-change classification.
- `query-id`: durable GraphQL query-id catalog, discovery strategy pipeline,
  structural error guards, typed core errors, and diagnostic events.

Consumers still own runtime/session policy, account models, UI state, sync
orchestration, retry/backoff policy, and product-specific discovery strategies
such as opening a Bookmarks tab.
