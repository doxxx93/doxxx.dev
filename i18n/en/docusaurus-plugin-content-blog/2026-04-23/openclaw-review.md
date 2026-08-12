---
title: "<OpenClaw with GPT, Gemini, Claude> Write What to Block Before What to Ask Your Agent"
authors: doxxx
tags: [book-review, ai, agent, automation, 한빛미디어, 나는리뷰어다]
date: 2026-04-23 12:00:00 +0900
image: /img/blog/2026-04-23/cover.webp
description: "Hanbit Media I Am a Reviewer 2026 - OpenClaw with GPT, Gemini, Claude (오픈클로 with GPT, 제미나이, 클로드) book review"
---

![Book cover](/img/blog/2026-04-23/cover.webp)

> This review was written as part of the \<I Am a Reviewer\> (나는리뷰어다) program run by Hanbit Media (한빛미디어), which provided the book.

{/* truncate */}

## Why I Picked This Book

I use coding assistants like Claude Code and Cursor every day. Keeping one open next to the terminal, handing it a refactor, telling it to write tests: that's routine. But "an AI that does my actual work for me" always felt like someone else's story. An agent that tidies up my inbox every morning and summarizes my calendar. I'd thought about it and never touched it. Cloud agents made me uneasy about a company holding my data, and wiring one up myself meant gluing together cron, an LLM, and a messenger, which looked like a hassle.

OpenClaw, the subject of this book, is an open source project built to lower exactly that barrier. It lives on your own machine, lets you plug in whichever model you want (Claude/GPT/Gemini/local), and keeps control in your hands. That's the part I was curious about, so I picked it up.

## Who Should Read This

- You use GPT and Claude as chatbots but have never set one up as an agent
- You're a developer who has automated work with cron or shell scripts but never dared to wire an LLM into it
- You've been putting off a personal AI agent because security and cost felt scary

On the flip side, if you want a book where you paste in a few prompts and immediately build something, this isn't it. A good chunk of the early pages goes to installation, separating out a dedicated account, persona files like SOUL.md / IDENTITY.md / USER.md, and explaining the three-layer security model.

## What It's Like

![Page 27 - OpenClaw architecture: messenger channels / my computer / AI providers](/img/blog/2026-04-23/page-27.webp)

My first impression was: this isn't an installation guide, it's a theory of setup. Chapters 1 and 2 sketch the architecture, the gateway running on `localhost:18789` and the config living in `~/.openclaw/`, and from Chapter 3 onward the book keeps asking one question: what are you going to allow the agent to do? A three-layer defense line running through tool profiles (minimal / coding / messaging / full), confirmation prompts, sandboxing, and DM pairing. Then design details like the 'prohibitions' block inside SOUL.md being re-read on every request, so changing a rule doesn't require restarting the gateway.

> What it can do changes with the situation, but what it must never do doesn't change. (Chapter 9, p. 241)

Personally, that one sentence sums up the book best. Where a prompt engineering book teaches you to write down what to ask for, this one starts from writing down what to block first. Real incidents are dropped in along the way: browser automation tripping over a prompt injection hidden in a web page, nearly sending a workspace file listing to an outside server, or an agent community like Moltbot being acquired by Meta in March 2026 over human manipulation and data exposure problems. The rules rest on accidents that already happened, not on a marketing slogan about 'safety'.

![Page 128 - example search and summarization output (comparison table of Italian restaurants near Gangnam Station) and the start of section 5.4 on file editing](/img/blog/2026-04-23/page-128.webp)

From Chapters 5 and 6 the actual workflows show up. Throw it a CSV and get a revenue change table, tell it to search and get a restaurant comparison table, hand it an email and get a summary plus a draft reply. It's concrete about choosing models, too. Route everyday work to a lightweight model like Gemini Flash, and only escalate to Claude Sonnet when code or complex analysis is involved. The book calls this "tokens are the grocery bill." Numbers like $4-7 a day for Gemini Flash running full tilt versus roughly 5x that for the same work on Claude Sonnet are restated as 'the price of a coffee or two,' which made them easy to get a feel for.

There are letdowns as well. OpenClaw itself only appeared in late 2025, and the text covers events as recent as CVE-2026-25253 in February 2026 and Meta's Moltbot acquisition in March. Because the book tracks a target moving this fast, there's no guarantee the config schemas or skill APIs described here will still hold two or three years from now. Read it as a snapshot of the ecosystem at the time of writing.

## Structure

It's an introduction, 9 chapters, and a closing note, divided into three parts.

- **Part 1 (Chapters 1-2)**: what OpenClaw is and how it differs from things like AutoGPT, Operator, and Mariner; WSL2 installation; connecting providers, models, and messengers
- **Part 2 (Chapters 3-5)**: environment prep such as a dedicated account, the three-tier persona files SOUL.md / IDENTITY.md / USER.md, and first errands like search, file analysis, and vision
- **Part 3 (Chapters 6-9)**: skills, cron, heartbeats, email and browser automation, the morning briefing workflow, cost reduction plus multi-agent setups, connecting external services, and a retrospective

![Page 185 - the morning briefing workflow tying together cron, AI models, memory, and tools](/img/blog/2026-04-23/page-185.webp)

Chapter 6 felt like the peak. Separating cron (fixed times) from heartbeats (situational judgment) to cut wasted spend, modularizing behavior patterns into skills, and accumulating context for the agent through a memory system. The morning briefing workflow is the example where all of those pieces mesh at once, and it's well organized.

## Final Thoughts

This isn't a book that performs miracles with a handful of prompts. It's a book that says to put an agent on your own machine, define its personality, decide what to block, and only then think about what to ask it to do. From a developer's perspective, reading it drove home how much the distance is shrinking between tools like Claude Code that only let you hammer on code in a terminal and a personal assistant that reaches into email, calendar, and documents.

The book's line that "the colleague you can trust is the best colleague" read like this to me. Consistency, not performance. Prohibitions, not features. Writing down what to keep the agent from doing, before working out how to ask it for more, is what builds a tool you can keep using far longer.

#한빛미디어 #나는리뷰어다 #오픈클로
