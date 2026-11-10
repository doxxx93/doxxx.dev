---
title: "Practical AX Report"
authors: doxxx
tags: [book-review, ai, agent, 한빛미디어, 나는리뷰어다]
date: 2026-09-28 12:00:00 +0900
image: /img/blog/2026-09-28/cover.webp
description: "How to Change the Way People Work with a Tool That Enforces Nothing"
---

![Book cover](/img/blog/2026-09-28/cover.webp)

> This review was written as part of the \<I Am a Reviewer\> (나는리뷰어다) program run by Hanbit Media (한빛미디어), which provided the book.

{/* truncate */}

## Why I Picked This Book

I'm a developer. When I code, I keep an agent open beside me while I work. So two words I keep hearing lately kept nagging at me: AX and FDE. They're hot terms everywhere, yet what exactly gets called AX was fuzzy. Is it AX if you put up a chatbot inside the company, is it AX if developers use coding agents, or is it something bigger than that?

There was one more thing I was curious about. How do the people who decide this from above, meaning executives and decision makers, look at AX? As a developer on the side that uses the tools, I also wanted to know the criteria decision makers judge by.

This book is a field record written by people who built an AI platform at Lotte Group and expanded it to 52 affiliates. Two of the three authors now oversee the group's AI and its AI policy at the holding company. They carry both of my questions, the definition and the decision making, so I picked it.

## Who Should Read This

- You hear the word AX at work every day but haven't pinned down what exactly it refers to
- You have to submit an AI adoption budget, or approve one that's been submitted
- Your team built an internal AI platform but usage won't go up
- You're a developer curious about what judgments your company is making about AI

On the flip side, if you're looking for model training or paper-level theory, this isn't the book. The authors draw that line themselves in "About This Book" (p. 13). What it covers isn't the technology itself but how to make the technology work inside an organization.

## What It's Like

### AX Isn't Adoption, It's a Change in How You Work

The first thing I got was a definition. On page 28 the authors split corporate AI adoption into three stages: declaration, tool rollout, and embedding into daily work. Stage 1 is when leadership has announced an AI strategy, and stage 2 is when accounts have been issued and an internal chatbot is up. The diagnosis that follows is that most companies stay at stage 2 while mistaking it for stage 3. A number comes with it: it's common for stage 2 companies to have a monthly active user rate stuck at 10-15%.

![Page 41 - the passage explaining the difference between DX and AX in terms of enforcement](/img/blog/2026-09-28/page-41.webp)

And the passage running from page 40 to 41 is the axis of the whole book. In the DX era, tools enforced the process. Once ERP was installed, work couldn't move forward without entering things there, and bringing in groupware made approvals electronic. AX is different.

> AI is a tool with no power to enforce. (p. 41)

Work still gets done even if nobody uses the chatbot. So the authors' reasoning is that in AX, organizational design after adoption matters far more than it did in DX. That one sentence cleared up what had been fuzzy for me. AX is hard not because the technology is hard but because you have to get people to use a tool they don't have to use.

There's a reason this passage hit home for me as a developer. Coding agents don't enforce anything either. Code gets written even if you don't use them. Whether to use one is an individual's choice. The AX this book talks about is lifting that individual choice up into the work design of the whole company.

### How Decision Makers See It

The second thing I got was the view from above. Part 2's subtitle is "How Practitioners Persuade Leadership," and if you read it backward, you can see exactly what leadership asks.

On page 52 the book sums up what leadership expects from AX in three points: not falling behind competitors, measurable results, and a big picture that will change the business model. The first one struck me. Because questions about AI strategy come flying in at board meetings and shareholder meetings, the pressure to show that we're doing it too comes first. Accountability for explaining yourself to the outside comes before technical judgment.

![Page 58 - a table of what to show leadership at each stage: experience, embedding, and innovation](/img/blog/2026-09-28/page-58.webp)

