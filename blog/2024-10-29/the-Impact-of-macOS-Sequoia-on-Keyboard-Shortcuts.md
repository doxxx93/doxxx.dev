---
title: macOS Sequoia가 키보드 단축키를 막아버렸다.
authors: doxxx
tags: [ macOS, Sequoia, keyboard shortcuts ]
date: 2024-10-29 09:47:57 +0900
---

macOS Sequoia가 보안을 이유로 개발자들이 자주 사용하던 키보드 단축키 조합을 막아버렸습니다. 옵션(⌥)과 시프트(⇧) 키만을 사용하는 단축키가 이제 `RegisterEventHotkey` API에서
작동하지 않게 된 것입니다.

:::warning[TL;DR]

- 옵션+시프트만 사용하는 단축키 등록 시 `-9868` 오류가 발생합니다.
- 키로깅 멀웨어 방지가 목적이지만, 정작 피해는 정상적인 앱들이 보고 있습니다.
- 당장은 Command나 Control 키를 추가한 새로운 조합을 사용해야 합니다.
- 애플의 자체 앱들은 이 제한을 받지 않습니다.

:::

<!-- truncate -->

최근, 여러 애플리케이션 사용중에 단축키가 제대로 작동하지 않는 문제를 발견했습니다.

여러가지 해결 방법들을 찾아보았지만, 결국 이 문제는 macOS Sequoia에서 발생한 변경으로 인한 것이었습니다.

## 뭐가 바뀌었나?

`RegisterEventHotkey` API를 사용할 때 옵션과 시프트 키만으로는 더 이상 단축키를 등록할 수 없게 되었습니다.

시도하면 `-9868` (`eventInternalErr`) 오류가 발생합니다.

```swift
func registerShortcut() {
    ...
    // 이제 이 코드는 작동하지 않습니다
    let status = RegisterEventHotKey(
        keyCode,
        optionKey | shiftKey,  // 문제가 되는 부분
        ...
    )
    
    // status는 -9868 (eventInternalErr)를 반환합니다
}
```
위는 애플리케이션들에서 사용되는 단축키 등록 코드의 일부입니다.

## 왜 이렇게 바뀌었을까?

Apple Developer Forums에 올라온

**[macOS Sequoia] Using RegisterEventHotkey with option and shift modifiers doesn't working anymore**

라는 제목의 [글](https://forums.developer.apple.com/forums/thread/763878)에서 Apple Frameworks Engineer가
이렇게 [설명](https://forums.developer.apple.com/forums/thread/763878?answerId=804374022#804374022)하고 있습니다:

> This was an intentional change in macOS Sequoia to limit the ability of key-logging malware to observe keys in other
> applications. The issue of concern was that shift+option can be used to generate alternate characters in passwords,
> such
> as Ø (shift-option-O).
>
> There is no workaround; macOS Sequoia now requires that a hotkey registration use at least one modifier that is not
> shift or option.

이를 해석해보면

> 이는 키 로깅 멀웨어가 다른 애플리케이션의 키를 관찰하는 기능을 제한하기 위해 macOS Sequoia에서 의도적으로 변경한 것입니다. 우려되는 문제는 시프트+옵션을 사용하여 비밀번호에 Ø(시프트-옵션-O)와
> 같은 대체 문자를 생성할 수 있다는 것입니다.
>
> 해결 방법은 없으며, 이제 macOS Sequoia에서는 단축키 등록 시 시프트나 옵션이 아닌 수정자를 하나 이상 사용하도록 요구합니다.

키로깅 멀웨어가 옵션+시프트로 입력되는 특수 문자들(예: Ø)을 가로채지 못하게 하기 위한 조치라고 합니다.

## 실제로 겪은 문제점들

개발자로서 이 변경이 꽤나 신경쓰이는 이유들:

- 기존 앱들이 영향을 받습니다
    - 이미 출시된 앱들 중 이 단축키 조합을 사용하는 기능들이 모두 작동하지 않게 됐습니다
    - 사용자들은 왜 갑자기 기능이 안 되는지 이해하기 어려울 수 있죠

- 워크플로우가 깨집니다
    - 옵션+시프트 조합은 다른 앱들과 충돌이 적어서 자주 사용했던 조합이었는데, 이제 대안을 찾아야 합니다
    - 특히 생산성 도구나 유틸리티 앱 개발자들이 큰 영향을 받을 것 같네요

