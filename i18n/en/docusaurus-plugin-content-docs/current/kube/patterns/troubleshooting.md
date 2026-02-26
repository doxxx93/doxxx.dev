---
sidebar_position: 7
title: "Troubleshooting"
description: "Symptom-based diagnosis, debugging tools, and profiling for quick problem resolution"
---

# Troubleshooting

This section organizes common problems encountered during controller operation by symptom. Each item links to relevant detailed documentation.

## Symptom-Based Diagnosis Tables

### Reconciler Infinite Loop

**Symptom**: Reconcile call count increases endlessly and CPU usage is high.

| Cause | How to Verify | Solution |
|-------|--------------|----------|
| Writing non-deterministic values to status (timestamps, etc.) | Check with `RUST_LOG=kube=debug` that a patch occurs every reconcile | Use only deterministic values or skip the patch when nothing changed |
| predicate_filter not applied | Check reconcile logs to see if status-only changes also trigger | Apply `predicate_filter(predicates::generation)` |
| Racing with another controller (annotation ping-pong) | Check resourceVersion change patterns with `kubectl get -w` | Separate field ownership with SSA |

Details: [Reconciler Patterns — Infinite Loop](./reconciler.md#infinite-loop-patterns)

### Continuous Memory Growth

**Symptom**: Higher than expected Pod memory.

| Cause | How to Verify | Solution |
|-------|--------------|----------|
| Re-list spikes | Check for periodic spikes in memory graph | Use `streaming_lists()`, or reduce `page_size` |
| Large objects in Store cache | Check Store size with jemalloc profiling | Remove managedFields etc. with `.modify()`, use `metadata_watcher()` |
| Watch scope too broad | Check cached object count with Store's `state().len()` | Narrow scope with label/field selectors |

Details: [Optimization — Reflector optimization](../production/optimization.md#reflector-optimization), [Optimization — re-list memory spikes](../production/optimization.md#re-list-memory-spikes)

### Watch Connection Not Recovering After Disconnect

**Symptom**: Controller appears stuck, not receiving any events.

| Cause | How to Verify | Solution |
|-------|--------------|----------|
| 410 Gone + bookmarks not configured | Check logs for `WatchError` 410 | watcher auto-re-lists with `default_backoff()` |
| Credential expiration | Check logs for 401/403 errors | Verify `Config::infer()` auto-refreshes, check exec plugin configuration |
| RBAC / NetworkPolicies | Log shows 403 Forbidden | Add watch/list permissions to ClusterRole; check NetworkPolicy allows egress to API server |
| Backoff not configured | Stream terminates on first error | Always use `.default_backoff()` |

Details: [Watcher State Machine](../runtime-internals/watcher.md), [Error Handling and Backoff — Watcher errors](./error-handling-and-backoff.md#watcher-errors-and-backoff)

### API Server Throttling (429)

**Symptom**: `429 Too Many Requests` errors appear frequently in logs.

| Cause | How to Verify | Solution |
|-------|--------------|----------|
| Too many concurrent reconciles | Check active reconcile count in metrics | Set `Config::concurrency(N)` |
| Too many watch connections | Check number of `owns()`, `watches()` calls | Share watches with a shared reflector |
| Too many API calls in reconciler | Check HTTP request count in tracing spans | Leverage Store cache; batch where possible |

Details: [Optimization — Reconciler optimization](../production/optimization.md#reconciler-optimization), [Optimization — API server load](../production/optimization.md#api-server-load)

### Finalizer Deadlock (Permanently Terminating)

**Symptom**: Resource is permanently stuck in `Terminating` state.

| Cause | How to Verify | Solution |
|-------|--------------|----------|
| cleanup function failing | Check cleanup errors in logs; monitor via `error_policy` metrics | Design cleanup to eventually succeed (treat missing external resources as success) |
| predicate_filter blocking finalizer events | Check if only `predicates::generation` is used | Use `predicates::generation.combine(predicates::finalizers)` |
| Controller is down | Check Pod status | Automatically handled after controller recovery |

Emergency release: `kubectl patch <resource> -p '{"metadata":{"finalizers":null}}' --type=merge` (skips cleanup)

Details: [Relations and Finalizers — Caveats](./relations-and-finalizers.md#caveats)

### Reconciler Not Running

**Symptom**: Reconciler logs are not printed even when resources change.

| Cause | How to Verify | Solution |
|-------|--------------|----------|
| Store not yet initialized (advanced; only with streams interface) | Readiness probe failing | Verify behavior after `wait_until_ready()` |
| predicate_filter blocking all events | Check predicate logic | Adjust predicate combination or temporarily remove for testing |
| Insufficient RBAC permissions | Check logs for 403 Forbidden | Add watch/list permissions to ClusterRole |
| NetworkPolicies blocking API server access | Connection timeouts in logs | Check NetworkPolicy allows egress to API server |
| watcher Config selector too narrow | Verify matches with `kubectl get -l <selector>` | Adjust selector |

## Debugging Tools

### RUST_LOG Configuration

```bash
# Basic debugging: kube internals + controller logic
RUST_LOG=kube=debug,my_controller=debug

# Inspect individual watch events (very verbose)
RUST_LOG=kube=trace

# Check HTTP request level
RUST_LOG=kube=debug,tower_http=debug

# Suppress noise
RUST_LOG=kube=warn,hyper=warn,my_controller=info
```

### Using tracing Spans

Check `object.ref` and `object.reason` in the spans automatically generated by the Controller. Enabling JSON logging allows structured searching.

```bash
# Filter reconcile logs for a specific resource
cat logs.json | jq 'select(.span.object_ref | contains("my-resource-name"))'
```

Details: [Monitoring — Structured logging](../production/observability.md#structured-logging)

### Checking State with kubectl

```bash
# Check resource status and events
kubectl describe myresource <name>

# Track changes in real-time with watch mode
kubectl get myresource -w

# Check resourceVersion change pattern (infinite loop diagnosis)
kubectl get myresource <name> -o jsonpath='{.metadata.resourceVersion}' -w

# Check finalizer state
kubectl get myresource <name> -o jsonpath='{.metadata.finalizers}'
```

## Profiling

### Memory Profiling (jemalloc)

```toml
[dependencies]
tikv-jemallocator = { version = "*", features = ["profiling"] }
```

```rust
#[global_allocator]
static ALLOC: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;
```

```bash
# Enable heap profiling
MALLOC_CONF="prof:true,prof_active:true,lg_prof_interval:30" ./my-controller

# Analyze profile dumps
jeprof --svg ./my-controller jeprof.*.heap > heap.svg
```

Objects cached in the Store often account for the majority of memory. If the profile shows large `AHashMap`-related allocations, apply `.modify()` or `metadata_watcher()`.

### Async Runtime Profiling (tokio-console)

Check whether slow reconciler performance is caused by async task scheduling.

```toml
[dependencies]
console-subscriber = "*"
```

```rust
// Add at the top of the main function
console_subscriber::init();
```

```bash
# Connect with the tokio-console client
tokio-console http://localhost:6669
```

You can monitor per-task poll time, waker count, and wait time in real time. If a reconciler task is blocked for a long time, the cause may be synchronous operations or slow API calls inside it.

For lightweight runtime metrics without the TUI, consider [tokio-metrics](https://github.com/tokio-rs/tokio-metrics) which can export to Prometheus.
