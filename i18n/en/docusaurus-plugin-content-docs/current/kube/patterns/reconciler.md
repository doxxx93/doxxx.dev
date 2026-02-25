---
sidebar_position: 1
title: "Reconciler Patterns"
description: "Writing idempotent reconcilers, preventing infinite loops, and Action strategies"
---

# Reconciler Patterns

The reconciler is where your business logic runs in the [Controller pipeline](../runtime-internals/controller-pipeline.md). This section covers how to correctly write a function that "observes the current state and converges toward the desired state," and what common mistakes to avoid.

## Function Signature

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // ...
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

| Parameter | Role |
|-----------|------|
| `Arc<K>` | The object retrieved from the Store. Shares a reference without cloning. |
| `Arc<Context>` | A dependency injection container. Holds Client, metrics, configuration, etc. |
| Return `Action` | The next action on success (requeue or await_change). |
| Return `Error` | On failure, passed to error_policy. |

### Context Pattern

To keep the reconciler as close to a pure function as possible, put all external dependencies in the Context.

```rust
struct Context {
    client: Client,
    metrics: Metrics,
    config: AppConfig,
}

// Running the Controller
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

This allows injecting a mock Client during tests.

## Core Principle: Idempotency

**"Calling the same reconcile 100 times must produce the same result."**

The kube-rs Controller follows a **level-triggered** design:

| Approach | Question | kube-rs |
|----------|----------|---------|
| edge-triggered | Reacts to "what **changed**" | ✗ |
| level-triggered | Looks at "what the current state **is**" and converges | ✓ |

The reason the Controller intentionally hides the trigger reason: watch events can be merged, duplicated, or lost. If you depend on "why it was called," you will not behave correctly when events are missed.

`ReconcileReason` only exists in the tracing span. It is meant for logging and debugging purposes, not for branching in reconciler logic.

## Infinite Loop Patterns

### Pattern 1: Writing non-deterministic values to status

```rust
// ✗ Don't do this
status.last_updated = Utc::now();  // Different value every time
api.patch_status("name", &pp, &patch).await?;
// → New resourceVersion → watch event → re-trigger → infinite loop
```

### Pattern 2: Racing with another controller

Your controller adds an annotation to a Deployment, the Deployment controller modifies another field, and that triggers your controller again — creating a loop.

### Prevention

**1. Use only deterministic values**

Use deterministic values like hashes or generation instead of timestamps. Skip the patch if the value hasn't changed.

```rust
// ✓ Only update when the value has changed
if current_status != desired_status {
    api.patch_status("name", &pp, &patch).await?;
}
```

**2. Use predicate_filter**

```rust
use kube::runtime::{predicates, WatchStreamExt};

// Status changes don't change the generation, so they get filtered out
let stream = watcher(api, wc)
    .default_backoff()
    .applied_objects()
    .predicate_filter(predicates::generation);

Controller::for_stream(stream, reader)
```

`predicate_filter()` is a method on the `WatchStreamExt` trait. It is not a method on `Controller`, so you apply it to the stream and then inject it via `Controller::for_stream()`.

:::warning[finalizer + generation predicate]
Adding/removing a finalizer does not change the generation either. Using only `predicates::generation` will cause you to miss finalizer-related events.

```rust
// Combine two predicates
.predicate_filter(predicates::generation.combine(predicates::finalizers))
```
:::

## Action Strategies

| Action | When to Use |
|--------|------------|
| `Action::requeue(Duration)` | When you depend on external state. When periodic checks are needed. |
| `Action::await_change()` | When you only watch your own resource + owns relations. Re-runs only on watch events. |

```rust
// Check external API status every 5 minutes
Ok(Action::requeue(Duration::from_secs(300)))

// Re-run only when a watch event arrives
Ok(Action::await_change())
```

### Strategy in error_policy

```rust
fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    tracing::error!(?err, "reconcile failed");
    Action::requeue(Duration::from_secs(5))
}
```

A fixed interval is simple, but can put load on the API server during persistent errors. Per-key exponential backoff is safer.

## Per-key Backoff Pattern

Unlike Go's controller-runtime, kube-rs does not have built-in per-key backoff. You implement it yourself using a wrapper pattern.

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
            // Reset the counter on success
            ctx.failure_counts.lock().unwrap().remove(&key);
            Ok(action)
        }
        Err(e) => {
            // Increment the counter on failure
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
    let backoff = Duration::from_secs(2u64.pow(count.min(6))); // Max 64 seconds
    Action::requeue(backoff)
}
```

## Error Handling

### Use thiserror

`Controller::run()` requires specific trait bounds on Error, so you cannot use `anyhow::Error`. Define concrete error types with `thiserror`.

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

### Transient vs. Permanent Errors

| Type | Examples | Handling |
|------|----------|---------|
| Transient | Network errors, timeouts, 429 | Requeue in `error_policy` |
| Permanent | Invalid spec, invalid configuration | Record condition in status + `Action::await_change()` |

```rust
// Permanent error: record in status and don't retry
if !is_valid_spec(&obj.spec) {
    update_status_condition(&api, &obj, "InvalidSpec", "Spec validation failed").await?;
    return Ok(Action::await_change());
}
```
