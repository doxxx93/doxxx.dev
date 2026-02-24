---
sidebar_position: 6
title: "Generic Controllers"
description: "Generic reconcilers using PartialObjectMeta and DynamicObject, and running multiple Controllers"
---

# Generic Controllers

This section covers patterns for reusing a single reconciler logic across multiple resource types, or handling resources whose types are determined at runtime.

## PartialObjectMeta-Based Generic Reconciler

When you only need to process metadata for any resource (label syncing, annotation-based logic, etc.), write a generic reconciler using `PartialObjectMeta<K>`.

```rust title="kube-core/src/metadata.rs (simplified)"
pub struct PartialObjectMeta<K = DynamicObject> {
    pub types: Option<TypeMeta>,
    pub metadata: ObjectMeta,
    pub _phantom: PhantomData<K>,
}
```

`PartialObjectMeta<K>` implements the `Resource` trait and uses the group, version, and kind information from `K`. It does not include the actual spec and status.

### Combining with metadata_watcher

```rust
use kube::runtime::watcher::metadata_watcher;
use kube::core::PartialObjectMeta;
use kube::runtime::Controller;

// Controller that handles PartialObjectMeta<MyResource>
let (reader, writer) = reflector::store();
let stream = reflector(writer, metadata_watcher(api, wc))
    .applied_objects();

Controller::for_stream(stream, reader)
    .run(reconcile_metadata, error_policy, ctx)
```

The reconciler receives `Arc<PartialObjectMeta<K>>`:

```rust
async fn reconcile_metadata(
    obj: Arc<PartialObjectMeta<MyResource>>,
    ctx: Arc<Context>,
) -> Result<Action, Error> {
    let name = obj.metadata.name.as_deref().unwrap_or_default();
    let labels = obj.metadata.labels.as_ref();

    // Metadata-based logic
    Ok(Action::await_change())
}
```

:::tip[Memory savings]
`PartialObjectMeta` does not deserialize spec and status, so it significantly saves memory when watching large-scale resources. See [Optimization — metadata_watcher](../production/optimization.md#metadata_watcher) for details.
:::

## DynamicObject-Based Generics

Use `DynamicObject` when the type is not known at compile time, or when the type is determined by runtime configuration.

```rust title="kube-core/src/dynamic.rs (simplified)"
pub struct DynamicObject {
    pub types: Option<TypeMeta>,
    pub metadata: ObjectMeta,
    pub data: serde_json::Value,
}
```

The `Resource` trait implementation for `DynamicObject` has `DynamicType = ApiResource`. You must provide an `ApiResource` at runtime:

```rust
use kube::api::{Api, ApiResource, DynamicObject};
use kube::discovery;

// Determine resource type at runtime
let ar = ApiResource::from_gvk(&GroupVersionKind {
    group: "example.com".into(),
    version: "v1".into(),
    kind: "Document".into(),
});
let api = Api::<DynamicObject>::all_with(client.clone(), &ar);

// Or obtain from discovery
let (ar, _caps) = discovery::pinned_kind(&client, &gvk).await?;
let api = Api::<DynamicObject>::all_with(client, &ar);
```

### DynamicObject Reconciler

```rust
async fn reconcile_dynamic(
    obj: Arc<DynamicObject>,
    ctx: Arc<Context>,
) -> Result<Action, Error> {
    let name = obj.metadata.name.as_deref().unwrap_or_default();

    // Access JSON values from the data field
    let title = obj.data.get("spec")
        .and_then(|s| s.get("title"))
        .and_then(|t| t.as_str());

    // Use try_parse if you need strong typing
    // let typed: MyResource = obj.try_parse()?;

    Ok(Action::await_change())
}
```

:::warning[Type safety]
`DynamicObject` accesses data via `serde_json::Value`, so there is no compile-time validation. Use static types whenever possible, and only use `DynamicObject` when truly necessary.
:::

## Generic Controller Function

To apply the same controller logic to multiple resource types, abstract it as a generic function:

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
    // Common reconcile logic
    Ok(Action::await_change())
}
```

The `K: Resource<DynamicType = ()>` bound means static types (CRDs, k8s-openapi types). To use `DynamicObject`, change the bound to `DynamicType = ApiResource` and pass the `ApiResource` accordingly.

## Running Multiple Controllers Concurrently

Running multiple Controllers in a single binary is a common pattern.

### tokio::join!

Waits until all Controllers complete. If one exits, the others continue running:

```rust
let ctrl_a = Controller::new(api_a, wc.clone())
    .shutdown_on_signal()
    .run(reconcile_a, error_policy, ctx.clone())
    .for_each(|_| async {});

let ctrl_b = Controller::new(api_b, wc.clone())
    .shutdown_on_signal()
    .run(reconcile_b, error_policy, ctx.clone())
    .for_each(|_| async {});

// Run both
tokio::join!(ctrl_a, ctrl_b);
```

### tokio::select!

Stops everything when the first Controller exits:

```rust
tokio::select! {
    _ = ctrl_a => tracing::warn!("controller A exited"),
    _ = ctrl_b => tracing::warn!("controller B exited"),
}
```

| Pattern | When one exits | When to use |
|---------|---------------|-------------|
| `join!` | Others continue running | Independent Controllers |
| `select!` | All stop | Controllers that must run together |

:::tip[With shutdown_on_signal]
Setting `shutdown_on_signal()` on each Controller causes all Controllers to shut down gracefully on SIGTERM. When used with `join!`, the process exits after all Controllers complete their graceful shutdown.
:::

## Shared Resources

### Client clone

`kube::Client` is internally wrapped in `Arc`, so `clone()` is cheap. Multiple Controllers share the same Client:

```rust
let client = Client::try_default().await?;

// clone is equivalent to Arc::clone — cheap
let api_a = Api::<ResourceA>::all(client.clone());
let api_b = Api::<ResourceB>::all(client.clone());
```

### Shared Reflector

When multiple Controllers watch the same resource, the watch connections are duplicated. A shared reflector lets multiple Controllers share a single watch:

```rust
use kube::runtime::{reflector, watcher, WatchStreamExt, Controller};

// Create a shared store
let (reader, writer) = reflector::store_shared(1024);
let stream = watcher(api, wc)
    .default_backoff()
    .reflect_shared(writer);

// Branch to each Controller via subscribers
let sub_a = reader.subscribe().unwrap();
let sub_b = reader.subscribe().unwrap();

let ctrl_a = Controller::for_shared_stream(sub_a, reader.clone())
    .run(reconcile_a, error_policy, ctx.clone())
    .for_each(|_| async {});

let ctrl_b = Controller::for_shared_stream(sub_b, reader.clone())
    .run(reconcile_b, error_policy, ctx.clone())
    .for_each(|_| async {});

// Consume the source stream + run both Controllers concurrently
tokio::join!(stream.for_each(|_| async {}), ctrl_a, ctrl_b);
```

`owns`/`watches` also support shared streams. You can use `owns_shared_stream()` to share the watch for child resources as well.

:::warning[Unstable feature]
The shared reflector API is behind the `unstable-runtime-stream-control` feature:

```toml
kube = { version = "3.0.1", features = ["unstable-runtime-stream-control"] }
```
:::

For other ways to reduce API server load, see [Optimization — API server load](../production/optimization.md#api-server-load).
