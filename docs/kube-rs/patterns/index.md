---
sidebar_position: 0
title: "Patterns"
description: "kube를 제대로 쓰는 법 — 올바른 패턴과 흔한 실수"
---

# Patterns

kube를 올바르게 사용하는 패턴과, 실제 사용자들이 반복적으로 겪는 실수를 다룹니다. GitHub Issues와 Discussions에서 가장 많이 올라온 질문들을 기반으로 정리했습니다.

## 이 섹션에서 다루는 것

| 문서 | 핵심 질문 |
|------|----------|
| [Reconciler 패턴](./reconciler.md) | idempotent reconciler를 어떻게 쓰고, 무한루프를 어떻게 피하는가? |
| [관계와 Finalizer](./relations-and-finalizers.md) | owns/watches는 내부에서 어떻게 동작하고, finalizer는 언제 쓰는가? |
| [Server-Side Apply](./server-side-apply.md) | SSA의 올바른 사용법과 흔히 빠지는 함정은? |
| [서드파티 CRD](./third-party-crds.md) | 직접 만들지 않은 CRD를 어떻게 다루는가? |
| [에러 처리와 Backoff](./error-handling-and-backoff.md) | 어디서 어떤 에러가 나오고, backoff를 어떻게 설정하는가? |

[Runtime Internals](../runtime-internals/) 섹션에서 내부 동작을 이해했다면, 이 섹션에서는 "그래서 어떻게 써야 하는가"를 다룹니다.
