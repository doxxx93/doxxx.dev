---
sidebar_position: 1
title: "모니터링"
description: "구조화된 로깅, 분산 트레이싱, Prometheus 메트릭 설정"
---

# 모니터링

kube 기반 컨트롤러의 관측 가능성을 확보하는 세 가지 축인 구조화된 로깅, 분산 트레이싱, 메트릭을 다룹니다.

## 구조화된 로깅

kube-rs는 `tracing` 크레이트를 사용합니다. `tracing-subscriber`로 출력 형식과 필터를 설정합니다.

```rust
tracing_subscriber::fmt()
    .with_env_filter("kube=info,my_controller=debug")
    .json() // 구조화된 JSON 로깅
    .init();
```

### Controller가 자동 추가하는 span

Controller는 reconcile 호출마다 tracing span을 자동으로 생성합니다. span에는 다음 정보가 포함됩니다:

| 필드 | 내용 |
|------|------|
| `object.ref` | `ObjectRef` (이름과 네임스페이스 포함) |
| `object.reason` | `ReconcileReason` (object updated, reconciler requested retry 등) |

reconciler 안에서 `tracing::info!()` 등을 호출하면 이 span 컨텍스트가 자동으로 포함됩니다.

### RUST_LOG 필터링

```bash
# kube 내부 HTTP 요청 로깅
RUST_LOG=kube=debug,my_controller=info

# watch 이벤트 개별 로깅 (매우 상세)
RUST_LOG=kube=trace

# HTTP 레벨 노이즈 억제
RUST_LOG=kube=info,hyper=warn,tower=warn
```

프로덕션에서는 `kube=warn` 이상으로 설정하고, 컨트롤러 로직만 `info` 또는 `debug`로 열어두는 것이 일반적입니다.

## 분산 트레이싱

OpenTelemetry와 OTLP exporter를 연결하면 reconcile 호출을 분산 트레이싱 시스템(Jaeger, Tempo 등)에서 시각화할 수 있습니다.

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

### Client의 TraceLayer

[Client 내부 구조](../architecture/client-and-tower-stack.md)에서 다룬 것처럼, Tower 스택의 최상위에 `TraceLayer`가 있습니다. 모든 HTTP 요청에 자동으로 span이 추가됩니다.

span에 포함되는 정보:

- HTTP method (GET, PATCH 등)
- URL path
- 응답 상태 코드
- 요청 소요 시간

reconciler span 하위에 이 HTTP span들이 연결되므로, 하나의 reconcile 호출에서 어떤 API 요청이 발생했는지 트레이싱 UI에서 직접 확인할 수 있습니다.

### #[instrument] 매크로 활용

reconciler에 `#[instrument]`를 적용하면 함수 인자와 커스텀 필드를 span에 자동으로 추가할 수 있습니다:

```rust
use tracing::instrument;

#[instrument(skip(ctx), fields(trace_id))]
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // OpenTelemetry trace_id를 현재 span에 기록
    Span::current().record(
        "trace_id",
        &tracing::field::display(
            opentelemetry::trace::TraceContextExt::current_with_context()
        ),
    );

    // 이후 tracing::info!() 등에 trace_id가 자동 포함
    tracing::info!("reconciling");
    // ...
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

`tracing-subscriber`에서 JSON 포매터를 사용하면 `trace_id` 필드가 구조화된 로그에 포함되어, 로그 시스템(Loki, CloudWatch 등)에서 trace_id로 관련 로그를 한 번에 검색할 수 있습니다.

## 메트릭

Controller 스트림의 결과를 소비하면서 메트릭을 수집합니다.

### 권장 메트릭

| 메트릭 | 타입 | 설명 |
|--------|------|------|
| `reconcile_total` | Counter | 총 reconcile 횟수 (성공/실패 라벨) |
| `reconcile_duration_seconds` | Histogram | reconcile 소요 시간 |
| `reconcile_errors_total` | Counter | 에러 횟수 (에러 타입별 라벨) |
| `reconcile_queue_depth` | Gauge | scheduler에 대기 중인 항목 수 |

### 수집 패턴

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

reconcile 소요 시간을 측정하려면 reconciler 함수 내부에서 직접 측정합니다:

```rust
async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    let start = std::time::Instant::now();
    let result = reconcile_inner(&obj, &ctx).await;
    ctx.metrics.reconcile_duration.observe(start.elapsed().as_secs_f64());
    result
}
```

### 메트릭 노출

별도 HTTP 서버로 `/metrics` 엔드포인트를 노출합니다. `prometheus` 또는 `metrics` + `metrics-exporter-prometheus` 크레이트를 사용합니다.

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

컨트롤러의 readiness와 liveness를 Kubernetes probe로 노출합니다.

### Readiness

[Reflector와 Store](../runtime-internals/reflector-and-store.md)에서 다룬 것처럼, Store는 생성 시 비어있고 watcher 스트림이 poll되어야 채워집니다. readiness probe는 Store가 초기 목록 로드를 완료했는지 확인합니다.

```rust
let (reader, writer) = reflector::store();

// reader를 health 서버에 전달
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

reconcile 루프가 살아있는지 확인합니다. 마지막 성공 reconcile 시간을 추적하고, 일정 시간을 초과하면 unhealthy로 판단합니다.

```rust
use std::sync::atomic::{AtomicI64, Ordering};

struct Context {
    client: Client,
    last_reconcile: AtomicI64, // Unix timestamp
}

async fn reconcile(obj: Arc<MyResource>, ctx: Arc<Context>) -> Result<Action, Error> {
    // reconcile 로직...
    ctx.last_reconcile.store(
        jiff::Timestamp::now().as_second(),
        Ordering::Relaxed,
    );
    Ok(Action::requeue(Duration::from_secs(300)))
}
```

liveness 엔드포인트에서는 마지막 reconcile 이후 경과 시간이 임계값을 초과하면 503을 반환합니다.

### 실행 구조

health 서버와 메트릭 서버를 Controller와 함께 실행합니다:

```rust
// health + metrics 서버
tokio::spawn(health_and_metrics_server(reader.clone()));

// Controller 실행
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

`tokio::spawn`으로 HTTP 서버를 별도 태스크로 실행하고, Controller는 메인 태스크에서 실행하는 것이 일반적인 패턴입니다.
