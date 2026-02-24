---
sidebar_position: 6
title: "제네릭 컨트롤러"
description: "PartialObjectMeta, DynamicObject를 활용한 제네릭 reconciler와 다중 Controller 실행"
---

# 제네릭 컨트롤러

하나의 reconciler 로직을 여러 리소스 타입에 재사용하거나, 런타임에 타입이 결정되는 리소스를 다루는 패턴을 다룹니다.

## PartialObjectMeta 기반 제네릭 reconciler

모든 리소스에 대해 메타데이터만 처리하는 경우(라벨 동기화, annotation 기반 로직 등), `PartialObjectMeta<K>`로 제네릭 reconciler를 작성합니다.

```rust title="kube-core/src/metadata.rs (단순화)"
pub struct PartialObjectMeta<K = DynamicObject> {
    pub types: Option<TypeMeta>,
    pub metadata: ObjectMeta,
    pub _phantom: PhantomData<K>,
}
```

`PartialObjectMeta<K>`는 `Resource` trait을 구현하며, `K`의 group, version, kind 정보를 사용합니다. 실제 spec과 status는 포함하지 않습니다.

### metadata_watcher와 조합

```rust
use kube::runtime::watcher::metadata_watcher;
use kube::core::PartialObjectMeta;
use kube::runtime::Controller;

// PartialObjectMeta<MyResource>를 다루는 Controller
let (reader, writer) = reflector::store();
let stream = reflector(writer, metadata_watcher(api, wc))
    .applied_objects();

Controller::for_stream(stream, reader)
    .run(reconcile_metadata, error_policy, ctx)
```

reconciler는 `Arc<PartialObjectMeta<K>>`를 받습니다:

```rust
async fn reconcile_metadata(
    obj: Arc<PartialObjectMeta<MyResource>>,
    ctx: Arc<Context>,
) -> Result<Action, Error> {
    let name = obj.metadata.name.as_deref().unwrap_or_default();
    let labels = obj.metadata.labels.as_ref();

    // 메타데이터 기반 로직
    Ok(Action::await_change())
}
```

