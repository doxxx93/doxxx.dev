---
sidebar_position: 2
title: "Relations and Finalizers"
description: "How ownerReferences, watches, and the finalizer state machine work"
---

# Relations and Finalizers

This section covers how a Controller detects changes across multiple resources (owns, watches) and the finalizer mechanism that guarantees cleanup operations before resource deletion. The internal trigger mechanism of owns and watches is explained in detail in the [Controller pipeline](../runtime-internals/controller-pipeline.md#trigger-system).

## Ownership Relations — owns

```rust
controller.owns::<ConfigMap>(api, wc)
```

How it works internally:

1. Creates a separate watcher for ConfigMaps
2. When a ConfigMap changes, iterates through `metadata.ownerReferences`
3. If the parent's `kind`/`apiVersion` matches the Controller's primary resource
4. Creates a `ReconcileRequest` with the parent's `ObjectRef`

### Setting ownerReference

Set the ownerReference when creating child resources in the reconciler:

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

| Method | `controller` field | Purpose |
|--------|-------------------|---------|
| `controller_owner_ref()` | `true` | Single controller ownership. Used in Controllers. |
| `owner_ref()` | Not set | Multiple owners possible. |

### Automatic Garbage Collection

Resources with ownerReference set are automatically deleted by Kubernetes when the parent is deleted. You can choose between Foreground, Background, or Orphan via `propagationPolicy`.

## Watch Relations — watches

Use `watches` when the relationship cannot be expressed through ownerReference.

```rust
controller.watches::<Secret>(api, wc, |secret| {
    // Return the list of ObjectRefs for related primary resources from the Secret
    let name = secret.labels().get("app")?.clone();
    let ns = secret.namespace()?;
    Some(ObjectRef::new(&name).within(&ns))
})
```

| | owns | watches |
|---|------|---------|
| Relationship definition | Recorded in the resource's `ownerReferences` | Defined in a mapper function in code |
| Mapping | Automatic (`ownerReferences` traversal) | Manual (write a mapper function) |
| Garbage collection | Handled automatically by Kubernetes | Handle manually |
| Use case | Parent-child relationships | Reference relationships (Secret → resource) |

## Finalizer State Machine

Finalizers **guarantee** cleanup operations before resource deletion. A `Delete` watch event can be lost due to network disconnection, but with a finalizer, Kubernetes delays the deletion, ensuring cleanup operations run reliably.

```mermaid
stateDiagram-v2
    state "No finalizer\nNot deleting" as S1
    state "Finalizer present\nNot deleting" as S2
    state "Finalizer present\nDeleting" as S3
    state "No finalizer\nDeleting" as S4

    S1 --> S2 : Add finalizer via JSON Patch
    S2 --> S2 : Event::Apply (normal reconcile)
    S2 --> S3 : deletionTimestamp set
    S3 --> S4 : Event::Cleanup succeeds → remove finalizer
    S4 --> [*] : Kubernetes performs actual deletion
```

Four states:

| Finalizer | Deleting? | Behavior |
|-----------|----------|----------|
| Absent | No | Adds finalizer via JSON Patch |
| Present | No | `Event::Apply` → normal reconcile |
| Present | Deleting | `Event::Cleanup` → cleanup then remove finalizer |
| Absent | Deleting | Does nothing (already cleaned up) |

When removing a finalizer, the JSON Patch includes a `Test` operation. If another process has already removed the finalizer, the Patch will fail, preventing concurrency issues.

## Usage Pattern

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
    // Normal reconcile logic
    Ok(Action::requeue(Duration::from_secs(300)))
}

async fn cleanup(obj: Arc<MyResource>, ctx: &Context) -> Result<Action, Error> {
    // Clean up external resources
    // Once this function succeeds, the finalizer is removed
    Ok(Action::await_change())
}
```

## Caveats

### The object won't be deleted if cleanup fails

The `deletionTimestamp` is set but the finalizer remains, so Kubernetes will not perform the actual deletion. The cleanup **must be designed to eventually succeed**. If it permanently fails, you can force-delete with `kubectl delete --force`, but the cleanup operations will be skipped.

### Finalizer names must be in domain format

Use a format like `"myapp.example.com/cleanup"`. Choose a unique name to avoid conflicts with finalizers from other controllers.

### Cluster-scoped parent + namespace-scoped child

When a cluster-scoped CR owns namespace-scoped children, the parent's namespace is `None` and the child's namespace is `Some("ns")`, which can cause issues with ObjectRef matching. ownerReferences can only reference resources in the same namespace or cluster-scoped resources.

### finalizer + predicate_filter interaction

Adding/removing a finalizer does not change the `generation`. Using only `predicates::generation` will cause you to miss finalizer-related events.

```rust
// ✗ May miss finalizer events
.predicate_filter(predicates::generation)

// ✓ Also detects finalizer changes
.predicate_filter(predicates::generation.combine(predicates::finalizers))
```

## Cleanup Strategy Matrix

The cleanup method varies depending on the relationship type:

| Relationship Type | How It's Set Up | How to Clean Up | Finalizer Needed? |
|-------------------|----------------|-----------------|-------------------|
| **Owned** (owns) | Set `ownerReferences` | Kubernetes automatic GC | Usually not needed |
| **Watched** (watches) | Map via mapper function | Delete directly in reconciler | Needed |
| **External** (outside cluster) | — | Call external API in cleanup | Needed |

- **Owned**: Since `ownerReferences` are set, Kubernetes automatically deletes children when the parent is deleted. A finalizer is not needed unless you also manage external resources.
- **Watched**: There is no ownership relationship, so automatic GC does not apply. You must delete related resources directly in the finalizer's `Event::Cleanup`.
- **External**: Resources outside the cluster (DNS records, cloud load balancers, etc.) are not managed by Kubernetes, so you use a finalizer to call external APIs for cleanup before deletion.
