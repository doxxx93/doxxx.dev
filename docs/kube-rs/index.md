---
sidebar_position: 1
title: "kube-rs 개요"
description: "Rust로 Kubernetes를 다루는 kube-rs 라이브러리 실전 가이드"
---

# kube-rs 실전 가이드

## kube-rs란?

[kube-rs](https://kube.rs)는 Rust로 작성된 Kubernetes 클라이언트 라이브러리입니다. Go의 `client-go`에 대응하는 Rust 생태계의 핵심 프로젝트로, Kubernetes API와 상호작용하는 모든 기능을 제공합니다.

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

## 이 가이드의 목적

이 가이드는 kube-rs 프로젝트 멤버로서의 경험을 바탕으로 작성했습니다.

공식 문서([kube.rs](https://kube.rs), [docs.rs/kube](https://docs.rs/kube))의 단순 번역이 아닌, **학습 순서에 맞춘 실전 경험 가이드**를 지향합니다.

### 다루는 내용

| 섹션 | 내용 |
|------|------|
| [시작하기](getting-started/prerequisites.md) | Rust 툴체인 설정, 첫 API 호출, 크레이트 구조 이해 |
| 핵심 개념 | Api, Client, watcher, reflector 등 핵심 타입 |
| 컨트롤러 만들기 | reconciler 패턴, CRD 정의, 에러 처리 |
| 프로덕션 운영 | 모니터링, 성능 튜닝, 트러블슈팅 |

## 대상 독자

- Rust 기본 문법을 알고 있는 개발자
- Kubernetes의 기본 개념(Pod, Deployment, Namespace 등)을 이해하는 개발자
- Go `client-go`를 쓰다가 Rust로 전환하려는 개발자
- Kubernetes Operator를 Rust로 만들어보고 싶은 개발자

## 참고 자료

- [kube.rs](https://kube.rs) — 공식 홈페이지
- [docs.rs/kube](https://docs.rs/kube) — API 레퍼런스
- [kube-rs GitHub](https://github.com/kube-rs/kube) — 소스 코드 및 예제