:::tip[메모리 절약]
`PartialObjectMeta`는 spec과 status를 역직렬화하지 않으므로, 대규모 리소스를 감시할 때 메모리를 크게 절약합니다. [최적화 — metadata_watcher](../production/optimization.md#metadata_watcher)에서 자세히 다룹니다.
:::

## DynamicObject 기반 제네릭

컴파일 타임에 타입을 알 수 없거나, 런타임 설정으로 타입이 결정되는 경우 `DynamicObject`를 사용합니다.

```rust title="kube-core/src/dynamic.rs (단순화)"
pub struct DynamicObject {
    pub types: Option<TypeMeta>,
    pub metadata: ObjectMeta,
    pub data: serde_json::Value,
}
```

`DynamicObject`의 `Resource` trait 구현은 `DynamicType = ApiResource`입니다. 런타임에 `ApiResource`를 제공해야 합니다:

```rust
use kube::api::{Api, ApiResource, DynamicObject};
use kube::discovery;

// 런타임에 리소스 타입 결정
let ar = ApiResource::from_gvk(&GroupVersionKind {
    group: "example.com".into(),
    version: "v1".into(),
    kind: "Document".into(),
});
let api = Api::<DynamicObject>::all_with(client.clone(), &ar);

// 또는 discovery에서 가져오기
let (ar, _caps) = discovery::pinned_kind(&client, &gvk).await?;
let api = Api::<DynamicObject>::all_with(client, &ar);
```

### DynamicObject reconciler

```rust
async fn reconcile_dynamic(
    obj: Arc<DynamicObject>,
    ctx: Arc<Context>,
) -> Result<Action, Error> {
    let name = obj.metadata.name.as_deref().unwrap_or_default();

    // data 필드에서 JSON 값 접근
    let title = obj.data.get("spec")
        .and_then(|s| s.get("title"))
        .and_then(|t| t.as_str());

    // 강타입이 필요하면 try_parse
    // let typed: MyResource = obj.try_parse()?;

    Ok(Action::await_change())
}
```

:::warning[타입 안정성]
`DynamicObject`는 `serde_json::Value`로 데이터에 접근하므로 컴파일 타임 검증이 없습니다. 가능하면 정적 타입을 사용하고, 정말 필요한 경우에만 `DynamicObject`를 사용합니다.
:::

## 제네릭 Controller 함수

여러 리소스 타입에 같은 컨트롤러 로직을 적용하려면 제네릭 함수로 추상화합니다:

```rust
use kube::{Api, Client, Resource, ResourceExt};
use kube::runtime::{Controller, watcher, Config};
use std::fmt::Debug;

async fn run_controller<K>(
    client: Client,
    ctx: Arc<Context>,
) -> anyhow::Result<()>
where
    K: Resource<DynamicType = ()>
        + Clone + Debug
        + serde::de::DeserializeOwned
        + Send + Sync + 'static,
{
    let api = Api::<K>::all(client);
    Controller::new(api, watcher::Config::default())
        .shutdown_on_signal()
        .run(reconcile::<K>, error_policy::<K>, ctx)
        .for_each(|res| async move {
            match res {
                Ok(obj) => tracing::info!(?obj, "reconciled"),
                Err(err) => tracing::error!(%err, "reconcile failed"),
            }
        })
        .await;
    Ok(())
}

async fn reconcile<K: Resource<DynamicType = ()>>(
    obj: Arc<K>,
    ctx: Arc<Context>,
) -> Result<Action, Error> {
    let name = obj.meta().name.as_deref().unwrap_or_default();
    // 공통 reconcile 로직
    Ok(Action::await_change())
}
```

`K: Resource<DynamicType = ()>` 바운드는 정적 타입(CRD, k8s-openapi 타입)을 의미합니다. `DynamicObject`를 사용하려면 `DynamicType = ApiResource`로 바운드를 변경하고 `ApiResource`를 전달해야 합니다.

## 여러 Controller 동시 실행

하나의 바이너리에서 여러 Controller를 동시에 실행하는 것은 흔한 패턴입니다.

### tokio::join!

모든 Controller가 완료될 때까지 대기합니다. 하나가 종료되면 나머지는 계속 실행됩니다:

```rust
let ctrl_a = Controller::new(api_a, wc.clone())
    .shutdown_on_signal()
    .run(reconcile_a, error_policy, ctx.clone())
    .for_each(|_| async {});

let ctrl_b = Controller::new(api_b, wc.clone())
    .shutdown_on_signal()
    .run(reconcile_b, error_policy, ctx.clone())
    .for_each(|_| async {});

// 둘 다 실행
tokio::join!(ctrl_a, ctrl_b);
```

### tokio::select!

먼저 종료되는 Controller가 있으면 전체를 중단합니다:

```rust
tokio::select! {
    _ = ctrl_a => tracing::warn!("controller A exited"),
    _ = ctrl_b => tracing::warn!("controller B exited"),
}
```

| 패턴 | 하나 종료 시 | 사용 시점 |
|------|------------|----------|
| `join!` | 나머지 계속 실행 | 독립적인 Controller |
| `select!` | 전부 중단 | 함께 실행되어야 하는 Controller |

:::tip[shutdown_on_signal과 함께]
`shutdown_on_signal()`을 각 Controller에 설정하면 SIGTERM 시 모든 Controller가 graceful하게 종료됩니다. `join!`과 함께 사용하면 모든 Controller의 graceful shutdown이 완료된 후 프로세스가 종료됩니다.
:::

## 공유 리소스

### Client clone

`kube::Client`는 내부적으로 `Arc`로 래핑되어 있어 `clone()`이 저렴합니다. 여러 Controller가 같은 Client를 공유합니다:

```rust
let client = Client::try_default().await?;

// clone은 Arc::clone과 동일 — 저렴
let api_a = Api::<ResourceA>::all(client.clone());
let api_b = Api::<ResourceB>::all(client.clone());
```

### 공유 Reflector

여러 Controller가 같은 리소스를 감시하면 watch 연결이 중복됩니다. `unstable-runtime` feature의 shared reflector로 하나의 watch를 여러 Controller가 공유할 수 있습니다:

```rust
// 하나의 reflector를 여러 Controller가 공유
let (reader, writer) = reflector::store();
let shared_stream = reflector(writer, watcher(api, wc))
    .applied_objects()
    .default_backoff();

// 스트림을 분기하여 각 Controller에 전달
Controller::for_stream(shared_stream.clone(), reader.clone())
    .run(reconcile_a, error_policy, ctx.clone());
```

:::warning[Unstable feature]
shared reflector API는 `unstable-runtime-stream-control` feature 뒤에 있습니다:

```toml
kube = { version = "3.0.1", features = ["unstable-runtime-stream-control"] }
```
:::

API 서버 부하를 줄이는 다른 방법은 [최적화 — API 서버 부하](../production/optimization.md#api-서버-부하)를 참고합니다.
