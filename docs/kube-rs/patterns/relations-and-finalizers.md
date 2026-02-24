---
sidebar_position: 2
title: "관계와 Finalizer"
description: "ownerReferences, watches, finalizer 상태 머신의 동작 원리"
---

# 관계와 Finalizer

Controller가 여러 리소스의 변경을 감지하는 방법(owns, watches)과, 리소스 삭제 전 정리 작업을 보장하는 finalizer의 동작 원리를 다룬다.

## 소유 관계 — owns

<!--
controller.owns::<ConfigMap>(api, wc):

내부:
1. ConfigMap에 대한 watcher 생성
2. 각 ConfigMap 변경 시 trigger_owners() 호출
3. ConfigMap의 metadata.ownerReferences[] 순회
4. 부모의 kind/apiVersion이 Controller 주 리소스와 일치하면
   → 부모의 ObjectRef로 ReconcileRequest 생성

ownerReference 설정:
let owner_ref = obj.controller_owner_ref(&()).unwrap();
child.metadata.owner_references = Some(vec![owner_ref]);

controller_owner_ref vs owner_ref:
- controller_owner_ref: controller: true 설정 → 하나의 컨트롤러만 소유
- owner_ref: controller 미설정 → 여러 소유자 가능

자동 가비지 컬렉션:
- ownerReference가 있으면 부모 삭제 시 Kubernetes가 자식 자동 삭제
- propagationPolicy에 따라 Foreground/Background/Orphan 선택
-->

## 감시 관계 — watches

<!--
controller.watches::<Secret>(api, wc, mapper_fn):

mapper_fn: |secret: Arc<Secret>| -> Vec<ObjectRef<MyResource>>
→ 이 Secret 변경 시 어떤 주 리소스를 reconcile할지 매핑

내부:
1. Secret에 대한 watcher 생성
2. Secret 변경 시 trigger_others(mapper) 호출
3. mapper가 반환한 ObjectRef마다 ReconcileRequest 생성

owns와 차이:
- owns: ownerReferences로 자동 매핑 (관계가 리소스에 기록됨)
- watches: 사용자 정의 매핑 함수 (관계가 코드에 정의됨)

사용 사례:
- Secret 변경 → 해당 Secret을 참조하는 모든 리소스 재reconcile
- Namespace 라벨 변경 → 해당 NS의 모든 리소스 재reconcile
-->

## Finalizer 상태 머신

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

<!--
네 가지 상태:

(None, false) — finalizer 없고 삭제 아님:
  → JSON Patch로 finalizer 추가
  → 이후 Event::Apply로 정상 reconcile

(Some(i), false) — finalizer 있고 삭제 아님:
  → Event::Apply 발행 → 정상 reconcile 로직

(Some(i), true) — finalizer 있고 삭제 중:
  → Event::Cleanup 발행 → 정리 작업 실행
  → 성공하면 JSON Patch로 finalizer 제거
  → ⚠️ Patch에 Test operation 포함 → 동시성 안전 (다른 프로세스가 먼저 제거했으면 실패)

(None, true) — finalizer 없고 삭제 중:
  → 아무것도 안 함 (이미 정리됨 또는 우리 finalizer가 아님)
-->

## 사용 패턴

```rust
use kube::runtime::finalizer::{finalizer, Event};

const FINALIZER_NAME: &str = "myapp.example.com/cleanup";

async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    let api = Api::<MyResource>::namespaced(ctx.client.clone(), &obj.namespace().unwrap());

    finalizer(&api, FINALIZER_NAME, obj, |event| async {
        match event {
            Event::Apply(obj) => apply(obj, &ctx).await,
            Event::Cleanup(obj) => cleanup(obj, &ctx).await,
        }
    }).await
}
```

<!--
finalizer 이름 규칙:
- 도메인 형식 필수: "myapp.example.com/cleanup"
- 고유해야 함 (다른 컨트롤러와 충돌 방지)
-->

## ⚠️ 주의사항

<!--
1. cleanup 실패 시 객체가 영원히 삭제 안 됨
   - deletionTimestamp은 찍혔지만 finalizer가 남아있음
   - kubectl delete --force로 강제 삭제 가능하지만 정리 작업 건너뜀
   - cleanup은 반드시 성공하도록 (또는 최종적으로 성공하도록) 설계

2. 클러스터 스코프 CR → 네임스페이스 스코프 자식:
   - 부모의 namespace가 None, 자식의 namespace가 Some("ns")
   - ObjectRef 매칭 시 namespace 불일치 문제
   - ownerReferences는 같은 namespace 또는 클러스터 스코프만 참조 가능

3. finalizer + predicate_filter 상호작용:
   - finalizer 추가/제거는 generation 변경 안 함
   - predicates::generation만 쓰면 finalizer 관련 이벤트 놓침
   - predicates::generation.fallback(predicates::finalizers) 사용
-->
