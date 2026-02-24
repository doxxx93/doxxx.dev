---
sidebar_position: 1
title: "kube"
description: "Rust Kubernetes 클라이언트 라이브러리"
---

# kube

Rust로 작성된 Kubernetes 클라이언트 라이브러리. Go의 [client-go](https://github.com/kubernetes/client-go)에 대응하며, [CNCF Sandbox](https://www.cncf.io/projects/) 프로젝트로 호스팅되고 있다.

```rust
use kube::{Api, Client};
use k8s_openapi::api::core::v1::Pod;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let client = Client::try_default().await?;
    let pods: Api<Pod> = Api::default_namespaced(client);

    for pod in pods.list(&Default::default()).await? {
        println!("{}", pod.metadata.name.unwrap_or_default());
    }
    Ok(())
}
```

## 목차

| 섹션 | 내용 |
|------|------|
| [시작하기](getting-started/prerequisites.md) | 환경 설정, 첫 API 호출, 크레이트 구조 |
| 핵심 개념 | Api, Client, watcher, reflector |
| 컨트롤러 | reconciler 패턴, CRD, 에러 처리 |
| 운영 | 모니터링, 성능, 트러블슈팅 |

## 참고

- [kube.rs](https://kube.rs) — 공식 사이트
- [docs.rs/kube](https://docs.rs/kube) — API 레퍼런스
- [GitHub](https://github.com/kube-rs/kube) — 소스 코드
