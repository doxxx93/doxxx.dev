---
title: "Completing Agentic AI with Harness Engineering"
authors: doxxx
tags: [book-review, ai, agent, claude, 한빛미디어, 나는리뷰어다]
date: 2026-11-03 12:00:00 +0900
image: /img/blog/2026-11-03/cover.webp
description: "How to Separate What You Ask the Model from What You Enforce in Code"
---

![Book cover](/img/blog/2026-11-03/cover.webp)

> This review was written as part of the \<I Am a Reviewer\> (나는리뷰어다) program run by Hanbit Media (한빛미디어), which provided the book.

{/* truncate */}

## Why I Picked This Book

This year the term harness engineering has been showing up a lot more often. But when I actually opened those pieces, most of them were about how to write `CLAUDE.md` or `AGENTS.md`. I couldn't really tell whether it was just prompt engineering under a new name or something genuinely different.

I've written quite a few rules into `CLAUDE.md` while using Claude Code. When the model skipped one of them, about all I could do was rewrite the sentence more forcefully. I had never stopped to think about what should be written down as text and what should be blocked some other way.

This book takes on that boundary head-on. It sums up most of what people online have been calling a harness since early 2026 as a technique for giving `.md` files high priority (p. 35), and draws a line: the harness that developers building agents deal with is built at the code level (p. 140). I picked it up because I figured this book would answer whether it's just a new name or not.

## Who Should Read This

- Junior developers who want to build an agent themselves on an LLM API (this is the reader the author names in the afterword)
- People who got as far as a demo and then stalled in front of different answers to the same question, endless tool calls, and ballooning tokens
- People using Claude Code or Codex who want to sort out the difference between `.md` rules and code-level control

If you're in the third group, center your reading on section 5.2 and Chapter 12. Section 5.6's explanation of Claude Code is safer read side by side with the official docs (I give the reason under What Falls Short).

On the flip side, if you're expecting a book that digs deep into LangGraph or RAG itself, this isn't it. RAG, multi-agent, vLLM serving, and Lambda deployment are all packed into 14 chapters, so each topic stops at the depth of running it once as an exercise.

## What It's Like

### Prompts Ask, the Harness Enforces

![Page 140 - Table 5-2, comparing prompts and harnesses by situation](/img/blog/2026-11-03/page-140.webp)

The table on page 140 sums up the whole book. When the output has to be JSON, a prompt can only demand a JSON answer, and it sometimes fails. A harness takes it in with structured output and Pydantic validation. When tool calls must not exceed five, limiting the count in the prompt can still be ignored by the model, while a harness keeps a counter and forces it to stop. A daily API cost cap or masking personal information in the input is listed as flatly impossible with a prompt.

> What the LLM 'promised,' a harness can 'enforce.' (p. 140)

The author splits the harness into two perspectives (pp. 36-37). For someone using an agent, a harness means giving high priority to structured text written in `.md` files. For someone building one, it means putting constraints on the executing code. Then the author sorts what the builder's harness is responsible for into five jobs: execution flow control, guardrails, input/output validation, state management, and error recovery.

This distinction cleared up something that had been fuzzy for me. Read the developer way, it's the difference between a code review comment and a CI lint rule. A comment saying "please use this function this way" gets forgotten again in the next PR, but once it's in the linter the build fails, so it can't be forgotten. Rules written in `CLAUDE.md` are on the comment side, and the harness this book talks about is on the lint side. Instead of writing the rule more forcefully, I should have decided first which side it belonged on.

![Page 141 - Agent = Model + Harness and the components of a harness](/img/blog/2026-11-03/page-141.webp)

Page 141 condenses this again into the formula "Agent = Model + Harness" and three elements: rules, limits, and validation. On page 142, the reasons given for needing a harness are memory loss between sessions, context degradation, and failure of self-verification. The last one hit home in particular. If you have an agent check what it just did, it tends to miss the errors and rate itself as having done well. So the implementation in the latter half of Chapter 5 is filled with mechanisms like input validation, structured output, and guardrails, where code outside the model checks the result instead of the model grading itself.

### Exit Conditions Show Up in Almost Every Chapter

Only Chapters 5 and 12 have harness in their titles, but if you read with the five roles from pp. 37-38 in mind, the other chapters read as the same story.

The end of Chapter 3 (pp. 93-95) lays out four exit conditions for the ReAct loop: a maximum iteration count, detecting whether the same tool is being called again with the same arguments, a timeout, and a token limit. It attaches a table of each one's weakness too. Set the iteration count too low and complex questions go unanswered; duplicate-call detection misses calls whose arguments differ subtly. So it says to always keep the maximum iteration count and the timeout on, even in development builds. In Chapter 8 (p. 253), the same problem carries over to multi-agent setups as a ping-pong loop where agents keep handing work off to each other, and the fix is the same too: keep a `round_count` in the state and cut it off at a maximum number of rounds.

The self-correcting data analyst in Chapter 10 is the chapter that gathers this pattern into one project. Before running the generated code, it breaks it down with AST, and if it sees file deletion, system commands, or external network calls, it sends it to a human approval gate (pp. 304-305). After running, it checks the answer against a list of principles and sends back answers that make up numbers not in the data or assert correlation as causation. Rather than writing "don't write dangerous code" in a prompt, it puts a checkpoint in the execution path itself, which makes it the chapter that turns the table on page 140 into actual code.

### What Worked in Chapter 12: Allowlists and Sandbox Isolation Levels

![Page 375 - Figure 12-1, the guardrail pipeline](/img/blog/2026-11-03/page-375.webp)

