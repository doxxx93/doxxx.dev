---
sidebar_position: 4
title: "요청의 여정"
description: "pods.list() 한 줄이 어떤 코드 경로를 거치는지 추적"
---

# 요청의 여정

`pods.list()` 한 줄 호출이 내부적으로 어떤 코드를 거쳐 Kubernetes API 서버에 도달하고 응답이 돌아오는지 추적한다.

## 호출 코드

```rust
let pods: Api<Pod> = Api::default_namespaced(client);
let list = pods.list(&ListParams::default()).await?;
```

## Api\<K\> 내부

<!--
Api<K> 구조:
pub struct Api<K> {
    request: kube_core::Request,  // URL path builder
    client: Client,
    namespace: Option<String>,
    _phantom: std::iter::Empty<K>, // PhantomData 대신 — Send 안전
}

list() 호출 흐름:
1. self.request.list(&lp) → http::Request<Vec<u8>> 생성
2. URL 조립: /api/v1/namespaces/{ns}/pods?limit=...&labelSelector=...
3. 요청에 extension 추가 ("list" 문자열 — 트레이싱용)
4. self.client.request::<ObjectList<Pod>>(req).await
-->

## kube-core::Request — URL 빌더

<!--
- url_path를 들고 있는 순수한 빌더
- list(), get(), create(), watch() 등 메서드마다 적절한 HTTP 메서드 + 쿼리 파라미터 조립
- 실제 네트워크 전송 없음 — 순수 함수
- 결과는 http::Request<Vec<u8>>
-->

## Client를 통한 요청 실행

<!--
Client::request::<T>(req):
1. send(req) → Tower 스택 통과 → Response<Body>
2. handle_api_errors(): 상태 코드 확인
   - 4xx/5xx → Response body를 Status로 파싱 → Error::Api { status }
   - 200~299 → 정상 처리
3. Response body를 bytes로 수집
4. serde_json::from_slice::<T>() → ObjectList<Pod>
5. 반환

에러 분기:
- 네트워크 에러 → Error::HyperError / Error::HttpError
- API 에러 → Error::Api { status: Status { code, message, reason, ... } }
- 역직렬화 에러 → Error::SerializationError
-->

## Watch 요청의 특수성

<!--
일반 요청: request → response → 완료
Watch 요청: request → response 스트림 (끊기지 않는 연결)

Client::request_events::<T>(req):
1. send(req) → Response<Body> (chunked transfer encoding)
2. Body를 AsyncBufRead로 변환
3. FramedRead + LinesCodec → 줄 단위로 분리
4. 각 줄을 serde_json::from_slice::<WatchEvent<T>>()로 파싱
5. TryStream<Item = Result<WatchEvent<T>>> 반환

WatchEvent<T>:
- Added(T), Modified(T), Deleted(T) — 실제 변경
- Bookmark { resource_version } — 진행 마커 (resourceVersion 갱신)
- Error(Status) — 서버 측 에러

이 raw stream 위에 kube-runtime의 watcher()가 상태 머신을 올림
→ 다음 섹션 runtime-internals/watcher.md에서 계속
-->
