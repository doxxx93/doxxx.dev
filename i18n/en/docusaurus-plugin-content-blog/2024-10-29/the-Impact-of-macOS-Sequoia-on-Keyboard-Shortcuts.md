---
title: "macOS Sequoia Blocks Option+Shift Keyboard Shortcuts (Error -9868)"
description: "macOS Sequoia rejects RegisterEventHotKey registrations that use only Option and Shift, returning error -9868. Here is why, and what to use instead."
authors: doxxx
tags: [mac-os, sequoia, keyboard-shortcuts]
date: 2024-10-29 09:47:57 +0900
---

macOS Sequoia has blocked a keyboard shortcut combination frequently used by developers, for security reasons. Shortcuts that use only the Option (⌥) and Shift (⇧) keys can no longer be
registered through the `RegisterEventHotkey` API.

:::warning\[TL;DR]

- When registering a shortcut that uses only Option+Shift, an error `-9868` occurs.
- Although the goal is to prevent keylogging malware, it is actually normal apps that are being affected.
- For now, you'll need to use a new combination that adds the Command or Control key.
- Apple's own apps are not subject to this restriction.

:::

{/* truncate */}

Recently, I've noticed an issue where shortcuts aren't working properly while using several applications.

I tried several solutions, but ultimately found that the issue was caused by a change in macOS Sequoia.

## What has changed?

When using the `RegisterEventHotkey` API, it is no longer possible to register hotkeys using only the options and shift keys.

If you try, you will get `-9868` (`eventInternalErr`) error.

```swift
func registerShortcut() {
    ...
    // This code doesn't work anymore
    let status = RegisterEventHotKey(
        keyCode,
        optionKey | shiftKey, // The problem
        ...
    )
    
    // status returns -9868 (eventInternalErr)
}
```

The above is a part of the shortcut registration code used in applications.

## Why did it change like this?

Posted on Apple Developer Forums

**[macOS Sequoia] Using RegisterEventHotkey with option and shift modifiers doesn't work anymore**

In [that thread](https://forums.developer.apple.com/forums/thread/763878), an Apple Frameworks Engineer
[explains](https://forums.developer.apple.com/forums/thread/763878?answerId=804374022#804374022) it this way:

> This was an intentional change in macOS Sequoia to limit the ability of key-logging malware to observe keys in other
> applications. The issue of concern was that shift+option can be used to generate alternate characters in passwords,
> such
> as Ø (shift-option-O).
>
> There is no workaround; macOS Sequoia now requires that a hotkey registration use at least one modifier that is not
> shift or option.

So it is a measure to stop keylogging malware from intercepting the special characters (Ø and friends) that Option+Shift produces.

## Problems actually experienced

As a developer, here are some reasons why this change is quite concerning:

- Existing apps are affected
  - All features in previously released apps that use this shortcut combination no longer work.
  - It can be difficult for users to understand why a feature suddenly stops working.

- Workflow is broken
  - The Option+Shift combination was a combination I used frequently because it rarely conflicted with other apps, but now I need to find an alternative.
  - Developers of productivity tools and utility apps in particular are likely to be greatly affected.

