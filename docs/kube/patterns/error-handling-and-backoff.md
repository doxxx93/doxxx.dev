---
sidebar_position: 5
title: "에러 처리와 Backoff"
description: "에러 발생 지점, backoff 전략, 타임아웃 함정"
---

# 에러 처리와 Backoff

kube에서 에러는 여러 계층에서 발생합니다. 어디서 어떤 에러가 나오고, 각 계층에서 어떻게 처리해야 하는지 정리합니다.

## 에러 발생 지점 맵

```mermaid
graph TD
    A["Client::send()"] -->|"네트워크/TLS/타임아웃"| E1["kube::Error::HyperError<br/>kube::Error::HttpError"]
    B["Api::list() / get() / patch()"] -->|"4xx/5xx"| E2["kube::Error::Api { status }"]
    B -->|"역직렬화 실패"| E3["kube::Error::SerializationError"]
    C["watcher()"] -->|"초기 LIST 실패"| E4["watcher::Error::InitialListFailed"]
    C -->|"WATCH 연결 실패"| E5["watcher::Error::WatchFailed"]
    C -->|"WATCH 중 서버 에러"| E6["watcher::Error::WatchError"]
    D["Controller::run()"] -->|"trigger 스트림"| C
    D -->|"사용자 코드"| E7["reconciler Error"]

    style E1 fill:#ffebee
    style E2 fill:#ffebee
    style E7 fill:#fff3e0
```

| 계층 | 에러 타입 | 원인 |
|------|----------|------|
| Client | `HyperError`, `HttpError` | 네트워크, TLS, 타임아웃 |
| Api | `Error::Api { status }` | Kubernetes 4xx/5xx 응답 |
| Api | `SerializationError` | JSON deserialization 실패 |
| watcher | `InitialListFailed` | 초기 LIST 실패 |
| watcher | `WatchFailed` | WATCH 연결 실패 |
| watcher | `WatchError` | WATCH 중 서버 에러 (410 Gone 등) |
| Controller | reconciler Error | 사용자 코드에서 발생 |

## Watcher 에러와 backoff

:::warning[반드시 backoff을 붙여야 합니다]
```rust
// ✗ backoff 없으면 에러 시 타이트 재시도 루프
let stream = watcher(api, wc);

// ✓ 지수 백오프로 자동 재시도
let stream = watcher(api, wc).default_backoff();
```
:::

### default_backoff

`ExponentialBackoff`를 적용합니다: 800ms → 1.6초 → 3.2초 → ... → 30초(최대). 성공적인 이벤트를 수신하면 backoff가 리셋됩니다. 120초 동안 에러가 없으면 타이머도 리셋됩니다.

### 커스텀 backoff

```rust
use backon::ExponentialBuilder;

let stream = watcher(api, wc).backoff(
    ExponentialBuilder::default()
        .with_min_delay(Duration::from_millis(500))
        .with_max_delay(Duration::from_secs(30)),
);
```

## Reconciler 에러와 error_policy

```rust
fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    tracing::error!(?err, "reconcile failed");

    match err {
        // 일시적 에러: 재시도
        Error::KubeApi(_) => Action::requeue(Duration::from_secs(5)),
        // 영구적 에러: 재시도하지 않음
        Error::MissingField(_) => Action::await_change(),
    }
}
```

`Controller::run(reconcile, error_policy, ctx)`:
- reconciler가 `Err`를 반환하면 `error_policy`가 호출됩니다
- `error_policy`가 반환한 `Action`에 따라 scheduler에 예약합니다

### 현재 한계

- `error_policy`는 **동기 함수**입니다. async 작업(메트릭 전송, status 업데이트 등)을 할 수 없습니다
- 성공 시 reset 콜백이 없습니다. per-key backoff를 구현하려면 reconciler를 wrapper로 감싸야 합니다 ([Per-key backoff 패턴](./reconciler.md#per-key-backoff-패턴) 참고)

## Client 레벨 재시도

기본적으로 kube-client는 일반 API 호출을 재시도하지 않습니다. `create()`, `patch()`, `get()` 등이 실패하면 그대로 에러를 반환합니다.

버전 3부터 kube는 내장 [`RetryPolicy`](https://docs.rs/kube/latest/kube/client/retry/struct.RetryPolicy.html)를 제공합니다. Tower의 retry 미들웨어를 구현하며, 429, 503, 504에 대해 지수 백오프로 재시도합니다:

```rust
use kube::client::retry::RetryPolicy;
use tower::{ServiceBuilder, retry::RetryLayer, buffer::BufferLayer};

let service = ServiceBuilder::new()
    .layer(config.base_uri_layer())
    .option_layer(config.auth_layer()?)
    .layer(BufferLayer::new(1024))
    .layer(RetryLayer::new(RetryPolicy::default()))
    // ...
```

### 재시도 가능 여부

| 에러 | 재시도 | 이유 |
|------|--------|------|
| 5xx | 가능 | 서버 일시 장애 |
| 타임아웃 | 가능 | 일시적 네트워크 문제 |
| 429 Too Many Requests | 가능 | rate limit → 대기 후 재시도 |
| 네트워크 에러 | 가능 | 일시적 연결 실패 |
| 4xx (400, 403, 404 등) | 불가 | 요청이 잘못됨 |
| 409 Conflict | 불가 | SSA 충돌 → 로직 수정 필요 |

## 타임아웃 전략

reconciler 내부에서 느린 API 호출을 방어하려면 `tokio::time::timeout`으로 개별 호출을 감쌉니다:

```rust
let pod = tokio::time::timeout(
    Duration::from_secs(10),
    api.get("my-pod"),
).await??;
```

Controller 컨텍스트에서 스트림 타임아웃은 watcher 내부의 idle timeout과 스트림 backoff 파라미터에 의존합니다. 보통 reconciler 내부의 개별 API 호출만 짧은 타임아웃이 필요합니다.
