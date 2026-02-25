---
sidebar_position: 7
title: "트러블슈팅"
description: "증상별 진단, 디버깅 도구, 프로파일링으로 문제 빠르게 해결하기"
---

# 트러블슈팅

컨트롤러 운영 중 자주 발생하는 문제를 증상별로 정리합니다. 각 항목에서 관련 상세 문서로 링크합니다.

## 증상별 진단 테이블

### Reconciler 무한 루프

**증상**: reconcile 호출 횟수가 끝없이 증가하고, CPU 사용량이 높습니다.

| 원인 | 확인 방법 | 해결책 |
|------|----------|--------|
| status에 비결정론적 값 쓰기 (타임스탬프 등) | `RUST_LOG=kube=debug`로 매 reconcile마다 patch 발생 확인 | 결정론적 값만 사용하거나 변경 없으면 patch 건너뛰기 |
| predicate_filter 미적용 | reconcile 로그에서 status-only 변경도 trigger되는지 확인 | `predicate_filter(predicates::generation)` 적용 |
| 다른 컨트롤러와 경쟁 (annotation 핑퐁) | `kubectl get -w`로 resourceVersion 변경 패턴 확인 | SSA로 필드 소유권 분리 |

자세한 내용: [Reconciler 패턴 — 무한 루프](./reconciler.md#무한-루프-패턴)

### 메모리 지속 증가

**증상**: Pod 메모리가 시간이 지남에 따라 계속 증가하고, OOMKilled 발생합니다.

| 원인 | 확인 방법 | 해결책 |
|------|----------|--------|
| re-list 스파이크 | 메모리 그래프에서 주기적 급등 패턴 확인 | `streaming_lists()` 사용, `page_size` 축소 |
| Store 캐시에 큰 객체 | jemalloc 프로파일링으로 Store 크기 확인 | `.modify()`로 managedFields 등 제거, `metadata_watcher()` |
| watch 범위가 너무 넓음 | Store의 `state().len()`으로 캐시 객체 수 확인 | label/field selector로 범위 축소 |

자세한 내용: [최적화 — Reflector 최적화](../production/optimization.md#reflector-최적화), [최적화 — re-list 메모리 스파이크](../production/optimization.md#re-list-메모리-스파이크)

### Watch 연결 끊김 복구 안 됨

**증상**: 컨트롤러가 이벤트를 받지 못하고 멈춘 것처럼 보입니다.

| 원인 | 확인 방법 | 해결책 |
|------|----------|--------|
| 410 Gone + bookmark 미설정 | 로그에서 `WatchError` 410 확인 | watcher가 `default_backoff()`로 자동 re-list |
| credential 만료 | 로그에서 401/403 에러 확인 | `Config::infer()`로 자동 갱신되는지 확인, exec plugin 설정 점검 |
| backoff 미설정 | 첫 에러에 스트림 종료 | `.default_backoff()` 반드시 사용 |

자세한 내용: [Watcher state machine](../runtime-internals/watcher.md), [에러 처리와 Backoff — Watcher 에러](./error-handling-and-backoff.md#watcher-에러와-backoff)

### API 서버 Throttling (429)

**증상**: 로그에 `429 Too Many Requests` 에러가 빈번합니다.

| 원인 | 확인 방법 | 해결책 |
|------|----------|--------|
| 동시 reconcile 과다 | 메트릭에서 active reconcile 수 확인 | `Config::concurrency(N)` 설정 |
| watch 연결 과다 | `owns()`, `watches()` 수 확인 | shared reflector로 watch 공유 |
| reconciler 내 API 호출 과다 | tracing span에서 HTTP 요청 수 확인 | Store 캐시 활용, `try_join!`으로 병렬화 |

자세한 내용: [최적화 — Reconciler 최적화](../production/optimization.md#reconciler-최적화), [최적화 — API 서버 부하](../production/optimization.md#api-서버-부하)

### Finalizer 교착 (영구 Terminating)

**증상**: 리소스가 `Terminating` 상태에서 영구히 멈춥니다.

| 원인 | 확인 방법 | 해결책 |
|------|----------|--------|
| cleanup 함수 실패 | 로그에서 cleanup 에러 확인 | cleanup이 최종적으로 성공하도록 설계 (외부 리소스 없으면 성공 처리) |
| predicate_filter가 finalizer 이벤트 차단 | `predicates::generation`만 사용 시 | `predicates::generation.combine(predicates::finalizers)` |
| 컨트롤러가 다운 | Pod 상태 확인 | 컨트롤러 복구 후 자동 처리됨 |

긴급 해제: `kubectl patch <resource> -p '{"metadata":{"finalizers":null}}' --type=merge` (cleanup 건너뜀)

자세한 내용: [관계와 Finalizer — 주의사항](./relations-and-finalizers.md#주의사항)

### Reconciler가 실행되지 않음

**증상**: 리소스가 변경되어도 reconciler 로그가 출력되지 않습니다.

| 원인 | 확인 방법 | 해결책 |
|------|----------|--------|
| Store가 아직 초기화되지 않음 | readiness probe 실패 | `wait_until_ready()` 이후에 동작 확인 |
| predicate_filter가 모든 이벤트 차단 | predicate 로직 확인 | predicate 조합 수정 또는 일시 제거 후 테스트 |
| RBAC 권한 부족 | 로그에서 403 Forbidden 확인 | ClusterRole에 watch/list 권한 추가 |
| watcher Config의 selector가 너무 좁음 | `kubectl get -l <selector>`로 매칭 확인 | selector 수정 |

## 디버깅 도구

### RUST_LOG 설정

```bash
# 기본 디버깅: kube 내부 + 컨트롤러 로직
RUST_LOG=kube=debug,my_controller=debug

# watch 이벤트 개별 확인 (매우 상세)
RUST_LOG=kube=trace

# HTTP 요청 레벨 확인
RUST_LOG=kube=debug,tower_http=debug

# 노이즈 억제
RUST_LOG=kube=warn,hyper=warn,my_controller=info
```

### tracing span 활용

Controller가 자동 생성하는 span에서 `object.ref`와 `object.reason`을 확인합니다. JSON 로깅을 활성화하면 구조화된 검색이 가능합니다.

```bash
# 특정 리소스의 reconcile 로그만 필터
cat logs.json | jq 'select(.span.object_ref | contains("my-resource-name"))'
```

자세한 내용: [모니터링 — 구조화된 로깅](../production/observability.md#구조화된-로깅)

### kubectl로 상태 확인

```bash
# 리소스 상태와 이벤트 확인
kubectl describe myresource <name>

# watch 모드로 실시간 변경 추적
kubectl get myresource -w

# resourceVersion 변경 패턴 확인 (무한 루프 진단)
kubectl get myresource <name> -o jsonpath='{.metadata.resourceVersion}' -w

# finalizer 상태 확인
kubectl get myresource <name> -o jsonpath='{.metadata.finalizers}'
```

## 프로파일링

### 메모리 프로파일링 (jemalloc)

```toml
[dependencies]
tikv-jemallocator = { version = "0.6", features = ["profiling"] }
```

```rust
#[global_allocator]
static ALLOC: tikv_jemallocator::Jemalloc = tikv_jemallocator::Jemalloc;
```

```bash
# 힙 프로파일링 활성화
MALLOC_CONF="prof:true,prof_active:true,lg_prof_interval:30" ./my-controller

# 프로파일 덤프 분석
jeprof --svg ./my-controller jeprof.*.heap > heap.svg
```

Store에 캐시된 객체가 메모리의 대부분을 차지하는 경우가 많습니다. 프로파일에서 `AHashMap` 관련 할당이 크면 `.modify()`나 `metadata_watcher()`를 적용합니다.

### 비동기 런타임 프로파일링 (tokio-console)

reconciler가 느린 원인이 async 태스크 스케줄링에 있는지 확인합니다.

```toml
[dependencies]
console-subscriber = "0.4"
```

```rust
// main 함수 최상단에 추가
console_subscriber::init();
```

```bash
# tokio-console 클라이언트로 연결
tokio-console http://localhost:6669
```

태스크별 poll 시간, waker 횟수, 대기 시간을 실시간으로 확인할 수 있습니다. reconciler 태스크가 오래 blocked되어 있다면 내부의 동기 연산이나 느린 API 호출이 원인일 수 있습니다.
