---
sidebar_position: 1
title: "모니터링"
description: "구조화된 로깅, 분산 트레이싱, Prometheus 메트릭 설정"
---

# 모니터링

kube 기반 컨트롤러의 관측 가능성을 확보하는 세 가지 축: 구조화된 로깅, 분산 트레이싱, 메트릭.

## 구조화된 로깅

<!--
tracing + tracing-subscriber:

tracing_subscriber::fmt()
    .with_env_filter("kube=info,my_controller=debug")
    .json() // 구조화된 JSON 로깅
    .init();

Controller가 자동 추가하는 span:
- object name, namespace
- reconcile reason (ReconcileReason)
- reconcile 성공/실패

RUST_LOG 필터링:
- kube=debug → kube 내부 HTTP 요청 로깅
- kube=trace → watch 이벤트 개별 로깅
- hyper=warn → HTTP 레벨 노이즈 억제
-->

## 분산 트레이싱

<!--
OpenTelemetry + OTLP exporter:

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

Client의 TraceLayer:
- 모든 HTTP 요청에 자동 span 추가
- span에 HTTP method, URL, 상태 코드 포함
- reconciler span과 연결 → reconcile 중 어떤 API 호출이 있었는지 추적

Jaeger/Tempo에서 시각화:
- reconcile span 하위에 list/patch/get 등 API 호출 span
-->

## 메트릭

<!--
권장 메트릭:
- reconcile_total: 총 reconcile 횟수 (성공/실패 라벨)
- reconcile_duration_seconds: reconcile 소요 시간 히스토그램
- reconcile_errors_total: 에러 횟수 (에러 타입별)
- reconcile_queue_depth: scheduler 대기 중인 항목 수

수집 패턴:
Controller::run(reconciler, error_policy, ctx)
    .for_each(|result| async {
        match result {
            Ok((obj_ref, action)) => {
                metrics.reconcile_success.inc();
            }
            Err(err) => {
                metrics.reconcile_errors.inc();
            }
        }
    })
    .await;

노출:
- actix-web 또는 axum으로 /metrics 엔드포인트
- Prometheus가 scrape
- tikv/rust-prometheus 또는 metrics + metrics-exporter-prometheus
-->

## Health check

<!--
readiness probe:
- Store가 ready인지 확인
- store.is_ready() → true면 초기 목록 로드 완료
- /readyz 엔드포인트에서 확인

liveness probe:
- reconcile 루프가 살아있는지 확인
- 마지막 성공 reconcile 시간 추적
- 일정 시간 초과하면 unhealthy

패턴: 별도 HTTP 서버를 tokio::spawn으로 실행
tokio::spawn(health_server(store.clone()));
tokio::spawn(metrics_server());
controller.run(...).await;
-->