Chapter 4 shows how to handle that pressure. The explanation on page 64 is clear. Early in AI adoption, costs are certain and benefits are uncertain. Infrastructure and licenses show up on an invoice right away, but benefits only appear once users get used to the tools and processes change. If you ignore this lag and calculate ROI early, the result always comes out bad, and if you cut the investment on that basis, you stop right before the benefits would have shown up. So what you measure changes at each stage: acceptance at the experience stage, efficiency at the embedding stage, and only at the innovation stage, ROI.

I could read the KPI split on page 69 the developer way. It divides an AI project's results into three layers: an AI suggestion score, an implementation score, and an ROI score. The point is to tell, when ROI is low, whether it's because the model is bad, because people on the ground aren't using it, or because you picked work with small impact in the first place. If the suggestion score is high but the implementation score is low, you fix onboarding rather than swapping the model. It's the same structure as breaking down the cause of an incident layer by layer. It means that even when the technical metrics look good, adoption on the ground and business impact have to be checked separately, and that finishing development doesn't mean the AX results are in.

![Page 84 - AX investment proposal structure template](/img/blog/2026-09-28/page-84.webp)

It even shows what the approval paperwork looks like. Pages 72-73 say not to submit a single plan but to submit three together: conservative, moderate, and aggressive. That way the discussion moves from whether to do it to how to do it. The middle option usually gets picked, but you have to see both ends for the middle to look reasonable. In the investment proposal template on page 84, the parts the book names as what leadership pays most attention to are the comparison scenarios of investing versus not investing, and the stop criteria that spell out when to halt if it fails. It explains these as devices that build trust that the proposal rests on judgment, not optimism. Reading this chapter, I learned why you're told to submit an investment plan as several options.

### Where the Developer's Place Is Moving

The word FDE doesn't appear once in this book. There's no direct answer about FDE. Still, I read the book as continuing into the question of how much of the business side's work automation engineers can take on. At least for per-person work automation, the authors' answer wasn't to add more engineers.

On page 252 they admit it's close to impossible for in-house AI engineers to build agents tailored to every employee's individual work. So what they built was a no-code agent builder. Page 255 compresses this direction into one line: rather than how many engineers you have, what sets the breadth of AX is whether business teams can take hold of automating their own work. The platform is heading the same way. In the version table on page 101, the user experience starts at "experience AI" and, by 4.0, which is still in preparation, becomes "build AI yourself."

![Page 315 - AX competency matrix by role. Only harness engineering and MCP development remain exclusive to IT and development](/img/blog/2026-09-28/page-315.webp)

So what's left for developers? The competency matrix in Chapter 21 gives the answer. Pages 312-313 divide AX competencies into nine, and the role-by-role matrix on page 315 shows vibe coding as required for every role except management and planning. The judgment is that non-developers should also build the dashboards and tools they'll use themselves. On the other hand, the competencies this matrix requires only of IT and development roles are two: harness engineering and MCP development. One is connecting AI to working environments like files, code, and terminals and designing the permissions and security gates. The other is safely linking the company's systems and data to AI.

That doesn't mean a developer's job shrinks to these two. Page 300 also lists model selection, RAG operations, and agent architecture as the engineer's share. But in a picture where the ability to write code spreads to every role, I read it as the passage that sets connection and control apart as the developer's expertise. On the same page 300, the book names a sense for building stability on top of nondeterministic models as the biggest difference between an AI engineer and a regular backend engineer, and I read that in the same vein. Page 316 adds that this matrix should be redrawn at least every quarter, noting that competencies that belonged only to IT and development until yesterday sometimes move over to marketing and sales.

## What Falls Short

**There are no numbers proving ROI.** Chapter 4 is titled "Start Without ROI, Prove It With ROI," but the work-hours savings table on page 67 is labeled "example," and the options table on page 72 is a hypothetical plan too. The case chapters do report operational results like a recognition rate of about 95% and a 50% cut in review time (p. 232), but it's hard to tell how much of that carried through to financial ROI. The authors themselves write in the afterword (p. 337) that AX has now reached the stage where it has to lead to financial results, but that they still haven't found answers for measuring results, assigning accountability, or turning token costs into profit. It's an honest admission, but the measured financial figures a reader facing a leadership report would want most are missing.

