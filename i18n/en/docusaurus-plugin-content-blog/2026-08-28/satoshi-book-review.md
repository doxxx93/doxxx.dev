---
title: "The Book of Satoshi (Revised and Expanded Edition)"
authors: doxxx
tags: [book-review, bitcoin, distributed-systems, 한빛미디어, 나는리뷰어다]
date: 2026-08-28 12:00:00 +0900
image: /img/blog/2026-08-28/cover.webp
description: "If You Remove Whoever Decides the Order, What Goes in Its Place"
---

![Book cover](/img/blog/2026-08-28/cover.webp)

> This review was written as part of the \<I Am a Reviewer\> (나는리뷰어다) program run by Hanbit Media (한빛미디어), which provided the book.

{/* truncate */}

## Why I Picked This Book

I'm building an order execution system. Keeping the sequence from breaking is a big part of the job, and I've been through an incident where it actually broke and had to recover from it. We handle crypto trading too, so Bitcoin was always nearby, but I only ever looked at it as a price. Then I learned that this book is a case of redesigning, from the ground up, who decides the order. What I went through was an established order breaking, so it isn't the same problem, but having lived through the first, I got curious about the second.

When I opened it, it wasn't an explainer on Bitcoin. It lays out the posts Satoshi Nakamoto wrote on mailing lists and forums from 2008 to 2010 in chronological order, with the author adding a paragraph or two of context before each one. It's less a manual than a bundle of design doc drafts with the review comments attached beneath them.

After reading the early part, I went by the table of contents and picked the chapters that interested me. This review follows the order I read them in. I note page numbers for where I read and what I saw.

## Who Should Read This

- You've dealt with consensus or ordering decisions in distributed systems. You get to see how the same problem was solved in the domain of money
- You roughly know how Bitcoin works but not why it was built that way
- You'd rather read the debates that shaped a technical document than the document itself

On the flip side, if you're expecting price talk or investment strategy, this isn't the book. There's nothing on how to make a wallet or how to use an exchange. And this isn't a book meant to be read front to back. The author outright tells readers without background knowledge to start from Chapter 2 (p. 51).

## What It's Like

### In the End, It's About Who Decides the Order

I opened it thinking it was about money, but what kept coming up was order.

![Page 622 - the section that removes the party deciding the order from the mint model](/img/blog/2026-08-28/page-622.webp)

The whitepaper text on page 622 says it outright. In a mint-based model, the mint knows about every transaction and decides which arrived first. To get rid of that party, transactions have to be publicly announced, and you need a system for participants to agree on a single history of the order in which they were received. Preventing the same money from being spent twice turns, in the end, into the problem of deciding who came first.

The system I build is the opposite. Orders go out to the exchange, and the exchange decides the execution order. When it reports that these orders were filled in this order, I have no way to verify it. I just accept it. That's exactly where the trust Satoshi set out to eliminate sits. The more exchanges we connect, the more of those places there are, and since each one has its own circumstances, they have to be handled case by case. This book is the record of a two-year public answer to what you have to put in place once you remove that trust.

![Page 134 - the section framing the problem with conventional currency as a problem of trust](/img/blog/2026-08-28/page-134.webp)

Page 134 shows that concern in its most compressed form. It's the post Satoshi wrote introducing Bitcoin on the P2P Foundation.

> The root problem with conventional currency is all the trust that's required to make it work. (p. 134)

Here he goes through the points where trust is demanded one by one: the central bank, banks' reserves, even identity theft. Then he moves to an analogy: a generation ago, multi-user time-sharing systems required trusting the administrator, and that situation disappeared once strong encryption became widespread. The argument isn't to improve trust but to remove the places that need it in the first place.

### Should It Stay Reversible?

Chapter 12, starting on page 99, covers confirmations and block time, and for my domain instincts this was the most interesting part.

![Page 100 - the section where irreversibility becomes a feature rather than a cost](/img/blog/2026-08-28/page-100.webp)

On page 100, Satoshi lays out that bounced checks and card chargebacks take anywhere from days to weeks to process, whereas Bitcoin makes a transaction irreversible in about 60 minutes. This isn't about speed. Instead of leaving irreversibility as a weakness, he set it up as a feature.

In an execution system, when a trade becomes irreversibly final is always up for negotiation. A mistaken order has to be cancelable, there has to be a path for error correction, and when a dispute comes up you leave room for a human to step in. How much room to leave is usually decided by the exchange, and I adapt to it. Bitcoin stripped that room out of the protocol and instead pushed escrow and multisignature (from p. 255) outside the protocol as options. I'm not trying to say which side is right. I'd just been treating reversibility as a convenience, and this is where I realized that it, too, is a design someone chose.

### The Defense Is Preserved as a Design Review

What's good about this book is that the rebuttals are printed right next to the conclusions. Chapter 4 on page 79 covers the scalability problem, Chapter 5 on page 81 the 51% attack, Chapter 33 on page 169 proof-of-work difficulty, and Chapter 34 on page 173 node profitability. Every one of them is a question someone raised at the time and a record of Satoshi answering on the spot.

Summaries shave all of this off. Only the conclusion remains, and why it was the conclusion disappears. The overflow bug in Chapter 59 on page 297 is the prime example. Twenty-two months in, a transaction came in whose value rolled over to a negative number, and the developers rolled back the blockchain that was supposed to be immutable. What was given up when design principles collided with operational reality is preserved as it was.

### What the Revised and Expanded Edition Adds

