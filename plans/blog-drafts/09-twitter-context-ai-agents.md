## Post Packet

Working title options:

1. The Easiest Way to Give an AI Agent Context From Twitter
2. How I Move X / Twitter Threads Into AI Agents

Format: short use-case note, not an SEO-first article.

Search status: unverified. Likely adjacent terms to test later: `tweet to markdown`,
`twitter thread to markdown`, `copy tweet as markdown`, `twitter thread ai prompt`,
`x thread markdown`. Do not lead with these unless DataForSEO proves useful demand.

Reader problem: a tweet or thread often contains exactly the context you want an
agent to reason over, but X is a bad copy surface. Raw copy loses structure,
screenshots force OCR, and thread order can get messy.

Thesis: saved tweets become useful agent context when they leave X as clean
Markdown with source, author, text, links, and media references intact.

Totem fit: strong. This is a real workflow: open a tweet in Totem, click
`Copy for Agent`, paste into Codex/Claude/ChatGPT with the task.

Honest scope:

- This is not a Twitter scraping workflow.
- It works best for tweets or threads you have saved or intentionally opened in Totem.
- It is useful for context transfer, not for mass collection.
- Screenshots are still useful for visual evidence, but Markdown is better for agent reasoning.

Verified assets:

![Open in Totem button injected on an X post](/blog/tweet-context-ai-agents/open-in-totem-on-x.png)

![Totem reader showing the Copy for Agent action](/blog/tweet-context-ai-agents/totem-reader-copy-for-agent.png)

![Totem reader after Copy for Agent succeeds](/blog/tweet-context-ai-agents/totem-copy-for-agent-copied.png)

Verification notes:

- Captured from a logged-in Chrome profile on June 2, 2026.
- X post: `https://x.com/starter_story/status/2059034957646115250`
- The X page contained one injected `Open in Totem` button.
- The Totem reader showed `Copy for Agent`.
- Clicking `Copy for Agent` changed the button state to copied.
- `pbpaste` contained agent-formatted Markdown.

Clipboard excerpt:

```md
Source: https://x.com/starter_story/status/2059034957646115250
Author: Starter Story (@starter_story)

# I LOVE this simple $30k/year side project:

I LOVE this simple $30k/year side project:

#### - Problem: magicians can't get work

- Solution: Simple online directory (built with Claude Code)

#### - Pricing: $299/year to get listed
```

## Fragments

- I do this all the time now: find the tweet, open it in Totem, copy for agent,
  paste it into Codex or Claude.
- The useful thing is not "export." It is context transfer.
- X is where the idea was found. Markdown is where the agent can work with it.
- A screenshot proves what was said. Markdown lets the agent use what was said.
- The agent does not need the X UI. It needs source, author, body, links, media,
  and thread order.
- Copying from X feels small until you paste it into an agent and realize half
  the structure is gone.
- This is a Totem use case that search volume probably will not reveal.

Lines not to write:

- "Totem turns Twitter into an AI knowledge base."
- "The best way to scrape Twitter for AI."
- "Never use screenshots."
- "This replaces Twitter search."

## Beat Map

Reader problem: You find useful context on X, but moving it into an agent is
clumsy.

Thesis: For AI agents, a tweet is most useful when it becomes clean Markdown,
not when it stays trapped inside X.

1. **A lot of agent work starts from a post**
   - Examples: startup idea, bug report, launch thread, research claim, product
     critique, code trick.
   - Job: make the behavior recognizable.

2. **X is a bad transfer format**
   - Copying loses order and context.
   - Screenshots make the agent infer text.
   - Links and images get separated from the actual claim.
   - Job: explain the friction without overclaiming.

3. **Open the tweet in Totem**
   - Use the injected `Open in Totem` button on X.
   - Screenshot: `/blog/tweet-context-ai-agents/open-in-totem-on-x.png`
   - Job: show the first click.

4. **Read it as a clean object**
   - Totem reader keeps author, source, date, thread body, media links.
   - Screenshot: `/blog/tweet-context-ai-agents/totem-reader-copy-for-agent.png`
   - Job: show why this is different from the X UI.

5. **Copy for Agent**
   - Button output includes source URL and author before the Markdown body.
   - Screenshot: `/blog/tweet-context-ai-agents/totem-copy-for-agent-copied.png`
   - Job: make the actual artifact concrete.

6. **Paste it into the agent with a job**
   - Example prompts:
     - "Turn this into a two-week MVP plan."
     - "Find the assumptions in this startup idea."
     - "Convert this thread into implementation issues."
     - "Extract claims I should verify before citing this."
   - Job: this is where the use case earns itself.

7. **When this is useful, and when it is not**
   - Useful: saved threads, research snippets, startup ideas, product notes,
     evidence you want the agent to reason over.
   - Not useful: bulk scraping, private content, visual-only analysis without
     screenshots.
   - Job: keep the post honest.

Where Totem appears: from beat 3 onward. The opening should be about the reader
behavior, not the product.

What this post does not cover:

- Bulk exporting bookmarks.
- Building an agent memory system.
- Twitter scraping.
- Prompt engineering theory.

## Draft

_(Not drafted yet.)_

## Editorial Notes

- This should be short.
- Use the third title if we want a practical/how-to framing.
- Use the second title if we want it to sound more personal and founder-led.
- The strongest line so far: "X is where the idea was found. Markdown is where
  the agent can work with it."