**The cases get stuck in the same mold toward the back half.** Parts 1 and 2 still have lively failure stories, like a regulation search AI whose accuracy was above 90% when piloted on 200 documents but dropped into the 70s when expanded to 5,000 (p. 35). But from Part 5 on, nearly every section closes with the same frame: "The clearest effect was" and "The meaningful finding from a design perspective was." From page 214 to 335, these two phrases repeat more than 60 times. Summing up the lesson in each section is nice, but as the same sentence structure keeps going, what was different about each case gets blurry.

**It's written assuming one group's scale.** Onboarding 35,000 people, rolling out to 52 affiliates, data isolation per affiliate, even a governance committee: the scale and organizational structure of the cases are fitted to a large conglomerate. The authors say they examined academically whether the approach holds at other companies (p. 9), but for an organization of tens or hundreds of people, readers have to sort out for themselves how much to strip away and what to take.

## Structure

It opens with front matter (endorsements, the authors' preface, and About This Book), runs through 7 parts and 22 chapters, and closes with an afterword. It's 338 pages. The part divisions are the book's own.

- **Part 1, AX: Why Most Attempts Fail** (Chapters 1-2, pp. 25-48): the gap between adoption and embedding, PoC hell, the difference between DX and AX, and the three layers at which organizations reject AI.
- **Part 2, Designing an AX Strategy: How Practitioners Persuade Leadership** (Chapters 3-5, pp. 49-85): the three-stage roadmap of experience, embedding, and innovation, measuring results by stage, cost structure and the decision to build in-house, and the investment proposal.
- **Part 3, Building the AI Platform** (Chapters 6-9, pp. 87-158): platform architecture from 1.0 to 4.0, model selection and routing, multi-agent setups, and security and governance.
- **Part 4, Company-wide Rollout** (Chapters 10-12, pp. 159-208): from one department to 52 affiliates, onboarding 35,000 people, and AI champions.
- **Part 5, AX in Practice by Industry** (Chapters 13-16, pp. 209-255): cases from retail, production and manufacturing, services and infrastructure, and common business tasks. The no-code agent builder is here.
- **Part 6, Integrating with Other Platforms** (Chapters 17-19, pp. 257-294): groupware, core business systems, and external AI services and MCP.
- **Part 7, Building AX Organization and Culture** (Chapters 20-22, pp. 295-336): designing a dedicated organization, literacy programs and the competency matrix, and making the culture stick.

"About This Book" (p. 15) has a guide to which part to open first depending on your situation. If you have a leadership report coming up, start with Chapter 4. If you built it and nobody uses it, start with Parts 4 and 7.

## Final Thoughts

![Page 337 - the afterword](/img/blog/2026-09-28/page-337.webp)

I opened it with only a fuzzy idea of what AX was, and when I closed it, there was less talk about technology than I'd expected. AX isn't about bringing in tools but about getting people to use a tool that enforces nothing, so roadmaps, measurement, organization, and training take up most of the book rather than technology. If you open it expecting technology, you may be thrown, but that's also the core of what the book is trying to say.

As a developer I took away two things. One is a clear definition of what AX is, and the other is a feel for the calculations a decision maker's judgment goes through. I now know why you shouldn't weigh ROI early, why the book recommends submitting three investment options together, and why stop criteria go into an investment proposal. For someone who has only looked at AI from the side that uses the tools, this book shows the seat on the other side.

In the afterword on page 337, the authors write that models and tools go stale fast, but what they wrestled with at the time and the criteria they judged by last a long time. What readers should take away is not their conclusions but their process of judgment. Having read the whole book, I felt this wasn't modesty but an accurate self-assessment.

#한빛미디어 #나는리뷰어다 #실전AX리포트
