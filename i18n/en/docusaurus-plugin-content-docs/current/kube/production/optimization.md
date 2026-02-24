---
sidebar_position: 3
title: "Optimization"
description: "Performance optimization at each stage: watcher, reflector, and reconciler"
---

# Optimization

Covers optimization methods at each layer to ensure controllers operate efficiently on large-scale clusters.

## Optimization Order

When performance issues arise, here is the priority for where to start. Listed from top to bottom in order of greatest impact with fewest side effects.

| Order | Task | Impact | Risk |
|-------|------|--------|------|
| 1 | **Diagnose** — Identify the actual bottleneck | Sets direction | None |
| 2 | **Narrow selectors** — Add label/field selectors | Reduces API server load, network, and memory simultaneously | Low |
| 3 | **predicate_filter** — Eliminate unnecessary reconciles | Reduces reconcile invocation count | Low (be careful with predicate combinations) |
| 4 | **metadata_watcher** — Skip receiving spec/status | Reduces memory usage | Medium (requires a get call if the reconciler needs the full object) |
| 5 | **Reflector cleanup** — Remove unnecessary fields with `.modify()` | Reduces Store memory | Low |
| 6 | **Reconciler tuning** — debounce, concurrency, cache utilization | Reduces API calls, controls throughput | Low |
| 7 | **Sharding** — Distribute by namespace/label | Horizontal scaling | High (increases operational complexity) |

**Step 1 (diagnosis) is the most important.** The approach differs depending on whether the problem is memory, reconcile latency, or API server throttling. Check logs with `RUST_LOG=kube=debug`, and measure reconcile count and duration using the metrics from [Monitoring](./observability.md). If memory is suspected, verify Store size with jemalloc profiling. For symptom-based diagnosis, refer to [Troubleshooting](../patterns/troubleshooting.md).

## Watcher Optimization

### Narrowing the Watch Scope

Use label selectors and field selectors to let the API server do the filtering. This saves both network traffic and memory.

```rust
use kube::runtime::watcher;

let wc = watcher::Config::default()
    .labels("app=myapp")                    // label selector
    .fields("metadata.name=specific-one");  // field selector
```

### metadata_watcher

When you only need metadata and not spec or status, use `metadata_watcher()`. Since it only receives `PartialObjectMeta`, memory usage is significantly reduced.

```rust
use kube::runtime::watcher::metadata_watcher;
use kube::core::PartialObjectMeta;

let stream = metadata_watcher(api, wc).default_backoff();
```

This is particularly effective for resources with large specs (Secrets, ConfigMaps, etc.). However, if the reconciler needs the full object, a separate `get()` call is required.

### StreamingList

Using the StreamingList strategy discussed in [Watcher State Machine](../runtime-internals/watcher.md) can reduce the memory peak during initial list loading.

```rust
let wc = watcher::Config::default().streaming_lists();
```

Requires Kubernetes 1.27 or later. It streams the initial list via WATCH instead of LIST, so the entire list is not loaded into memory at once.

### Adjusting page_size

The default page_size is 500 (same as client-go).

| Cluster Scale | Recommendation | Reason |
|---------------|----------------|--------|
| Small (hundreds) | Larger (1000+) | Fewer API calls |
| Large (tens of thousands) | Smaller (100~300) | Reduced memory peak |

```rust
let wc = watcher::Config::default().page_size(100);
```

## Reflector Optimization

### Removing Unnecessary Fields

Removing unnecessary fields from objects cached in the [Reflector and Store](../runtime-internals/reflector-and-store.md) saves memory.

```rust
use kube::runtime::WatchStreamExt;

let stream = watcher(api, wc)
    .default_backoff()
    .modify(|obj| {
        // Remove managedFields — significant memory savings
        obj.managed_fields_mut().clear();
        // last-applied-configuration annotation — large annotation from pre-SSA approach
        obj.annotations_mut()
            .remove("kubectl.kubernetes.io/last-applied-configuration");
    });
```

:::warning[modify is applied before storing in the Store]
Fields removed by `modify` will also be inaccessible in the reconciler. Be careful not to remove fields that the reconciler needs.
:::

### Memory Estimation

Estimate memory based on the number of objects cached in the Store and their average size:

| Item | Calculation |
|------|-------------|
| Base usage | object count x average size |
| re-list spike | old store + new buffer + stream buffer = up to 2-3x |

You can verify actual memory usage patterns with jemalloc and `MALLOC_CONF="prof:true"` heap profiling.

## Reconciler Optimization

### Preventing Unnecessary Reconciles

As discussed in [Reconciler Patterns](../patterns/reconciler.md), prevent self-triggering caused by status changes.

```rust
use kube::runtime::{predicates, watcher, WatchStreamExt};
use kube::runtime::utils::predicate::PredicateConfig;

// Apply predicate_filter to the watcher stream, then inject into the Controller
let (reader, writer) = reflector::store();
let stream = reflector(writer, watcher(api.clone(), wc))
    .applied_objects()
    .predicate_filter(predicates::generation, PredicateConfig::default());

Controller::for_stream(stream, reader)
```

