---
sidebar_position: 3
title: "최적화"
description: "watcher, reflector, reconciler 각 단계에서의 성능 최적화"
---

# 최적화

대규모 클러스터에서 컨트롤러가 효율적으로 동작하도록 각 레이어별 최적화 방법을 다룹니다.

## Watcher 최적화

### 감시 범위 축소

label selector와 field selector로 API 서버가 필터링하게 합니다. 네트워크 트래픽과 메모리를 모두 절약합니다.

```rust
use kube::runtime::watcher;

let wc = watcher::Config::default()
    .labels("app=myapp")                    // label selector
    .fields("metadata.name=specific-one");  // field selector
```

### metadata_watcher

spec과 status가 필요 없고 메타데이터만 필요한 경우 `metadata_watcher()`를 사용합니다. `PartialObjectMeta`만 수신하므로 메모리 사용량이 크게 줄어듭니다.

```rust
use kube::runtime::watcher::metadata_watcher;
use kube::core::PartialObjectMeta;

let stream = metadata_watcher(api, wc).default_backoff();
```

큰 spec을 가진 리소스(Secret, ConfigMap 등)에서 효과적입니다. 단, reconciler에서 전체 객체가 필요하면 별도 `get()` 호출이 필요합니다.

### StreamingList

[Watcher 상태 머신](../runtime-internals/watcher.md)에서 다룬 StreamingList 전략을 사용하면 초기 목록 로드 시 메모리 피크를 낮출 수 있습니다.

```rust
let wc = watcher::Config::default().streaming_lists();
```

Kubernetes 1.27 이상이 필요합니다. LIST 대신 WATCH로 초기 목록을 스트리밍하므로 전체 목록을 한 번에 메모리에 올리지 않습니다.

### page_size 조절

기본 page_size는 500입니다 (client-go와 동일).

| 클러스터 규모 | 권장 | 이유 |
|-------------|------|------|
| 소규모 (수백 개) | 더 크게 (1000+) | API 호출 수 감소 |
| 대규모 (수만 개) | 더 작게 (100~300) | 메모리 피크 감소 |

```rust
let wc = watcher::Config::default().page_size(100);
```

## Reflector 최적화

### 불필요한 필드 제거

[Reflector와 Store](../runtime-internals/reflector-and-store.md)에 캐시되는 객체에서 불필요한 필드를 제거하면 메모리를 절약합니다.

```rust
use kube::runtime::WatchStreamExt;

let stream = watcher(api, wc)
    .default_backoff()
    .modify(|obj| {
        // managedFields 제거 — 상당한 메모리 절약
        obj.managed_fields_mut().clear();
        // last-applied-configuration annotation — SSA 이전 방식의 큰 annotation
        obj.annotations_mut()
            .remove("kubectl.kubernetes.io/last-applied-configuration");
    });
```

:::warning[modify는 Store에 저장되기 전에 적용됩니다]
`modify`로 제거한 필드는 reconciler에서도 접근할 수 없습니다. reconciler에서 필요한 필드는 제거하지 않도록 주의합니다.
:::

### 메모리 추정

Store에 캐시된 객체 수와 평균 크기로 메모리를 추정합니다:

| 항목 | 계산 |
|------|------|
| 기본 사용량 | 객체 수 x 평균 크기 |
| re-list 스파이크 | old store + new buffer + 스트림 버퍼 = 최대 2~3배 |

jemalloc과 `MALLOC_CONF="prof:true"`로 힙 프로파일링을 하면 실제 메모리 사용 패턴을 확인할 수 있습니다.

## Reconciler 최적화

### 불필요한 reconcile 방지

[Reconciler 패턴](../patterns/reconciler.md)에서 다룬 것처럼, status 변경으로 인한 자기 trigger를 방지합니다.

```rust
use kube::runtime::{predicates, WatchStreamExt};

Controller::new(api, wc)
    .with_stream_filter(predicates::generation)
```

