---
sidebar_position: 1
title: "Reconciler 패턴"
description: "idempotent reconciler 작성법, 무한루프 방지, Action 전략"
---

# Reconciler 패턴

Reconciler는 [Controller 파이프라인](../runtime-internals/controller-pipeline.md)의 핵심입니다. "현재 상태를 보고 원하는 상태로 수렴시키는" 함수를 어떻게 올바르게 작성하는지, 흔한 실수는 무엇인지 다룹니다.

## 함수 시그니처

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // ...
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

| 매개변수 | 역할 |
|---------|------|
| `Arc<K>` | Store에서 꺼낸 객체입니다. clone 없이 참조를 공유합니다. |
| `Arc<Context>` | 의존성 주입 컨테이너입니다. Client, 메트릭, 설정 등을 담습니다. |
| 반환 `Action` | 성공 시 다음 행동 (requeue 또는 await_change)입니다. |
| 반환 `Error` | 실패 시 error_policy에 전달됩니다. |

### Context 패턴

reconciler를 순수 함수에 가깝게 유지하려면 모든 외부 의존성을 Context에 담습니다.

```rust
struct Context {
    client: Client,
    metrics: Metrics,
    config: AppConfig,
}

// Controller 실행
let ctx = Arc::new(Context { client, metrics, config });
Controller::new(api, wc)
    .run(reconcile, error_policy, ctx)
    .for_each(|res| async move {
        match res {
            Ok(o) => tracing::info!("reconciled {:?}", o),
            Err(e) => tracing::error!("reconcile error: {:?}", e),
        }
    })
    .await;
```

테스트 시 mock Client를 주입할 수 있습니다.

## 핵심 원칙: Idempotency

**"같은 reconcile을 100번 호출해도 결과가 같아야 합니다."**

kube-rs의 Controller는 **level-triggered** 설계를 따릅니다:

| 방식 | 질문 | kube-rs |
|------|------|---------|
| edge-triggered | "무엇이 **변했는가**"에 반응 | ✗ |
| level-triggered | "현재 상태가 **무엇인가**"를 보고 수렴 | ✓ |

Controller가 의도적으로 trigger reason을 숨기는 이유: watch 이벤트는 병합, 중복, 유실될 수 있습니다. "왜 호출되었는가"에 의존하면 이벤트 누락 시 올바르게 동작하지 않습니다.

`ReconcileReason`은 tracing span에만 존재합니다. 로깅과 디버깅 목적이지, reconciler 로직에서 분기하라는 의미가 아닙니다.

## 무한 루프 패턴

### 패턴 1: status에 비결정론적 값 쓰기

```rust
// ✗ 이렇게 하면 안 됩니다
status.last_updated = Utc::now();  // 매번 다른 값
api.patch_status("name", &pp, &patch).await?;
// → 새 resourceVersion → watch 이벤트 → 재trigger → 무한반복
```

### 패턴 2: 다른 컨트롤러와 경쟁

내 controller가 Deployment에 annotation을 추가하면, Deployment controller가 다른 필드를 수정하고, 그것이 다시 내 controller를 trigger하는 루프입니다.

### 방지법

**1. 결정론적 값만 사용합니다**

타임스탬프 대신 해시, generation 등 결정론적인 값을 사용합니다. 값이 같으면 patch를 건너뜁니다.

```rust
// ✓ 값이 변했을 때만 업데이트
if current_status != desired_status {
    api.patch_status("name", &pp, &patch).await?;
}
```

**2. predicate_filter를 사용합니다**

```rust
use kube::runtime::{predicates, WatchStreamExt};

// status 변경은 generation이 바뀌지 않으므로 필터링됩니다
let stream = watcher(api, wc)
    .default_backoff()
    .applied_objects()
    .predicate_filter(predicates::generation);

Controller::for_stream(stream, reader)
```

`predicate_filter()`는 `WatchStreamExt` trait의 메서드입니다. `Controller`의 메서드가 아니므로, 스트림에 적용한 후 `Controller::for_stream()`으로 주입합니다.

:::warning[finalizer + generation predicate]
finalizer 추가/제거도 generation을 변경하지 않습니다. `predicates::generation`만 사용하면 finalizer 관련 이벤트를 놓칩니다.

```rust
// 두 predicate를 조합합니다
.predicate_filter(predicates::generation.combine(predicates::finalizers))
```
:::

## Action 전략

| Action | 언제 사용 |
|--------|---------|
| `Action::requeue(Duration)` | 외부 상태에 의존할 때. 주기적으로 확인이 필요한 경우 |
| `Action::await_change()` | 자기 리소스 + owns 관계만 볼 때. watch 이벤트가 올 때만 재실행 |

```rust
// 외부 API 상태를 5분마다 확인
Ok(Action::requeue(Duration::from_secs(300)))

// watch 이벤트가 올 때만 재실행
Ok(Action::await_change())
```

### error_policy에서의 전략

```rust
fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    tracing::error!(?err, "reconcile failed");
    Action::requeue(Duration::from_secs(5))
}
```

고정 간격은 단순하지만, 지속적인 에러 시 API 서버에 부하를 줄 수 있습니다. per-key 지수 backoff가 더 안전합니다.

## Per-key backoff 패턴

kube-rs에는 Go controller-runtime과 달리 내장 per-key backoff가 없습니다. wrapper 패턴으로 직접 구현합니다.

```rust
use std::collections::HashMap;
use std::sync::Mutex;

struct Context {
    client: Client,
    failure_counts: Mutex<HashMap<String, u32>>,
}

async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    let key = obj.name_any();

    match reconcile_inner(&obj, &ctx).await {
        Ok(action) => {
            // 성공 시 카운터 리셋
            ctx.failure_counts.lock().unwrap().remove(&key);
            Ok(action)
        }
        Err(e) => {
            // 실패 시 카운터 증가
            let mut counts = ctx.failure_counts.lock().unwrap();
            let count = counts.entry(key).or_insert(0);
            *count += 1;
            Err(e)
        }
    }
}

fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    let count = ctx.failure_counts.lock().unwrap()
        .get(&obj.name_any()).copied().unwrap_or(1);
    let backoff = Duration::from_secs(2u64.pow(count.min(6))); // 최대 64초
    Action::requeue(backoff)
}
```

## 에러 처리

### thiserror를 사용합니다

`Controller::run()`이 Error에 특정 trait bound를 요구하므로, `anyhow::Error`는 사용할 수 없습니다. `thiserror`로 구체적 에러 타입을 정의합니다.

```rust
#[derive(Debug, thiserror::Error)]
enum Error {
    #[error("Kubernetes API error: {0}")]
    KubeApi(#[from] kube::Error),

    #[error("Missing spec field: {0}")]
    MissingField(String),

    #[error("External service error: {0}")]
    External(String),
}
```

### 일시적 vs 영구적 에러

| 유형 | 예시 | 처리 |
|------|------|------|
| 일시적 | 네트워크 에러, 타임아웃, 429 | `error_policy`에서 requeue |
| 영구적 | 잘못된 spec, 유효하지 않은 설정 | status에 condition 기록 + `Action::await_change()` |

```rust
// 영구적 에러: status에 기록하고 재시도하지 않음
if !is_valid_spec(&obj.spec) {
    update_status_condition(&api, &obj, "InvalidSpec", "Spec validation failed").await?;
    return Ok(Action::await_change());
}
```
