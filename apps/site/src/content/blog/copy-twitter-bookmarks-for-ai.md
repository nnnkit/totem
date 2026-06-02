---
title: "How to Copy a Twitter Bookmark for AI Without Losing the Source"
slug: copy-twitter-bookmarks-for-ai
description: "A step-by-step guide to Totem's Copy for Agent action: copy one saved X / Twitter bookmark as cleaner AI-ready text with source context."
publishedAt: 2026-06-02
draft: false
canonicalKeyword: copy twitter bookmark for ai
---

# How to Copy a Twitter Bookmark for AI Without Losing the Source

Most AI copy workflows are messy.

You select a tweet. The browser grabs half the surrounding UI. The assistant sees buttons, timestamps, repeated links, and not enough source context.

Totem's `Copy for Agent` action exists for the narrower job: copy one saved post, thread, or article in a format that is easier to paste into an AI assistant.

![Totem reader export menu showing Copy for Agent, Copy Markdown, Download Markdown, and Print / Save PDF.](/blog/totem-extension-guides/reader-export-menu-annotated.png)

## Step by step

1. Open Totem from a new tab.
2. Open the saved bookmark you want to use.
3. Let the reader load the post. For threads, wait until the thread content appears.
4. Click `Copy for Agent` in the reader toolbar.
5. If `Copy for Agent` is not the active button, click the small dropdown arrow and choose it from the menu.
6. Paste into your AI tool.
7. Ask a specific question.

Good prompts start with the job:

```txt
Summarize this saved thread into 5 decision points. Keep links and source context.
```

```txt
Turn this post into a checklist I can use while evaluating the idea.
```

```txt
Extract the claims, assumptions, and open questions from this bookmark.
```

## What Copy for Agent includes

`Copy for Agent` keeps the material an assistant needs:

- the saved post or article text
- source URL
- author name and handle
- thread content when Totem has it
- useful media references where available

It removes some things that usually make AI context worse:

- repeated source links
- visual reader chrome
- noisy UI labels
- extra Markdown decoration meant for human reading

That is why it is different from selecting text manually.

## Copy for Agent vs Copy Markdown

Use `Copy for Agent` when you are pasting into an AI chat.

Use `Copy Markdown` when you want normal Markdown for a note, document, or editor.

Use `Download Markdown` when you want a file on disk.

Use `Print / Save PDF` when you want one bookmark as a document.

The whole-library ZIP also includes Markdown files, but `Copy for Agent` is faster when you are working with one saved item in the reader.

## Do not paste your whole library into an AI tool

Totem can export the library locally. That does not mean every bookmark should go into a third-party AI model.

Use the local search first. Open the one saved post or thread that matters. Then copy that item for the assistant.

Smaller context usually gives better answers, and it leaks less of your saved material into tools you do not control.

## If copying fails

Clipboard permissions can be strict in some browsers.

Try this:

1. Click inside the Totem tab once.
2. Click `Copy for Agent` again.
3. If it still fails, open the dropdown and choose `Copy Markdown`.
4. If clipboard access is blocked completely, use `Download Markdown` and open the file locally.

The result is the same habit: search locally, open one saved thing, copy only what the next step needs.