status만 변경된 이벤트는 `generation`이 바뀌지 않으므로 필터링됩니다. finalizer를 사용한다면 `predicates::finalizers`도 조합합니다.

### debounce

짧은 시간 내 동일 객체에 대한 중복 trigger를 흡수합니다.

```rust
use kube::runtime::Config;

Controller::new(api, wc)
    .with_config(Config::default().debounce(Duration::from_secs(1)))
```

Deployment 업데이트 시 여러 ReplicaSet 이벤트가 연쇄적으로 발생하는 경우 등에서 효과적입니다.

### concurrency 제한

```rust
Controller::new(api, wc)
    .with_config(Config::default().concurrency(10))
```

| 설정 | 동작 |
|------|------|
| 0 (기본) | 제한 없음 |
| N | 최대 N개 동시 reconcile |

API 서버 부하를 제어하려면 적절한 값을 설정합니다. 같은 객체에 대한 동시 reconcile은 [Controller 파이프라인](../runtime-internals/controller-pipeline.md)에서 Runner가 자동으로 방지합니다.

### reconciler 내부 최적화

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // 1. Store에서 읽기 (API 호출 대신 캐시 활용)
    let related = ctx.store.get(&ObjectRef::new("related-name").within("ns"));

    // 2. 변경 필요 없으면 patch 건너뛰기
    let current_cm = cm_api.get("my-cm").await?;
    if current_cm.data == desired_cm.data {
        // patch 불필요 → API 호출 절약
    } else {
        cm_api.patch("my-cm", &pp, &patch).await?;
    }

    // 3. 독립적인 API 호출 병렬화
    let (secret, service) = tokio::try_join!(
        secret_api.get("my-secret"),
        svc_api.get("my-service"),
    )?;

    Ok(Action::requeue(Duration::from_secs(300)))
}
```

## 대규모 클러스터 고려사항

### 네임스페이스 분리

클러스터 전체 대신 특정 네임스페이스만 감시하면 부하를 크게 줄일 수 있습니다.

```rust
// 클러스터 전체 (부하 높음)
let api = Api::<MyResource>::all(client.clone());

// 특정 네임스페이스만 (부하 낮음)
let api = Api::<MyResource>::namespaced(client.clone(), "target-ns");
```

여러 네임스페이스를 처리해야 하면 네임스페이스별 Controller 인스턴스를 실행할 수 있습니다.

### re-list 메모리 스파이크

| 객체 수 | 평균 크기 | 기본 메모리 | re-list 피크 |
|---------|---------|-----------|-------------|
| 1,000 | 10KB | 10MB | ~30MB |
| 10,000 | 10KB | 100MB | ~300MB |
| 100,000 | 10KB | 1GB | ~3GB |

완화 방법:
- StreamingList로 피크 감소
- `metadata_watcher()`로 객체 크기 축소
- `.modify()`로 불필요한 필드 제거
- label selector로 대상 축소

### API 서버 부하

`owns()`와 `watches()`를 추가할 때마다 별도 watch 연결이 생깁니다. 각 watch는 API 서버와 지속적인 HTTP 연결을 유지합니다.

가능하면 `unstable-runtime` feature의 shared reflector로 여러 컨트롤러가 같은 watch를 공유할 수 있습니다.

### Leader election

HA 배포에서는 여러 인스턴스 중 하나만 active로 동작해야 합니다. kube-rs에는 leader election이 내장되어 있지 않으므로, Lease 객체를 이용해 직접 구현하거나 외부 크레이트를 사용합니다.

```rust
// Lease 기반 leader election 개념
let lease_api = Api::<Lease>::namespaced(client, "default");
// Lease를 주기적으로 갱신하며 리더 유지
// 다른 인스턴스는 Lease가 만료될 때까지 대기
```

active 인스턴스만 `Controller::run()`을 실행하고, standby 인스턴스는 Lease를 감시하며 대기합니다.
