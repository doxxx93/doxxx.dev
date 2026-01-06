---
title: Open Contribution Jam 2024 Participation
authors: doxxx
tags:
  [
    open-contribution-jam,
    open-source,
    open-contribution,
    Glues
  ]
date: 2024-11-23 19:47:57 +0900
image: https://cf.festa.io/img/2024-11-23/578a092e-8a55-43f7-8f6e-0da67d52ebb4.png
description: I'd like to share my experience participating in the Open Contribution Jam 2024 event and contributing to the Glues project.
---

![img.png](/img/blog/2024-11-23/img.png)

I went to Open Contribution Jam 2024.

<!-- truncate -->

## Event Overview

Open Contribution Jam is an event that invites domestic open source project maintainers to participate in a day-long event where they can directly interact with various participants and contribute to the project. 이번 행사에는 다음과 같은
연사분들과 메인테이너분들이 참여했습니다:

- NCsoft's Park Gu-sam and AIMMO's Kim Ji-ho were keynote speakers.
- Maintainers of various open source projects such as [Planetarium](https://github.com/planetarium), [Glues](https://github.com/gluesql/glues), [Fedify](https://github.com/dahlia/fedify), [daldalso](https://github.com/stars/JJoriping/lists/daldalso),

## My contribution activities

By participating in the Glues project at this event, I was able to make two meaningful contributions:

1. Improved directory navigation

- Added toggle function using Enter key in directory browser
- The Enter key can now perform the same actions as the existing 'l' key and right arrow key.
- Make opening/closing folders more intuitive

We were able to improve the user experience by adding intuitive key bindings that are easy to use for general users, not just vim's key bindings.

2. Improved vim keymap help

While helping another participant implement Delete Mode related functionality (commands to delete words like de, db, etc.), I discovered that the help for the [e] command contained an inaccurate description.

- [e] Revised the command description to be more accurate
- Improve documentation to match vim's standard behavior

![img_2.png](/img/blog/2024-11-23/img_2.png)

Everyone who worked with us submitted at least one PR and it was successfully merged.

## special experience

Another thing that was impressive was the conversation with the developers from the Nine Chronicles team.

It was a valuable opportunity to look into the internal structure of an actual operating service through the [planetarium/terraforms](https://github.com/planetarium/terraforms) repository.

## Lucky Draw

The event started at 10am, but I arrived early at 9am and was able to get a lap blanket.
There was also the luck of winning a pair of AirPods 4th generation in the lucky draw at the end of the event.

![img_3.png](/img/blog/2024-11-23/img_3.png)

## finish

This Open Contribution Jam allowed me to experience the true value of open source collaboration. 단순히 코드를 기여하는 것을 넘어서, 다른 참여자분들과의 활발한 소통을 통해 새로운 아이디어를 발견하고 함께
해결책을 찾아가는 과정이 특히 즐거웠습니다. It was also a valuable experience to be able to discuss and discuss the direction of the Glues project, which is still in its early stages, with the maintainer.

The biggest advantage of these offline contribution events is that they allow for real-time feedback and the ability to find better solutions. There was a different kind of enjoyment to asynchronous communication through PR, and I was able to learn
new perspectives, especially while helping other participants with their work.

I hope that more open source contribution events like this will be held in the future, allowing more developers to participate in open source projects and experience the joy of collaboration.
