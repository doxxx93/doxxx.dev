---
title: 4 Months of Contributing to kube-rs
authors: doxxx
tags: [open-source, rust, kubernetes, kube-rs]
date: 2026-02-20 12:00:00 +0900
image: https://i.imgur.com/u6lj9tj.png
description: A record of trial, error, and lessons learned from contributing 20 PRs to the kube-rs project over 4 months.
---

![](https://i.imgur.com/u6lj9tj.png)

In October 2025, I read an issue on GitHub. Four months later, 20 PRs had been merged and I'd been invited as a project member.

Here's a record of what happened in between.

<!-- truncate -->

## How It Started

We were using [kube-rs](https://github.com/kube-rs/kube) at work. It's a Kubernetes client library written in Rust, but we weren't making the most of it. Our codebase relied on polling, and I thought switching to watch would be more efficient, which would also let us use reflector's store. So I decided to dig deeper into kube-rs.

While looking into the reflector and watch side of things, checking for unresolved issues or stability problems, I naturally started browsing the issue tracker.

---

## Work Log

**1. First contribution.**

[Issue #1830](https://github.com/kube-rs/kube/issues/1830) was a predicate filter bug. When a resource was deleted and recreated with the same name, the controller wouldn't recognize the new resource because the cache identified resources by name alone. Looking at the HashMap in the predicate cache, I had a sense of how to fix it.

I opened [PR #1836](https://github.com/kube-rs/kube/pull/1836). It was a single file change, so there wasn't much pressure. The first review from maintainer clux:

![first-review-1.png](/img/blog/2026-02-20/first-review-1.png)
![first-review-2.png](/img/blog/2026-02-20/first-review-2.png)

He said it solved the problem in a way he didn't expect. I revised it in the direction he suggested and the code became cleaner. I failed lint twice in a row during this process, but that's how I learned about the project's justfile for managing fmt and clippy, and the overall development workflow. As I was wrapping up, clux created a follow-up issue, which naturally led to [PR #1838](https://github.com/kube-rs/kube/pull/1838).

**2. Starting with issues.**

I'd submitted my first PR without any prior discussion, but starting from [PR #1838](https://github.com/kube-rs/kube/pull/1838), I began discussing designs in [issues](https://github.com/kube-rs/kube/issues/1837) first. Sketching a blueprint before writing code turned out to be better. I could get input from someone with deep knowledge of the codebase, and considering tradeoffs at the design stage led to better outcomes.

**3. Aggregated Discovery.**

While thinking about reducing Kubernetes API calls at work, [issue #1813](https://github.com/kube-rs/kube/issues/1813) caught my eye. It was a feature request to reduce API resource discovery from N+2 calls to just 2, filed in August 2025 with no one picking it up.

I posted my research in the issue first, then split the work into two stages: [PR #1873](https://github.com/kube-rs/kube/pull/1873) and [PR #1876](https://github.com/kube-rs/kube/pull/1876). clux tested it against a slower cluster:

![28s-to-2s.png](/img/blog/2026-02-20/28s-to-2s.png)

I didn't expect that much improvement. It was fascinating to see code I wrote make a measurable difference, and this was when I first thought about doing systematic performance benchmarking. Right after this PR was merged, a comment appeared.

![member-invite.png](/img/blog/2026-02-20/member-invite.png)

I didn't see it coming at all. I think I went around telling everyone. After that, people at work started asking me about kube-rs, things like what this or that feature does, or which approach is better.

**4. Competitiveness.**

[Issue #1844](https://github.com/kube-rs/kube/issues/1844) had its root cause identified by another contributor, but no PR followed. I waited a month, re-verified the analysis, and opened [PR #1882](https://github.com/kube-rs/kube/pull/1882). Honestly, there was some competitiveness involved. The proposed design felt excessive, and I thought I could write something simpler. I don't think the motivation for contributing needs to be noble. Improving work code, curiosity, competitiveness, whatever it is, the more diverse the motivation, the longer you keep at it.

**5. Releases and versioning.**

[PR #1884](https://github.com/kube-rs/kube/pull/1884) was a breaking change to make subresource methods more ergonomic. The timing worked out to land it in the 3.0.0 milestone.

[PR #1936](https://github.com/kube-rs/kube/pull/1936) picked up a dependabot-initiated rand 0.10 update that had failed CI due to unhandled breaking API changes, and I completed the migration. Then [issue #1938](https://github.com/kube-rs/kube/issues/1938) reported that tower-http's declared lower bound was below the API version actually used, breaking builds. Seeing these issues made me realize that properly managing dependency lower bounds is directly tied to the quality of an open source project.

**6. Open source process.**

[Issue #1857](https://github.com/kube-rs/kube/issues/1857) had a related [PR #1867](https://github.com/kube-rs/kube/pull/1867) already merged but the issue was still open. When I asked if it could be closed, the judgment was that the work should be split into two stages, something that wasn't apparent when the issue was first filed. After the easy part was done, [issue #1892](https://github.com/kube-rs/kube/issues/1892) was opened for the harder part. I learned that closing an issue is itself a judgment call, and scoping work is part of the process.

I worked on [PR #1894](https://github.com/kube-rs/kube/pull/1894) based on this issue. clux pointed out my choice of a custom implementation over tower's ExponentialBackoff, but still gave a "Looks good to me." The dynamic was interesting: clux mediating between the issue reporter and the implementer while doing code review.

**7. Bug hunting.**

While implementing RetryPolicy, I was reading the existing watcher code and found a bug.

![bug.png](/img/blog/2026-02-20/bug.png)

A builder pattern where the return value was being discarded. Jitter was enabled in name but never actually applied.

Bugs in existing code surfaced while reading surrounding code to build a new feature. Fixed in [PR #1897](https://github.com/kube-rs/kube/pull/1897).

**8. Mistakes.**

I got too eager with [issue #1906](https://github.com/kube-rs/kube/issues/1906). I opened [PR #1908](https://github.com/kube-rs/kube/pull/1908) without properly reviewing the existing [PR #1907](https://github.com/kube-rs/kube/pull/1907). I thought the scope of that PR was too broad and I could fix it more narrowly, but in retrospect, I was hasty. With [PR #1914](https://github.com/kube-rs/kube/pull/1914), I hit approve after only testing locally, and another reviewer raised a fundamental issue with the API design. An approve means "this code is good to merge," but I'd vouched for parts I hadn't verified.

**9. CI and infrastructure.**

After features and bug fixes, my attention shifted to the project's foundation, the kind of things most people overlook or leave untouched.

The trigger was improving CI at work. While sorting out rustfmt, clippy, and cargo configs, I noticed the same kinds of improvements needed in kube-rs. I found that `resolver = "1"` was an outdated setting that happened to pass CI by coincidence ([issue #1902](https://github.com/kube-rs/kube/issues/1902)), cleaned up obsolete `#[allow(clippy::...)]` attributes ([PR #1930](https://github.com/kube-rs/kube/pull/1930)), and fixed flaky CI caused by Docker Hub rate limits ([PR #1913](https://github.com/kube-rs/kube/pull/1913)). Not glamorous, but there was a certain satisfaction in properly fixing workarounds.

[PR #1937](https://github.com/kube-rs/kube/pull/1937) was a memory benchmark CI workflow. I'd been feeling the need for performance tracking across releases at work too, and this was a chance to lay that groundwork. While working on this, I asked something that had been on my mind.

I'd honestly been afraid of merging other people's PRs. I had the permissions but kept putting it off.

![merge.png](/img/blog/2026-02-20/merge.png)

For clux, merging wasn't a matter of judgment but of flow. If CI passes and the change is trivial, there's no reason to wait. What I was treating as weighty, clux saw as obvious. Once I accepted that perspective, I started merging approved PRs.

Working on these CI tasks also brought back the concerns from the dependency lower bound issues. That eventually led to [PR #1940](https://github.com/kube-rs/kube/pull/1940). Adding CI to verify that dependency lower bounds actually compile using [`cargo -Z direct-minimal-versions`](https://doc.rust-lang.org/cargo/reference/unstable.html#direct-minimal-versions). GitHub Actions, cargo, and dependency management were deeply intertwined, making it the hardest PR I've worked on.

---

## Looking Back

It started because I wanted to improve our codebase at work, and by the end, we were running a release version that included my contributions. Bug fixes I'd made were running in our product, and conversely, things I found while fixing our CI turned into kube-rs PRs. The two weren't separate; they kept feeding into each other.

Splitting work into smaller PRs became natural. Fix one thing and the next thing comes into view. Get a review and there's something new to learn. The rhythm of posting research in an issue first and splitting PRs into stages, like with Aggregated Discovery, influenced how I approach work at the company too. Async communication felt natural as well. Everyone has their own schedule in open source, and working at your own pace was just how things worked.

The first PR where I failed lint twice, #1908 where I didn't look at an existing PR, the approve I clicked without proper review. It's all on record. Witnessing breaking changes in open source made me think about semver and API stability, and I started weighing tradeoffs more carefully when writing code. The person who was failing lint a few months ago is now on the reviewing side for other contributors' PRs. Not that I stopped making mistakes, but I think I got a little better by making them.

Is it really okay for someone as lacking as me to keep contributing to a library used by so many people? Pressing the merge button still isn't comfortable, and I want to get better, but I'm still figuring out where my role ends.

Still, watching my traces accumulate in the code, feeling like what I build helps sustain the project. Steadily getting things done has been enjoyable.

## Full Contribution List

<details>
<summary>20 PRs - 7 bug fixes, 4 features, 2 improvements, 7 infra</summary>

| #  | PR                                                 | Title                                                            | Category    |
|----|----------------------------------------------------|------------------------------------------------------------------|-------------|
| 1  | [#1836](https://github.com/kube-rs/kube/pull/1836) | fix(predicate): track resource UID to handle recreated resources | bug fix     |
| 2  | [#1838](https://github.com/kube-rs/kube/pull/1838) | Predicates: add configurable cache TTL for predicate_filter      | feature     |
| 3  | [#1873](https://github.com/kube-rs/kube/pull/1873) | Implement client aggregated discovery API methods                | feature     |
| 4  | [#1876](https://github.com/kube-rs/kube/pull/1876) | Implement aggregated discovery API methods                       | feature     |
| 5  | [#1882](https://github.com/kube-rs/kube/pull/1882) | Distinguish between initial and resumed watch phases             | bug fix     |
| 6  | [#1884](https://github.com/kube-rs/kube/pull/1884) | Make subresource methods more ergonomic                          | improvement |
| 7  | [#1885](https://github.com/kube-rs/kube/pull/1885) | Add nullable to optional fields with x-kubernetes-int-or-string  | bug fix     |
| 8  | [#1894](https://github.com/kube-rs/kube/pull/1894) | Add RetryPolicy for client-level request retries                 | feature     |
| 9  | [#1897](https://github.com/kube-rs/kube/pull/1897) | Fix watcher ExponentialBackoff jitter ignored                    | bug fix     |
| 10 | [#1903](https://github.com/kube-rs/kube/pull/1903) | Update rustfmt config for Edition 2024                           | infra       |
| 11 | [#1908](https://github.com/kube-rs/kube/pull/1908) | Fix OptionalEnum transform skipping schemas with description     | bug fix     |
| 12 | [#1909](https://github.com/kube-rs/kube/pull/1909) | Fix typo in CI workflow comment                                  | infra       |
| 13 | [#1913](https://github.com/kube-rs/kube/pull/1913) | Reduce CI flakiness from Docker Hub rate limits                  | infra       |
| 14 | [#1920](https://github.com/kube-rs/kube/pull/1920) | Remove conflicting additionalProperties: false from schema       | bug fix     |
| 15 | [#1928](https://github.com/kube-rs/kube/pull/1928) | Use Duration::abs_diff in approx_eq test helper                  | improvement |
| 16 | [#1930](https://github.com/kube-rs/kube/pull/1930) | Remove obsolete lint suppressions                                | infra       |
| 17 | [#1934](https://github.com/kube-rs/kube/pull/1934) | Fix OptionalEnum transform for complex enums                     | bug fix     |
| 18 | [#1936](https://github.com/kube-rs/kube/pull/1936) | Update rand dev-dependency from 0.9 to 0.10                      | infra       |
| 19 | [#1937](https://github.com/kube-rs/kube/pull/1937) | Add memory benchmark CI workflow                                 | infra       |
| 20 | [#1940](https://github.com/kube-rs/kube/pull/1940) | Add minimal-versions CI check                                    | infra       |

</details>