Events where only the status changed are filtered out because the `generation` does not change. If you use finalizers, combine them with `predicates::generation.combine(predicates::finalizers)`.

:::warning[predicate_filter is a stream method]
`predicate_filter()` is a method on the `WatchStreamExt` trait, not on `Controller`. It must be used with `for_stream()`.
:::

### debounce

Absorbs duplicate triggers for the same object within a short time window.

```rust
use kube::runtime::Config;

Controller::new(api, wc)
    .with_config(Config::default().debounce(Duration::from_secs(1)))
```

This is effective in cases like Deployment updates, where multiple ReplicaSet events fire in rapid succession.

### Concurrency Limits

```rust
Controller::new(api, wc)
    .with_config(Config::default().concurrency(10))
```

| Setting | Behavior |
|---------|----------|
| 0 (default) | No limit |
| N | Maximum N concurrent reconciles |

Set an appropriate value to control API server load. Concurrent reconciles for the same object are automatically prevented by the Runner in the [Controller Pipeline](../runtime-internals/controller-pipeline.md).

### Internal Reconciler Optimization

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // 1. Read from the Store (use cache instead of API calls)
    let related = ctx.store.get(&ObjectRef::new("related-name").within("ns"));

    // 2. Skip the patch if no changes are needed
    let current_cm = cm_api.get("my-cm").await?;
    if current_cm.data == desired_cm.data {
        // No patch needed — saves an API call
    } else {
        cm_api.patch("my-cm", &pp, &patch).await?;
    }

    // 3. Parallelize independent API calls
    let (secret, service) = tokio::try_join!(
        secret_api.get("my-secret"),
        svc_api.get("my-service"),
    )?;

    Ok(Action::requeue(Duration::from_secs(300)))
}
```

## Large-Scale Cluster Considerations

### Namespace Isolation

Watching only specific namespaces instead of the entire cluster can significantly reduce load.

```rust
// Entire cluster (high load)
let api = Api::<MyResource>::all(client.clone());

// Specific namespace only (low load)
let api = Api::<MyResource>::namespaced(client.clone(), "target-ns");
```

If you need to handle multiple namespaces, you can run separate Controller instances per namespace.

### re-list Memory Spikes

| Object Count | Average Size | Base Memory | re-list Peak |
|-------------|-------------|-------------|--------------|
| 1,000 | 10KB | 10MB | ~30MB |
| 10,000 | 10KB | 100MB | ~300MB |
| 100,000 | 10KB | 1GB | ~3GB |

Mitigation strategies:
- Reduce peak with StreamingList
- Reduce object size with `metadata_watcher()`
- Remove unnecessary fields with `.modify()`
- Narrow the scope with label selectors

### API Server Load

Each time you add `owns()` or `watches()`, a separate watch connection is created. Each watch maintains a persistent HTTP connection to the API server.

Where possible, use the shared reflector from the `unstable-runtime` feature to let multiple controllers share the same watch.

### Leader election

In HA deployments, only one instance among multiple should be active. For details on leader election mechanisms, third-party crates, and shutdown coordination, see [Availability](./availability.md).

## Scaling Strategies

Covers expansion strategies for when the throughput of a single instance is insufficient.

### Vertical Scaling

This is the first approach to try. Since reconciles are inherently parallel, increasing CPU/memory improves throughput.

| Adjustment | Effect |
|-----------|--------|
| Increase CPU request/limit | Increases reconciler concurrent execution capacity |
| Increase memory | Accommodates Store cache + re-list spikes |
| Increase `Config::concurrency(N)` | Scales the number of concurrent reconciles |

The limit of vertical scaling is the event throughput that a single watcher can handle. If the throughput of a single watch connection becomes the bottleneck, switch to sharding.

### Explicit Sharding

Distributes resources across multiple controller instances. Each instance watches only its assigned scope.

#### Namespace-based Sharding

The simplest approach. Each instance handles a different namespace:

```rust
// Determine the assigned namespace via environment variable
let ns = std::env::var("WATCH_NAMESPACE").unwrap_or("default".into());
let api = Api::<MyResource>::namespaced(client, &ns);
```

#### Label-based Sharding

A pattern used by FluxCD. Assign shard labels to resources, and each instance watches only its corresponding label:

```rust
// label selector per shard
let shard_id = std::env::var("SHARD_ID").unwrap_or("0".into());
let wc = watcher::Config::default()
    .labels(&format!("controller.example.com/shard={}", shard_id));
```

| Strategy | Pros | Cons |
|----------|------|------|
| Namespace-based | Simple implementation, natural isolation | Depends on number of namespaces |
| Label-based | Flexible distribution | Requires label management, duplicate reconciles during redistribution |

Combining leader election with each shard achieves both HA and horizontal scaling simultaneously. For details, see [Availability — Elected Shards](./availability.md#elected-shards--ha--horizontal-scaling).
