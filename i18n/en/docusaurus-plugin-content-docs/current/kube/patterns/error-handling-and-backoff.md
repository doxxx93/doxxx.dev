---
sidebar_position: 5
title: "Error Handling and Backoff"
description: "Error sources, backoff strategies, and timeout pitfalls"
---

# Error Handling and Backoff

Errors in kube occur at multiple layers. This section maps out where different errors originate and how to handle them at each layer.

## Error Source Map

```mermaid
graph TD
    A["Client::send()"] -->|"Network/TLS/Timeout"| E1["kube::Error::HyperError<br/>kube::Error::HttpError"]
    B["Api::list() / get() / patch()"] -->|"4xx/5xx"| E2["kube::Error::Api { status }"]
    B -->|"Deserialization failure"| E3["kube::Error::SerializationError"]
    C["watcher()"] -->|"Initial LIST failure"| E4["watcher::Error::InitialListFailed"]
    C -->|"WATCH connection failure"| E5["watcher::Error::WatchFailed"]
    C -->|"Server error during WATCH"| E6["watcher::Error::WatchError"]
    D["Controller::run()"] -->|"trigger stream"| C
    D -->|"User code"| E7["reconciler Error"]

    style E1 fill:#ffebee
    style E2 fill:#ffebee
    style E7 fill:#fff3e0
```

| Layer | Error Type | Cause |
|-------|-----------|-------|
| Client | `HyperError`, `HttpError` | Network, TLS, timeout |
| Api | `Error::Api { status }` | Kubernetes 4xx/5xx response |
| Api | `SerializationError` | JSON deserialization failure |
| watcher | `InitialListFailed` | Initial LIST failure |
| watcher | `WatchFailed` | WATCH connection failure |
| watcher | `WatchError` | Server error during WATCH (410 Gone, etc.) |
| Controller | reconciler Error | Raised in user code |

## Watcher Errors and Backoff

:::warning[You must attach a backoff]
```rust
// ✗ Without backoff, errors cause a tight retry loop
let stream = watcher(api, wc);

// ✓ Automatic retry with exponential backoff
let stream = watcher(api, wc).default_backoff();
```
:::

### default_backoff

Applies `ExponentialBackoff`: 800ms → 1.6s → 3.2s → ... → 30s (max). The backoff resets when a successful event is received. If no errors occur for 120 seconds, the timer also resets.

### Custom backoff

```rust
use backon::ExponentialBuilder;

let stream = watcher(api, wc).backoff(
    ExponentialBuilder::default()
        .with_min_delay(Duration::from_millis(500))
        .with_max_delay(Duration::from_secs(30)),
);
```

## Reconciler Errors and error_policy

```rust
fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    tracing::error!(?err, "reconcile failed");

    match err {
        // Transient error: retry
        Error::KubeApi(_) => Action::requeue(Duration::from_secs(5)),
        // Permanent error: don't retry
        Error::MissingField(_) => Action::await_change(),
    }
}
```

`Controller::run(reconcile, error_policy, ctx)`:
- When the reconciler returns `Err`, `error_policy` is called
- Schedules according to the `Action` returned by `error_policy`

### Current Limitations

- `error_policy` is a **synchronous function**. It cannot perform async operations (sending metrics, updating status, etc.)
- There is no success reset callback. To implement per-key backoff, you need to wrap the reconciler ([Per-key backoff pattern](./reconciler.md#per-key-backoff-pattern))

## Client-Level Retries

By default, kube-client does not retry regular API calls. When `create()`, `patch()`, `get()`, etc. fail, they return the error as-is.

Since version 3, kube provides a built-in [`RetryPolicy`](https://docs.rs/kube/latest/kube/client/retry/struct.RetryPolicy.html) that implements Tower's retry middleware. It retries on 429, 503, and 504 with exponential backoff:

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

### Retryability

| Error | Retryable | Reason |
|-------|-----------|--------|
| 5xx | Yes | Temporary server failure |
| Timeout | Yes | Temporary network issue |
| 429 Too Many Requests | Yes | Rate limit → wait and retry |
| Network error | Yes | Temporary connection failure |
| 4xx (400, 403, 404, etc.) | No | The request is wrong |
| 409 Conflict | No | SSA conflict → fix the logic |

## Timeout Strategy

If you need to guard against slow API calls in your reconciler, you can wrap individual calls with `tokio::time::timeout`:

```rust
let pod = tokio::time::timeout(
    Duration::from_secs(10),
    api.get("my-pod"),
).await??;
```

In a Controller context, stream timeouts rely internally on watcher idle timeouts and stream backoff parameters. Only individual API calls inside your reconciler typically need shorter timeouts.
