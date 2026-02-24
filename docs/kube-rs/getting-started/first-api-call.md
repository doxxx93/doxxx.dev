---
sidebar_position: 2
title: "첫 API 호출"
description: "kube-rs로 Kubernetes API를 호출하여 Pod 목록을 조회하는 첫 번째 예제"
---

# 첫 API 호출

kube-rs를 사용해서 Kubernetes 클러스터의 Pod 목록을 조회해봅니다.

## 전체 코드

먼저 전체 코드를 보고, 각 부분을 하나씩 살펴봅니다.

```rust title="src/main.rs"
use k8s_openapi::api::core::v1::Pod;
use kube::{Api, Client, api::ListParams};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Client 생성 — kubeconfig를 자동으로 읽음
    let client = Client::try_default().await?;

    // 2. Api 핸들 생성 — 어떤 리소스를, 어떤 네임스페이스에서 다룰지 결정
    let pods: Api<Pod> = Api::default_namespaced(client);

    // 3. Pod 목록 조회
    let pod_list = pods.list(&ListParams::default()).await?;

    // 4. 결과 출력
    println!("현재 네임스페이스의 Pod 목록:");
    for pod in pod_list {
        let name = pod.metadata.name.unwrap_or_default();
        let status = pod
            .status
            .and_then(|s| s.phase)
            .unwrap_or_else(|| "Unknown".to_string());
        println!("  - {name} ({status})");
    }

    Ok(())
}
```

```bash
cargo run
```

## 코드 분석

### Client: 클러스터 연결

```rust
let client = Client::try_default().await?;
```

`Client::try_default()`는 다음 순서로 설정을 찾습니다:

1. **In-cluster 설정** — Pod 안에서 실행 중이면 ServiceAccount 토큰 사용
2. **kubeconfig** — `KUBECONFIG` 환경변수 또는 `~/.kube/config`

:::tip
`kubectl`이 정상 동작하는 환경이면 `Client::try_default()`도 동일하게 동작합니다. 별도 설정이 필요 없습니다.
:::

### Api: 리소스 핸들

```rust
let pods: Api<Pod> = Api::default_namespaced(client);
```

`Api<K>`는 특정 Kubernetes 리소스에 대한 CRUD 작업을 수행하는 핸들입니다. 타입 파라미터 `K`로 리소스 종류를 지정합니다.

| 메서드 | 스코프 | 예시 |
|--------|--------|------|
| `Api::default_namespaced(client)` | kubeconfig의 현재 네임스페이스 | 기본 네임스페이스의 Pod |
| `Api::namespaced(client, "prod")` | 지정 네임스페이스 | `prod` 네임스페이스의 Pod |
| `Api::all(client)` | 모든 네임스페이스 | 클러스터 전체 Pod |

### ListParams: 조회 조건

```rust
let pod_list = pods.list(&ListParams::default()).await?;
```

`ListParams`로 조회 조건을 세밀하게 제어할 수 있습니다:

```rust
use kube::api::ListParams;

// label selector로 필터링
let lp = ListParams::default()
    .labels("app=myapp")
    .fields("status.phase=Running");

let running_pods = pods.list(&lp).await?;
```

## 다른 리소스 조회하기

`Api<K>`의 타입 파라미터만 바꾸면 어떤 Kubernetes 리소스든 동일한 패턴으로 다룰 수 있습니다.

```rust
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::api::core::v1::{Service, Namespace};

// Deployment 목록
let deployments: Api<Deployment> = Api::default_namespaced(client.clone());
let deploy_list = deployments.list(&ListParams::default()).await?;

// Service 목록
let services: Api<Service> = Api::default_namespaced(client.clone());
let svc_list = services.list(&ListParams::default()).await?;

// Namespace 목록 (클러스터 스코프 리소스)
let namespaces: Api<Namespace> = Api::all(client.clone());
let ns_list = namespaces.list(&ListParams::default()).await?;
```

:::tip
`client.clone()`은 가볍습니다. 내부적으로 `Arc`를 사용하므로 참조 카운트만 증가합니다. 여러 `Api` 핸들에서 자유롭게 공유하세요.
:::

## CRUD 작업

`Api<K>`는 목록 조회 외에도 생성, 읽기, 수정, 삭제를 지원합니다.

```rust
use kube::api::PostParams;

// 단일 Pod 조회
let pod = pods.get("my-pod").await?;

// Pod 삭제
pods.delete("my-pod", &Default::default()).await?;
```

:::warning
이 예제에서는 다루지 않지만, `create`나 `patch` 작업 시에는 실제 클러스터 리소스가 변경됩니다. 프로덕션 클러스터에서 테스트할 때는 주의하세요.
:::

## 다음 단계

API 호출의 기본을 익혔으니, [프로젝트 구조](./project-structure)에서 kube-rs를 구성하는 크레이트들의 역할과 관계를 살펴봅니다.
