---
sidebar_position: 3
title: "Client 내부 구조"
description: "Tower 미들웨어 아키텍처, 인증, TLS, Config 추론 체인"
---

# Client 내부 구조

`Client`는 단순한 HTTP 클라이언트가 아닙니다. Tower 미들웨어 스택으로 구성된 레이어 아키텍처이며, Clone이 `Arc` 수준으로 가볍습니다. 내부 구조를 이해하면 타임아웃, 인증, 커스텀 미들웨어 같은 문제를 해결할 수 있습니다.

## Client의 실체

```rust
pub struct Client {
    inner: Buffer<BoxService<Request<Body>, Response<Body>, BoxError>>,
    default_ns: String,
}
```

<!--
- tower::Buffer로 감싼 type-erased Service
- Buffer 내부가 Arc → Clone은 참조 카운트 증가만
- capacity 1024: 동시에 처리할 수 있는 in-flight 요청 수
- 여러 Api<K> 핸들에서 같은 Client를 자유롭게 공유
-->

## Tower 미들웨어 스택

<!--
아래서 위로 쌓이는 레이어 (요청은 위→아래, 응답은 아래→위):

TraceLayer              — OpenTelemetry 호환 HTTP 스팬
extra_headers_layer     — impersonation 등 커스텀 헤더 추가
auth_layer              — Bearer 토큰, exec 기반 인증, 자동 토큰 갱신
DecompressionLayer      — gzip 응답 해제 (feature: gzip)
base_uri_layer          — cluster_url prefix 추가
hyper Client            — HTTP/1.1 + HTTP/2 실제 전송
TimeoutConnector        — connect/read/write 타임아웃
TLS layer               — rustls 또는 openssl
Proxy                   — SOCKS5/HTTP 프록시 (선택)
HttpConnector           — TCP 연결

각 레이어는 tower::Layer trait 구현
→ 사용자가 ClientBuilder로 커스텀 레이어 추가 가능
-->

## Config 추론 체인

<!--
Client::try_default() → Config::infer() 호출 순서:
1. kubeconfig: $KUBECONFIG 환경변수 또는 ~/.kube/config
2. in-cluster: /var/run/secrets/kubernetes.io/serviceaccount/ (토큰 + CA)
3. env vars: KUBE_RS_DEBUG_* (디버그용 오버라이드)

기본 타임아웃:
- connect: 30s
- read: 295s (watch long-polling 대응)
- write: 295s

Config의 주요 필드:
cluster_url, default_namespace, root_cert, auth_info,
connect_timeout, read_timeout, write_timeout, proxy_url,
accept_invalid_certs, tls_server_name, headers
-->

## ⚠️ read_timeout 295초 함정

<!--
read_timeout이 watch용으로 295초로 설정되어 있음
→ 이 타임아웃이 일반 GET/PUT/PATCH에도 동일하게 적용
→ 네트워크 에러 시 간단한 API 호출도 5분 가까이 블로킹

알려진 대응:
- watcher용 Client와 일반 API 호출용 Client를 분리
- tokio::time::timeout()으로 개별 호출 감싸기
- hyper 레벨에서 per-request timeout 적용이 어려운 구조적 한계
-->

## 인증 처리

<!--
auth_layer가 담당:
- 정적 토큰: Bearer token을 Authorization 헤더에 추가
- 인증서: TLS 클라이언트 인증서
- exec plugin: 외부 프로그램 호출 (AWS EKS의 aws-iam-authenticator 등)
- 토큰 갱신: 만료 전 자동 refresh

⚠️ 알려진 한계:
- watcher가 장시간 실행 중 credentials이 rotate되고 연결이 끊기면
  → 재연결 시 stale credentials 사용 → 영구 실패
  → 대응: watcher 재생성 또는 Client 재생성 로직 필요
-->

## Client 커스텀

<!--
ClientBuilder로 미들웨어 추가/교체:
- 커스텀 retry 레이어
- 커스텀 메트릭 레이어
- 별도 Client 인스턴스 생성 (다른 타임아웃, 다른 인증)

패턴: watcher용 Client(긴 timeout) vs API 호출용 Client(짧은 timeout) 분리
-->
