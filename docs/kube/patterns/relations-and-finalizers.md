---
sidebar_position: 2
title: "관계와 Finalizer"
description: "ownerReferences, watches, finalizer 상태 머신의 동작 원리"
---

# 관계와 Finalizer

Controller가 여러 리소스의 변경을 감지하는 방법(owns, watches)과, 리소스 삭제 전 정리 작업을 보장하는 finalizer의 동작 원리를 다룹니다. owns와 watches의 내부 trigger 메커니즘은 [Controller 파이프라인](../runtime-internals/controller-pipeline.md#trigger-시스템)에서 자세히 설명합니다.

## 소유 관계 — owns

```rust
controller.owns::<ConfigMap>(api, wc)
```

내부 동작:

1. ConfigMap에 대한 별도 watcher를 생성합니다
2. ConfigMap이 변경되면 `metadata.ownerReferences`를 순회합니다
3. 부모의 `kind`/`apiVersion`이 Controller 주 리소스와 일치하면
4. 부모의 `ObjectRef`로 `ReconcileRequest`를 생성합니다

### ownerReference 설정

reconciler에서 자식 리소스를 생성할 때 ownerReference를 설정합니다:

```rust
let owner_ref = obj.controller_owner_ref(&()).unwrap();
let cm = ConfigMap {
    metadata: ObjectMeta {
        name: Some("my-config".into()),
        namespace: obj.namespace(),
        owner_references: Some(vec![owner_ref]),
        ..Default::default()
    },
    data: Some(BTreeMap::from([("key".into(), "value".into())])),
    ..Default::default()
};
```

| 메서드 | `controller` 필드 | 용도 |
|--------|-------------------|------|
| `controller_owner_ref()` | `true` | 하나의 컨트롤러만 소유. Controller에서 사용 |
| `owner_ref()` | 미설정 | 여러 소유자 가능 |

### 자동 가비지 컬렉션

ownerReference가 설정된 리소스는 부모 삭제 시 Kubernetes가 자동으로 삭제합니다. `propagationPolicy`에 따라 Foreground, Background, Orphan 중 선택할 수 있습니다.

## 감시 관계 — watches

ownerReference로 관계를 표현할 수 없을 때 `watches`를 사용합니다.

```rust
controller.watches::<Secret>(api, wc, |secret| {
    // Secret에서 관련 주 리소스의 ObjectRef 목록 반환
    let name = secret.labels().get("app")?.clone();
    let ns = secret.namespace()?;
    Some(ObjectRef::new(&name).within(&ns))
})
```

| | owns | watches |
|---|------|---------|
| 관계 정의 | 리소스의 `ownerReferences`에 기록 | 코드의 mapper 함수에 정의 |
| 매핑 | 자동 (`ownerReferences` 순회) | 수동 (mapper 함수 작성) |
| 가비지 컬렉션 | Kubernetes가 자동 처리 | 직접 처리 |
| 사용 사례 | 부모-자식 관계 | 참조 관계 (Secret → 리소스) |

## Finalizer 상태 머신

finalizer는 리소스 삭제 전 정리 작업을 **보장**합니다. watch 이벤트의 `Delete`는 네트워크 단절로 유실될 수 있지만, finalizer가 있으면 Kubernetes가 삭제를 지연시키므로 정리 작업을 확실히 실행할 수 있습니다.

```mermaid
stateDiagram-v2
    state "finalizer 없음\n삭제 아님" as S1
    state "finalizer 있음\n삭제 아님" as S2
    state "finalizer 있음\n삭제 중" as S3
    state "finalizer 없음\n삭제 중" as S4

    S1 --> S2 : JSON Patch로 finalizer 추가
    S2 --> S2 : Event::Apply (정상 reconcile)
    S2 --> S3 : deletionTimestamp 설정됨
    S3 --> S4 : Event::Cleanup 성공 → finalizer 제거
    S4 --> [*] : Kubernetes가 실제 삭제
```

네 가지 상태:

| finalizer | 삭제 중? | 동작 |
|-----------|---------|------|
| 없음 | 아님 | JSON Patch로 finalizer를 추가합니다 |
| 있음 | 아님 | `Event::Apply` → 정상 reconcile |
| 있음 | 삭제 중 | `Event::Cleanup` → 정리 후 finalizer 제거 |
| 없음 | 삭제 중 | 아무것도 하지 않습니다 (이미 정리됨) |

finalizer 제거 시 JSON Patch에 `Test` operation이 포함됩니다. 다른 프로세스가 이미 finalizer를 제거했다면 Patch가 실패해 동시성 문제를 방지합니다.

## 사용 패턴

```rust
use kube::runtime::finalizer::{finalizer, Event};

const FINALIZER_NAME: &str = "myapp.example.com/cleanup";

async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    let api = Api::<MyResource>::namespaced(
        ctx.client.clone(),
        &obj.namespace().unwrap(),
    );

    finalizer(&api, FINALIZER_NAME, obj, |event| async {
        match event {
            Event::Apply(obj) => apply(obj, &ctx).await,
            Event::Cleanup(obj) => cleanup(obj, &ctx).await,
        }
    }).await
}

async fn apply(obj: Arc<MyResource>, ctx: &Context) -> Result<Action, Error> {
    // 정상 reconcile 로직
    Ok(Action::requeue(Duration::from_secs(300)))
}

async fn cleanup(obj: Arc<MyResource>, ctx: &Context) -> Result<Action, Error> {
    // 외부 리소스 정리
    // 이 함수가 성공하면 finalizer가 제거됩니다
    Ok(Action::await_change())
}
```

## 주의사항

### cleanup 실패 시 객체가 삭제되지 않습니다

`deletionTimestamp`는 설정되었지만 finalizer가 남아있으므로 Kubernetes가 실제 삭제를 수행하지 않습니다. cleanup은 **반드시 최종적으로 성공하도록** 설계해야 합니다. 영구적으로 실패하면 `kubectl delete --force`로 강제 삭제할 수 있지만, 정리 작업은 건너뛰게 됩니다.

### finalizer 이름은 도메인 형식이어야 합니다

`"myapp.example.com/cleanup"` 형식입니다. 다른 컨트롤러의 finalizer와 충돌하지 않도록 고유한 이름을 사용합니다.

### 클러스터 스코프 부모 + 네임스페이스 스코프 자식

클러스터 스코프 CR이 네임스페이스 스코프 자식을 owns할 때, 부모의 namespace가 `None`이고 자식의 namespace가 `Some("ns")`이므로 ObjectRef 매칭에 문제가 생길 수 있습니다. ownerReferences는 같은 namespace 또는 클러스터 스코프 리소스만 참조할 수 있습니다.

### finalizer + predicate_filter 상호작용

finalizer 추가/제거는 `generation`을 변경하지 않습니다. `predicates::generation`만 사용하면 finalizer 관련 이벤트를 놓칩니다.

```rust
// ✗ finalizer 이벤트를 놓칠 수 있음
.predicate_filter(predicates::generation)

// ✓ finalizer 변경도 감지
.predicate_filter(predicates::generation.combine(predicates::finalizers))
```

## 정리 전략 매트릭스

관계 유형에 따라 정리 방법이 달라집니다:

| 관계 유형 | 설정 방법 | 정리 방법 | Finalizer 필요? |
|-----------|----------|----------|----------------|
| **Owned** (owns) | `ownerReferences` 설정 | Kubernetes 자동 GC | 보통 불필요 |
| **Watched** (watches) | mapper 함수로 매핑 | reconciler에서 직접 삭제 | 필요 |
| **External** (클러스터 외부) | — | cleanup에서 외부 API 호출 | 필요 |

- **Owned**: `ownerReferences`가 있으므로 부모 삭제 시 Kubernetes가 자식을 자동 삭제합니다. 외부 리소스를 동시에 관리하지 않는 한 finalizer가 필요 없습니다.
- **Watched**: 소유 관계가 아니므로 자동 GC가 동작하지 않습니다. finalizer의 `Event::Cleanup`에서 관련 리소스를 직접 삭제해야 합니다.
- **External**: 클러스터 밖의 리소스(DNS 레코드, 클라우드 로드밸런서 등)는 Kubernetes가 관리하지 않으므로, finalizer로 삭제 전 외부 API를 호출해 정리합니다.