The security chapter uses the OWASP Top 10 for LLM as its backbone. It explains that tools should be bound by an allowlist rather than a blocklist, so that even when a new tool is added the default is denial (p. 367). It also adds the caveat that an AST gate can't catch calls that piece strings together or detour through `getattr`, so use it only as a first-pass filter and do the real execution in a sandbox (p. 369). I trusted it more because it doesn't present static analysis as a cure-all.

Page 371 splits ways of confining code into four levels, process, container, gVisor, and micro VM, and lines them up from weakest to strongest by whether they share the host kernel. The stronger the level, the safer but heavier and slower it gets. The same page has the passage noting that Docker's default seccomp profile blocks fewer syscalls than you'd expect, and the mention that Claude Code isolates with Bubblewrap on Linux and Seatbelt on macOS. The criterion of deciding where to attach an approval gate by whether the action can be undone (p. 370) is something anyone worn out from clicking approval prompts every time can put to use right away.

## What Falls Short

**The Claude Code section contradicts the book's own Table 5-2.** Section 5.6 states up front that it was reconstructed from system prompts reported to have leaked online and from speculative material about the source, and that Anthropic has not confirmed its contents (p. 155). But some of what's built on top of that differs from the official docs. Page 160 says `CLAUDE.md` is re-injected every turn, that rules unrelated to the task are filtered out, and that the model perceives it as immutable truth. Page 36 says Claude Code intercepts the model's commands and output and re-verifies them if they differ from the instructions. The official memory docs describe `CLAUDE.md` as context that is read at the start of a session and read back in after compaction, and say it isn't an enforced configuration and doesn't guarantee strict compliance. If an action has to be blocked regardless of the model's judgment, they recommend using a PreToolUse hook. In other words, `CLAUDE.md` sits in the prompt column of Table 5-2, and the hook is the side that enforces. The book's own table explains this structure more accurately, so it was a letdown that the section actually covering Claude Code is written in a way that reads as if `.md` files carried enforcement power. It would have been more solid if it had relied on the public docs rather than speculative material of uncertain origin.

**Hitting the review limit turns into 'ok'.** In Chapter 10, the self-review node skips the review and returns `verdict: "ok"` once the rewrite count reaches the limit (p. 306). I understand the intent of keeping costs from ballooning endlessly, and a quality review doesn't need to bring everything to a halt the way a security gate does. But looking only at the final `verdict`, an answer that passed review and an answer whose review was abandoned at the limit are both 'ok', and no new record of hitting the limit is left in `history` either. You could dig through the previous review records to piece it together, but if there had been a separate 'review limit exceeded' verdict, it would have tied straight into the evaluation metrics in section 10.8 (retry count, first-attempt success rate). Even if it doesn't stop, not letting it pass silently would be more in the spirit of a harness.

**The harness thread seems to break between chapters.** If you count the word 'harness' across the book's text, it's concentrated in Chapters 1, 5, and 12 and doesn't appear even once in Chapters 3, 7, 8, or 10. In substance, the exit conditions in Chapter 3, the human-in-the-loop in Chapter 7, the `round_count` in Chapter 8, and the AST gate in Chapter 10 are all implementations of the five roles on pp. 37-38. Only in Chapter 12 does the book bring back the analysis agent from Chapter 10 and the `interrupt` from Chapter 7 and tie them together as security mechanisms (pp. 367, 369), and while you're reading the earlier chapters, that connection isn't visible. If each chapter had added just one line on "which role of the harness is this," the harness in the title would have read as the concept running through the whole book.

## Structure

It opens with the author's preface and an About This Book section, runs through 4 parts and 14 chapters, and closes with an afterword and an index. The main text runs to page 413. The example code is in a GitHub repository.

- **Part 1, Core Principles of Agents** (Chapters 1-5): distinguishing chatbots, RAG, and agents, the tool-calling flow and MCP vs CLI, the ReAct loop and exit conditions, short-term, summary, and vector DB long-term memory and checkpointers, and then context engineering and harness engineering. Most of the book's concepts are in this part.
- **Part 2, Extending Agents** (Chapters 6-8): agentic RAG and graph RAG, LangGraph StateGraph with conditional routing, human-in-the-loop, and streaming, and supervisor, handoff, and hierarchical multi-agent setups with safe state management.
- **Part 3, Hands-On Projects** (Chapters 9-11): a linear workflow that sends a market briefing every morning, a data analyst that fixes its own code when it fails, and a VLM butler robot inside a PyBullet simulation. Each project follows the order of scenario, success and failure criteria, implementation, and evaluation.
- **Part 4, Production and Operations** (Chapters 12-14): OWASP-based guardrails and sandbox isolation, serving open source LLMs yourself with vLLM, deployment with FastAPI and AWS Lambda, and LangSmith tracing and cost monitoring.

## Final Thoughts

![Page 414 - Afterword](/img/blog/2026-11-03/page-414.webp)

I opened it with only a fuzzy idea of what a harness is, and by the time I closed it the definition was simpler than I'd expected. Code enforcing what the model promised. The rest of the chapters are exercises showing how to apply that enforcement to tools, loops, memory, multi-agent setups, security, and deployment, one by one.

As a developer I got two things out of it. One is a sharp definition of a harness, and the other is a standard for rereading my `CLAUDE.md`. With the table on page 140 next to it, I can sort out which lines are fine as a request and which lines need to move into a hook or code. The book also made it clear to me that the answer is often not writing a rule more forcefully but changing where the rule lives.

In the afterword on page 414, the author writes that even if writing code can be left to AI, the one responsible for the system is still the engineer in the end. In the preface (p. 5), too, the author says that when an agent that ran fine in a demo wobbled in a real environment, the person who found the cause was the engineer who understood the structure of state, flow, and failure. At a time when the word harness is being thrown around like a buzzword, this is a book that brings it back from a prompting trick to code on the execution path.

#한빛미디어 #나는리뷰어다 #하네스엔지니어링
