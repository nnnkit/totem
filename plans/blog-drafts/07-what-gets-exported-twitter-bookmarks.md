---
title: "What Actually Gets Exported When You Export Twitter Bookmarks?"
slug: what-gets-exported-twitter-bookmarks
canonical_keyword: twitter bookmarks export
status: published
---

## Post Packet

- Keyword: `twitter bookmarks export`
- Supporting cluster: `export twitter bookmarks`, `download twitter bookmarks`, `export x bookmarks`
- Purpose: explain export depth rather than methods.
- Source of product truth: `src/lib/export/quick-export.ts`, `src/lib/import/run-import.ts`, `apps/site/src/pages/export-format/v1.astro`.

## Fragments

- "Export my bookmarks" hides several jobs.
- A URL list is an index card, not the library.
- CSV is for triage; Markdown is for reading; JSONL is for restore.
- The manifest is the receipt.
- A backup is not trustworthy unless it can come back in.
- Say what is not exported: password, X account archive, unknown old bookmarks, full media mirror.

## Beat Map

1. Establish export depth: link list, spreadsheet, readable copy, restorable data.
2. Walk through CSV fields and why they matter.
3. Explain Markdown as the reader-friendly layer.
4. Explain JSONL and manifest as the restore layer.
5. Split basic vs full export.
6. Name exclusions and tradeoffs.
7. End with a checklist for judging an export.

## Draft

Published at `apps/site/src/content/blog/what-gets-exported-twitter-bookmarks.md`.

## Editorial Notes

- Kept this article as a support piece for the main export article.
- Avoided competing for the exact same primary keyword as Article 1.
- Linked to `/export-format/v1` for readers who want the schema.
- Preserved the product caveats: Totem is not the official X archive and does not invent uncaptured old bookmarks.
