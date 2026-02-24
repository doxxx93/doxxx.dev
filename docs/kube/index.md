---
sidebar_position: 1
title: "kube"
description: "Rust Kubernetes 클라이언트 라이브러리 심층 가이드"
---

# kube

Rust로 작성된 Kubernetes 클라이언트 라이브러리입니다. Go의 [client-go](https://github.com/kubernetes/client-go)에 대응하며, [CNCF Sandbox](https://www.cncf.io/projects/) 프로젝트로 호스팅되고 있습니다.

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

## 이 문서에 대해

kube를 쓰고 있지만 내부가 어떻게 돌아가는지 제대로 이해하고 싶은 분을 위한 문서입니다. 단순한 사용법이 아니라, 실제 코드 구현을 따라가며 **왜 이렇게 설계되었는지**, **내부에서 어떤 일이 벌어지는지**를 다룹니다.

### 전제 조건

- Rust 기본 문법 (trait, generic, async/await)
- Kubernetes 기본 개념 (Pod, Deployment, CRD, watch, controller)

## 목차

| 섹션 | 내용 |
|------|------|
| [Architecture](./architecture/index.md) | 크레이트 구조, 타입 시스템, Client 내부, 요청 흐름 |
| [Runtime Internals](./runtime-internals/index.md) | watcher/reflector/Controller 동작 원리 |
| [Patterns](./patterns/index.md) | 올바른 사용 패턴과 흔한 실수 |
| [Production](./production/index.md) | 모니터링, 테스트, 최적화, 보안, 가용성, 검증 |

## 기본 셋업

```toml title="Cargo.toml"
[dependencies]
kube = { version = "3.0.1", features = ["runtime", "derive"] }
k8s-openapi = { version = "0.27.0", features = ["latest", "schemars"] }
schemars = "1"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
```

## 참고

- [kube.rs](https://kube.rs) — 공식 사이트
- [docs.rs/kube](https://docs.rs/kube) — API 레퍼런스
- [GitHub](https://github.com/kube-rs/kube) — 소스 코드