What's new in this edition is the emails in Chapters 76 through 80. The translator's note (p. 5) lists five names as the new material: Martti Malmi, Adam Back, Wei Dai, Hal Finney, and Mike Hearn. Of those, the Chapter 76 exchange with Malmi was made public by Malmi himself in connection with the Craig Wright lawsuit (p. 399), and the conclusion (p. 615) mentions that Malmi and Adam Back submitted these emails to the UK court during the trial.

They're clearly different from the forum posts. On page 418, Satoshi diagnoses that after trust-based systems like DigiCash kept failing for the whole of the 1990s, everyone came to believe electronic money itself just couldn't work, and then he tries to persuade the reader that this time is different. You can see that Bitcoin wasn't an invention that came out of nowhere but an answer to the failures that came before.

His refusal to overstate things also stands out. On page 506 he himself corrects the idea that Bitcoin addresses are anonymous, and on page 427 he points out on his own that amounts received at the same address get tied to one key and become a privacy risk. The same goes for the passage on page 410 where he says that, when setting an initial price reference, he picked the middle because he couldn't know the future. Page 566 carries Mike Hearn's testimony that Satoshi didn't leave because of Gavin Andresen's visit to the CIA, and that they kept exchanging emails for months after he stopped posting publicly. This edition picks up the exit story that breaks off in Chapter 72 on page 379.

## What Falls Short

**The full whitepaper is missing from the table of contents.** The book includes a complete translation of Satoshi's whitepaper, 17 pages running from page 619 to page 635. But the table of contents has no entry for it. Chapter 82, Conclusion (p. 613) is followed directly by the references (p. 636). Because the whitepaper sits inside Chapter 82 like an appendix, the running head reads "Chapter 82 Conclusion" all the way to the end. The complete whitepaper translation could be one of the reasons someone buys this book, yet from the table of contents alone you can't even tell it's included. It should have had its own entry.

**The personal correspondence section is badly lopsided.** Chapter 76 alone runs 142 pages, from page 399 to page 540, which is 22% of the whole book. The other four chapters (Chapters 77-80) add up to only 70 pages. It's true that the exchange with Martti Malmi is long, but in the stretches where practical back-and-forth about build problems and version control drags on, the density clearly drops. On top of that, there are places where similar content appears in both Chapter 76 and Chapter 80, like pages 410 and 570. I think there was room to trim more in editing.

**The 82 chapters are flat, which makes it hard to read by topic.** The book has no parts. The 82 chapters are simply listed in chronological order. The chronological arrangement is the book's strength, but when you want to find a particular topic again, the table of contents barely works as an index. Discussions of scalability or fees, for example, are scattered across Chapters 4, 15, 46, and 62. There's a glossary at the back (p. 637), but no subject index.

## Structure

It opens with three forewords that read like endorsements, plus the front matter, runs through 82 chapters, and closes with the references and a glossary. At 640 pages, it's quite a thick book.

To repeat, the book has no part divisions. It runs flat and chronological from Chapter 1 to Chapter 82. Still, as you read, you can see stretches with a different character. What follows isn't the book's own division but one I made while reading.

- **Opening** (Chapters 1-2, pp. 41-76): the introduction and how Bitcoin works. This is where the author tells readers without background knowledge to start from Chapter 2.
- **The Cryptography Mailing List** (Chapters 3-20, pp. 77-132): right after the whitepaper's release in November 2008, Satoshi answers cryptographers' objections one by one. The technical density is highest here.
- **Public Release and Monetary Theory** (Chapters 21-43, pp. 133-202): Satoshi speaks as a monetary thinker rather than an engineer. The 21 million cap, halving, and the deflation debate are gathered here.
- **Growing Pains and Attacks** (Chapters 44-72, pp. 203-380): the overflow bug, coin theft, the WikiLeaks affair. This is where it takes a beating in the real world, and it ends with the scene of Satoshi disappearing.
- **Private Correspondence and Final Messages** (Chapters 73-81, pp. 381-612): Chapters 73-75 were already in the first edition, and **what's new in this edition is Chapters 76-80** (Martti Malmi, Adam Back, Wei Dai, Hal Finney, Mike Hearn). Chapter 81 isn't correspondence but a 2015 forum post.
- **Conclusion and the Whitepaper** (Chapter 82, pp. 613-635): the conclusion proper runs through page 618, and after that comes the full whitepaper translation.

## Final Thoughts

![Page 379 - the last forum post Satoshi left just before stepping back from public activity](/img/blog/2026-08-28/page-379.webp)

This isn't a book that teaches you how to use Bitcoin. It's closer to a book where you watch design decisions get made. I read the front matter and the early part, then followed the table of contents and picked out Chapters 12, 13, 21, 30, 59, 72, and 82, and wherever I opened it, the structure was the same. Someone raises a problem, Satoshi answers, and the answer stays on the record.

There's one question I kept asking myself while reading. In the system I build, exactly who is it that finalizes the order, and if that trust breaks, what collapses? The answer lies outside the system. The exchange decides, and I receive it. Earlier I said my problem and this book's problem are different, but this is where they overlap. That's ultimately why recovering when the sequence broke was so grueling. I had to reconcile, after the fact, with facts I didn't create. Reading this book was the first time I looked at something I'd usually treated as just an integration issue as a problem of trust.

On page 379, announcing version 0.3.19 with added DoS limits, Satoshi adds that the software isn't resistant to DoS attacks at all and that there are still countless ways to attack it. And that became the last post he left publicly. He stated the limits of what he built precisely, right up to his last sentence, and then left. That attitude is why I plan to read the rest too.

#한빛미디어 #나는리뷰어다 #사토시의서
