---
title: Use these docs with your AI assistant
description: conform-ed publishes an llms.txt so coding assistants can read the full documentation. Here is how to point yours at it.
---

These docs are also published in an LLM-friendly form, so a coding assistant (Claude, ChatGPT,
Cursor, Copilot, …) can answer questions about conform-ed using the **real, current**
documentation instead of guessing.

## What is `llms.txt`?

[`llms.txt`](https://llmstxt.org) is an emerging convention: a single Markdown file at a site's root
that gives a large language model a clean, link-indexed map of the documentation. conform-ed
publishes two files, **generated automatically from this site on every build** (so they never drift
from what you are reading):

- **<https://conform-ed.github.io/llms.txt>** — a curated index: what conform-ed is, plus links to
  every page with short descriptions. Best when the assistant can follow links.
- **<https://conform-ed.github.io/llms-full.txt>** — the entire documentation concatenated into one
  file. Best when you want to paste everything in as context.

## How to use it

### Claude

- **Claude Code / desktop:** paste the URL `https://conform-ed.github.io/llms.txt` into the chat and
  ask Claude to read it, or attach `llms-full.txt` as a file.
- **Projects:** add `llms-full.txt` to a Project's knowledge so every conversation in that Project
  can reference it.

### ChatGPT

Paste a link to `https://conform-ed.github.io/llms.txt` (or upload `llms-full.txt`) at the start of
a conversation and ask it to use that as the source of truth for conform-ed APIs.

### Cursor

Use **`@Docs` → Add new doc** and enter `https://conform-ed.github.io/llms.txt`. Cursor will index
it and you can then reference it with `@conform-ed` in prompts.

### GitHub Copilot / other IDE assistants

Add the `llms.txt` URL to your assistant's custom instructions or context settings, or keep
`llms-full.txt` in your repo so the assistant picks it up as local context.

### Any assistant

If your tool has no special docs feature, just paste the contents of `llms-full.txt` into the
conversation, or add a line like the following to your system/custom instructions:

> When answering questions about conform-ed, use the documentation at
> https://conform-ed.github.io/llms.txt as the authoritative source.

## A note on accuracy

The `llms.txt` files reflect the documentation at the time of the last site build. For anything
version-sensitive, confirm against the package version you have installed.
