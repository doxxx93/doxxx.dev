---
sidebar_position: 1
title: "Monitoring"
description: "Structured logging, distributed tracing, and Prometheus metrics setup"
---

# Monitoring

Covers the three pillars of observability for kube-based controllers: structured logging, distributed tracing, and metrics.

## Structured Logging

kube-rs uses the `tracing` crate. Use `tracing-subscriber` to configure output format and filters.

```rust
tracing_subscriber::fmt()
    .with_env_filter("kube=info,my_controller=debug")
    .json() // structured JSON logging
    .init();
```

### Spans Automatically Added by Controller

The Controller automatically creates a tracing span for each reconcile invocation. The span includes the following information:

| Field | Content |
|-------|---------|
| `object.ref` | `ObjectRef` (includes name and namespace) |
| `object.reason` | `ReconcileReason` (object updated, reconciler requested retry, etc.) |

When you call `tracing::info!()` or similar inside the reconciler, this span context is automatically included.

### RUST_LOG Filtering

```bash
# kube internal HTTP request logging
RUST_LOG=kube=debug,my_controller=info

# individual watch event logging (very verbose)
RUST_LOG=kube=trace

# suppress HTTP-level noise
RUST_LOG=kube=info,hyper=warn,tower=warn
```

In production, it is common to set `kube=warn` or higher, and only open the controller logic at `info` or `debug`.

## Distributed Tracing

By connecting OpenTelemetry with an OTLP exporter, you can visualize reconcile invocations in distributed tracing systems (Jaeger, Tempo, etc.).

```rust
use tracing_subscriber::layer::SubscriberExt;
use opentelemetry_otlp::SpanExporter;

let tracer = opentelemetry_otlp::new_pipeline()
    .tracing()
    .with_exporter(SpanExporter::builder().with_tonic().build()?)
    .install_batch(opentelemetry_sdk::runtime::Tokio)?;

let telemetry = tracing_opentelemetry::layer().with_tracer(tracer);

tracing_subscriber::registry()
    .with(telemetry)
    .with(tracing_subscriber::fmt::layer())
    .init();
```

### Client's TraceLayer

As discussed in [Client Internal Architecture](../architecture/client-and-tower-stack.md), the `TraceLayer` sits at the top of the Tower stack. Spans are automatically added to all HTTP requests.

Information included in the span:

- HTTP method (GET, PATCH, etc.)
- URL path
- Response status code
- Request duration

These HTTP spans are linked under the reconciler span, so you can directly see which API requests were made during a single reconcile invocation in the tracing UI.

### Using the #[instrument] Macro

Applying `#[instrument]` to the reconciler lets you automatically add function arguments and custom fields to the span:

```rust
use tracing::instrument;

#[instrument(skip(ctx), fields(trace_id))]
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // Record the OpenTelemetry trace_id in the current span
    Span::current().record(
        "trace_id",
        &tracing::field::display(
            opentelemetry::trace::TraceContextExt::current_with_context()
        ),
    );

    // trace_id is automatically included in subsequent tracing::info!() calls
    tracing::info!("reconciling");
    // ...
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

When using the JSON formatter in `tracing-subscriber`, the `trace_id` field is included in structured logs, allowing you to search for all related logs by trace_id in log systems (Loki, CloudWatch, etc.).

## Metrics

Metrics are collected by consuming the results of the Controller stream.

### Recommended Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `reconcile_total` | Counter | Total reconcile count (with success/failure labels) |
| `reconcile_duration_seconds` | Histogram | Reconcile duration |
| `reconcile_errors_total` | Counter | Error count (with error type labels) |
| `reconcile_queue_depth` | Gauge | Number of items pending in the scheduler |

### Collection Pattern

```rust
let metrics = ctx.metrics.clone();
Controller::new(api, wc)
    .run(reconcile, error_policy, ctx)
    .for_each(|result| {
        let metrics = metrics.clone();
        async move {
            match result {
                Ok((obj_ref, _action)) => {
                    metrics.reconcile_success.inc();
                }
                Err(err) => {
                    metrics.reconcile_errors.inc();
                }
            }
        }
    })
    .await;
```

To measure reconcile duration, measure it directly inside the reconciler function:

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    let start = std::time::Instant::now();
    let result = reconcile_inner(&obj, &ctx).await;
    ctx.metrics.reconcile_duration.observe(start.elapsed().as_secs_f64());
    result
}
```

### Exposing Metrics

Expose a `/metrics` endpoint via a separate HTTP server. Use the `prometheus` or `metrics` + `metrics-exporter-prometheus` crates.

```rust
use axum::{routing::get, Router};
use prometheus::TextEncoder;

async fn metrics_handler() -> String {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    encoder.encode_to_string(&metric_families).unwrap()
}

let app = Router::new().route("/metrics", get(metrics_handler));
```

## Health check

Expose the controller's readiness and liveness as Kubernetes probes.

### Readiness

As discussed in [Reflector and Store](../runtime-internals/reflector-and-store.md), the Store is empty on creation and only gets populated when the watcher stream is polled. The readiness probe checks whether the Store has completed its initial list load.

```rust
let (reader, writer) = reflector::store();

// Pass the reader to the health server
let health_reader = reader.clone();
tokio::spawn(async move {
    let app = Router::new()
        .route("/readyz", get(move || async move {
            match health_reader.wait_until_ready().await {
                Ok(()) => (StatusCode::OK, "ready"),
                Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "not ready"),
            }
        }));
    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    axum::serve(listener, app).await.unwrap();
});
```

### Liveness

Checks whether the reconcile loop is alive. Track the last successful reconcile time, and consider it unhealthy if a certain duration is exceeded.

```rust
use std::sync::atomic::{AtomicI64, Ordering};

struct Context {
    client: Client,
    last_reconcile: AtomicI64, // Unix timestamp
}

async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // reconcile logic...
    ctx.last_reconcile.store(
        jiff::Timestamp::now().as_second(),
        Ordering::Relaxed,
    );
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

The liveness endpoint returns 503 if the time elapsed since the last reconcile exceeds the threshold.

### Execution Structure

Run the health server and metrics server alongside the Controller:

```rust
// health + metrics server
tokio::spawn(health_and_metrics_server(reader.clone()));

// Run the Controller
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

The typical pattern is to run the HTTP server as a separate task using `tokio::spawn`, while the Controller runs on the main task.
