---
sidebar_position: 5
title: "에러 처리와 Backoff"
description: "에러 발생 지점, backoff 전략, 타임아웃 함정"
---

# 에러 처리와 Backoff

kube에서 에러는 여러 계층에서 발생한다. 어디서 어떤 에러가 나오고, 각 계층에서 어떻게 처리해야 하는지 정리한다.

## 에러 발생 지점 맵

<!--
Client::send()
  → 네트워크 에러, TLS 에러, 타임아웃
  → kube::Error::HyperError, HttpError

Api::list() / get() / patch()
  → 4xx/5xx → Status로 파싱 → kube::Error::Api { status }
  → 역직렬화 실패 → kube::Error::SerializationError

watcher()
  → watcher::Error::InitialListFailed — 초기 LIST 실패
  → watcher::Error::WatchFailed — WATCH 연결 실패
  → watcher::Error::WatchError — WATCH 중 서버 측 에러 (410 Gone 등)

Controller::run()
  → watcher 에러 (trigger 스트림에서)
  → reconciler 에러 (사용자 코드에서)
-->

## Watcher 에러와 backoff

<!--
핵심 규칙: 반드시 .default_backoff() 붙이기

let watcher_stream = watcher(api, wc)
    .default_backoff();  // ← 이거 없으면 첫 에러에 스트림 종료

.default_backoff():
- ExponentialBackoff { initial: 1s, factor: 2, max: 60s }
- 성공 이벤트 수신 시 backoff 리셋

커스텀:
.backoff(ExponentialBackoff {
    initial_interval: Duration::from_millis(500),
    max_interval: Duration::from_secs(30),
    max_elapsed_time: None, // 무한 재시도
    ..Default::default()
})

⚠️ backoff 없으면:
- 첫 에러에 스트림 종료
- Controller 전체 멈춤
- 실제 사고: tight-loop 재시도 → CPU/메모리 폭주
-->

## Reconciler 에러와 error_policy

<!--
fn error_policy(obj: Arc<MyResource>, err: &Error, ctx: Arc<Context>) -> Action {
    // 에러 종류에 따라 다른 requeue 전략
    match err {
        Error::Temporary(_) => Action::requeue(Duration::from_secs(5)),
        Error::Permanent(_) => Action::await_change(), // 재시도 안 함
    }
}

Controller::run(reconcile, error_policy, ctx)
  .for_each(|result| async { /* 로깅 등 */ })
  .await;

현재 한계:
- error_policy는 동기 함수 → async 작업(메트릭 전송 등) 불가
- 성공 시 reset 콜백 없음 → per-key backoff 직접 구현 필요
- per-key 지수 backoff: patterns/reconciler.md의 wrapper 패턴 참고
-->

## Client 레벨 재시도

<!--
현재 내장 없음. watcher만 재시도 지원.

일반 API 호출(create, patch, get)은 실패하면 그냥 에러 반환.

직접 구현 — tower::retry::Policy:
impl Policy<Request<Body>, Response<Body>, Error> for RetryPolicy {
    fn retry(&self, req, result) -> Option<...> {
        match result {
            Err(_) | Ok(res) if res.status().is_server_error() => Some(backoff),
            _ => None,
        }
    }
}

재시도 가능한 에러:
- 5xx (서버 에러)
- 타임아웃
- 네트워크 연결 실패
- 429 Too Many Requests

재시도 불가:
- 4xx (클라이언트 에러) — 요청 자체가 잘못됨
- 409 Conflict — SSA 충돌 → 로직 수정 필요
-->

## ⚠️ 타임아웃 전략

<!--
기본 read_timeout = 295s:
- watch long-polling 대응으로 설정됨
- 일반 GET/PUT에도 동일 적용 → 5분 블로킹

대응 1: Client 분리
let watch_client = Client::try_default().await?;
let api_client = {
    let mut config = Config::infer().await?;
    config.read_timeout = Some(Duration::from_secs(15));
    Client::try_from(config)?
};

대응 2: 개별 호출 감싸기
tokio::time::timeout(Duration::from_secs(10), api.get("name")).await??;

대응 3: Controller 내부에서는 큰 문제 아님
- Controller가 관리하는 watcher는 긴 timeout 필요
- reconciler 안에서의 API 호출만 timeout 감싸면 됨
-->
