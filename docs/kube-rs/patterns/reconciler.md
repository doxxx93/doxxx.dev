---
sidebar_position: 1
title: "Reconciler 패턴"
description: "idempotent reconciler 작성법, 무한루프 방지, Action 전략"
---

# Reconciler 패턴

Reconciler는 Controller의 핵심입니다. "현재 상태를 보고 원하는 상태로 수렴시키는" 함수를 어떻게 올바르게 작성하는지, 흔한 실수는 무엇인지 다룹니다.

## 함수 시그니처

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // ...
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

<!--
- Arc<K>: Store에서 꺼낸 객체 (clone 없이 공유)
- Arc<Context>: 의존성 주입 컨테이너
- 반환: Action (성공 시 다음 행동) 또는 Error

Context 패턴:
struct Context {
    client: Client,
    metrics: Metrics,
    config: AppConfig,
    // 외부 서비스 클라이언트 등
}
→ reconciler를 순수 함수에 가깝게 유지
→ 테스트 시 mock Context 주입 가능
-->

## 핵심 원칙: Idempotency

<!--
"같은 reconcile을 100번 호출해도 결과가 같아야 한다"

level-triggered vs edge-triggered:
- edge-triggered: "무엇이 변했는가"에 반응 → kube-rs가 아닌 접근
- level-triggered: "현재 상태가 무엇인가"를 보고 수렴 → kube-rs의 설계 철학

왜 trigger reason을 안 주는가:
- Controller가 의도적으로 숨김
- reconciler는 "왜 호출되었는지" 모르는 채로 동작해야
- ReconcileReason은 tracing span에만 존재 (로깅/디버깅용)
- 이유: watch 이벤트는 병합/중복/유실될 수 있어서 event-driven은 신뢰 불가
-->

## ⚠️ 무한 루프 패턴

<!--
패턴 1: status에 비결정론적 값 쓰기
  reconcile → status.last_updated = Utc::now()
  → 새 resourceVersion → watch 이벤트 → 재trigger → 무한반복

패턴 2: 다른 컨트롤러와 경쟁
  내 controller가 Deployment에 annotation 추가
  → Deployment controller가 다른 필드 수정
  → 내 controller가 다시 trigger → 무한반복

방지법:

1. 결정론적 값만 쓰기
   - 타임스탬프 대신 해시, generation 등
   - 값이 같으면 patch 건너뛰기

2. predicate_filter:
   .applied_objects()
   .predicate_filter(predicates::generation)
   → status 변경은 generation 안 바뀜 → 필터링

   ⚠️ finalizer + generation predicate 조합:
   - finalizer 추가도 generation 안 바뀜 → 이벤트 누락
   - 대응: predicates::generation.fallback(predicates::finalizers)

3. 조건부 업데이트:
   if current_status != desired_status {
       api.patch_status(...).await?;
   }
-->

## Action 전략

<!--
Action::requeue(Duration::from_secs(300)):
- 300초 후 재실행 예약
- 외부 상태에 의존할 때 (주기적 확인)
- 예: 외부 API 상태 폴링

Action::await_change():
- 능동적 requeue 없음
- 다음 watch 이벤트가 올 때만 재실행
- 예: 자기 리소스 + owns 관계만 볼 때

error_policy에서의 전략:
fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    Action::requeue(Duration::from_secs(5))
}
- 고정 간격: 단순하지만 API 서버에 부하 가능
- 지수 증가: per-key backoff 패턴 필요 (아래 참조)
-->

## Per-key backoff 패턴

<!--
kube-rs에 내장 per-key backoff가 없음 (Go controller-runtime과 차이)

Wrapper 패턴:
struct ReconcilerState {
    failure_counts: Arc<Mutex<HashMap<ObjectRef<MyResource>, u32>>>,
}

async fn reconcile_wrapper(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    match reconcile_inner(&obj, &ctx).await {
        Ok(action) => {
            ctx.state.failure_counts.lock().remove(&obj.object_ref());
            Ok(action)
        }
        Err(e) => {
            let mut counts = ctx.state.failure_counts.lock();
            let count = counts.entry(obj.object_ref()).or_insert(0);
            *count += 1;
            let backoff = Duration::from_secs(2u64.pow((*count).min(6)));
            Err(e) // error_policy에서 backoff 사용
        }
    }
}

현재 한계:
- error_policy는 동기 함수 → async 작업 불가
- 성공 시 reset 콜백 없음 → wrapper에서 직접 관리
-->

## 에러 처리

<!--
thiserror vs anyhow:
- Controller::run()이 Error에 대해 특정 trait bound 요구
- anyhow::Error는 이 bound를 만족 안 함
- thiserror로 구체적 에러 타입 정의 권장

#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("Kubernetes API error: {0}")]
    KubeApi(#[from] kube::Error),
    #[error("Missing spec field: {0}")]
    MissingField(String),
    #[error("External service error: {0}")]
    External(String),
}

일시적 vs 영구적 에러:
- 일시적: 네트워크, 타임아웃 → requeue로 재시도
- 영구적: 잘못된 spec → status에 condition 기록 + await_change()
-->
