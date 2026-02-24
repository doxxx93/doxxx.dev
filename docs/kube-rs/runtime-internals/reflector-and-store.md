---
sidebar_position: 2
title: "Reflector와 Store"
description: "인메모리 캐시의 동작 원리 — atomic swap, 비동기 특성, 읽기/쓰기 분리"
---

# Reflector와 Store

Reflector는 watcher 스트림을 가로채서 인메모리 캐시(Store)에 기록하는 투명한 어댑터입니다. 스트림을 그대로 통과시키면서 사이드이펙트로 캐시를 업데이트합니다.

## reflector 함수

```rust
pub fn reflector<K, W>(writer: Writer<K>, stream: W) -> impl Stream<Item = W::Item>
```

<!--
- watcher 스트림의 각 Event를 가로챔
- Writer에 이벤트 적용 (캐시 업데이트)
- 이벤트를 변경 없이 그대로 다음 스트림으로 전달
- "투명한 어댑터" — 스트림 소비자는 reflector가 있는지 모름
-->

## Store 내부 구조

```rust
type Cache<K> = Arc<RwLock<AHashMap<ObjectRef<K>, Arc<K>>>>;

pub struct Writer<K> {
    store: Cache<K>,
    buffer: AHashMap<ObjectRef<K>, Arc<K>>,
    // ...
}

pub struct Store<K> {
    store: Cache<K>,
    // ...
}
```

<!--
핵심 자료구조:
- AHashMap: std HashMap보다 빠름 (내부 캐시라 DoS 방어 불필요)
- parking_lot::RwLock: 읽기 동시성 최대화 (std RwLock보다 효율적)
- Arc<K>: 객체를 여러 곳에서 클론 없이 공유 (reconciler에 Arc<K>로 전달)
-->

## Atomic swap 패턴

<!--
핵심 메커니즘 — apply_watcher_event():

Event::Init:
  → 새 buffer HashMap 생성 (빈 상태)
  → 이 시점부터 InitDone까지 store는 이전 데이터 유지

Event::InitApply(obj):
  → buffer에 insert (store는 건드리지 않음)
  → re-list 중에도 store 읽기는 이전 데이터를 반환

Event::InitDone:
  → std::mem::swap(&mut self.buffer, &mut *self.store.write())
  → 한 번의 atomic swap으로 전체 데이터 교체
  → 이전 buffer(= 이전 store 데이터)는 drop

Event::Apply(obj):
  → store에 직접 insert (일반 watch 이벤트)

Event::Delete(obj):
  → store에서 직접 remove

왜 이렇게 하는가:
- re-list 중 store가 불완전한 상태가 되는 것을 방지
- swap 전까지 store는 항상 일관된 스냅샷
- swap은 포인터 교환이라 O(1)
-->

## Store의 비동기 특성

<!--
⚠️ 가장 흔한 실수:

let (reader, writer) = reflector::store();
// ... reflector 설정 ...
let items = reader.state(); // ← 빈 Vec 반환!

이유:
- Store는 생성 시 비어있음
- watcher 스트림이 poll되어야 (= tokio가 실행해야) 채워짐
- reflector → watcher → API 호출 → 응답 → Store 업데이트

올바른 사용:
reader.wait_until_ready().await; // 첫 InitDone까지 대기
let items = reader.state();      // 이제 데이터 있음

Controller 사용 시:
- Controller가 내부적으로 wait_until_ready() 호출
- reconciler가 실행될 때는 Store가 이미 채워져 있음
- 하지만 별도 Store를 직접 만들면 이 보장 없음

내부: DelayedInit — oneshot channel 기반
- Writer가 첫 InitDone에서 initializer.init(()) 호출
- Store의 wait_until_ready()가 이 신호를 기다림
-->

## Writer vs Store — 읽기/쓰기 분리

<!--
Writer<K>:
- reflector가 소유
- 쓰기 담당 (apply_watcher_event)
- Send + 비-Clone

Store<K>:
- Clone 가능 (Arc 기반)
- 읽기 전용: state(), get(), find()
- 여러 곳에서 공유 가능 (reconciler, health check 등)

Controller가 자동으로 관리:
Controller::new() → Writer 생성 → Store reader 추출 → reader를 통해 접근
-->

## 주요 Store 메서드

<!--
reader.state() → Vec<Arc<K>>
  전체 캐시된 객체 목록

reader.get(obj_ref) → Option<Arc<K>>
  특정 ObjectRef로 조회

reader.find(predicate) → Vec<Arc<K>>
  조건에 맞는 객체 검색

reader.is_ready() → bool
  첫 InitDone이 발생했는지

reader.wait_until_ready() → impl Future
  첫 InitDone까지 대기
-->

## Shared/Subscriber 모드 (unstable)

<!--
기본 모드: 하나의 reflector → 하나의 Store → 하나의 Consumer

Shared 모드: 하나의 reflector → 여러 Consumer

Writer::new_shared(buf_size):
- async_broadcast 채널로 ObjectRef 이벤트 팬아웃
- ReflectHandle로 여러 subscriber 생성
- 각 subscriber가 독립적으로 이벤트 수신

사용 사례:
- 하나의 watcher로 여러 컨트롤러에 이벤트 전달
- API 호출 횟수 절약

unstable-runtime feature 필요
-->
