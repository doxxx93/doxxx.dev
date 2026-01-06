---
title: macOS Sequoia has blocked keyboard shortcuts.
authors: doxxx
tags: [ macOS, Sequoia, keyboard shortcuts ]
date: 2024-10-29 09:47:57 +0900
---

macOS Sequoia has blocked a keyboard shortcut combination frequently used by developers for security reasons. Shortcuts that use only the Option (⌥) and Shift (⇧) keys no longer work as
in the `RegisterEventHotkey` API.

:::warning\[TL;DR]

- When registering a shortcut that uses only Option+Shift, an error `-9868` occurs.
- Although the goal is to prevent keylogging malware, it is actually normal apps that are being affected.
- For now, you'll need to use a new combination that adds the Command or Control key.
- Apple's own apps are not subject to this restriction.

:::

<!-- truncate -->

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

라는 제목의 [글](https://forums.developer.apple.com/forums/thread/763878)에서 Apple Frameworks Engineer가
이렇게 [설명](https://forums.developer.apple.com/forums/thread/763878?answerId=804374022#804374022)하고 있습니다:

> This was an intentional change in macOS Sequoia to limit the ability of key-logging malware to observe keys in other
> applications. The issue of concern was that shift+option can be used to generate alternate characters in passwords,
> such
> as Ø (shift-option-O).
>
> There is no workaround; macOS Sequoia now requires that a hotkey registration use at least one modifier that is not
> shift or option.

If we interpret this,

> This is an intentional change in macOS Sequoia to limit the ability of keylogging malware to observe keystrokes from other applications. The concern is that using shift+option can create alternative characters in passwords, such as Ø (shift-option-O) and
> .
>
> There is no workaround, and macOS Sequoia now requires that you use at least one modifier other than Shift or Option when registering a shortcut.

This is said to be a measure to prevent keylogging malware from intercepting special characters (e.g. Ø) entered with Option+Shift.

## Problems actually experienced

As a developer, here are some reasons why this change is quite concerning:

- Existing apps are affected
  - All features in previously released apps that use this shortcut combination no longer work.
  - It can be difficult for users to understand why a feature suddenly stops working.

- Workflow is broken
  - The Option+Shift combination was a combination I used frequently because it rarely conflicted with other apps, but now I need to find an alternative.
  - Developers of productivity tools and utility apps in particular are likely to be greatly affected.

