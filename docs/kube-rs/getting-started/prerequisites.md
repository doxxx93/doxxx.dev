---
sidebar_position: 1
title: "사전 준비"
description: "kube-rs 개발을 위한 Rust 툴체인과 Kubernetes 클러스터 설정"
---

# 사전 준비

kube-rs로 개발을 시작하기 전에 필요한 환경을 설정합니다.

## Rust 툴체인

### 설치

```bash
# rustup으로 Rust 설치
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 설치 확인
rustc --version
cargo --version
```

:::tip
kube-rs는 최신 stable Rust를 사용합니다. `rustup update`로 최신 버전을 유지하세요.
:::

### 추천 도구

```bash
# cargo-watch: 파일 변경 시 자동 빌드/실행
cargo install cargo-watch

# 사용 예: 코드 변경 시 자동으로 다시 실행
cargo watch -x run
```

## Kubernetes 클러스터

로컬 개발용 클러스터가 필요합니다. 다음 중 하나를 선택하세요.

| 도구 | 특징 | 추천 상황 |
|------|------|-----------|
| [kind](https://kind.sigs.k8s.io) | Docker 기반, 가벼움 | CI/CD, 빠른 테스트 |
| [minikube](https://minikube.sigs.k8s.io) | 다양한 드라이버 지원 | 로컬 개발 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop) | 내장 K8s | 이미 Docker Desktop 사용 중일 때 |

### kind 클러스터 생성

```bash
# kind 설치 (macOS)
brew install kind

# 클러스터 생성
kind create cluster --name kube-rs-dev

# kubeconfig 확인
kubectl cluster-info --context kind-kube-rs-dev
```

### kubeconfig 확인

kube-rs는 기본적으로 `~/.kube/config`를 읽습니다. `kubectl`이 정상 동작하면 kube-rs도 동일하게 동작합니다.

```bash
# 현재 컨텍스트 확인
kubectl config current-context

# 클러스터 연결 테스트
kubectl get nodes
```

## 프로젝트 생성

### 새 프로젝트 만들기

```bash
cargo new my-kube-app
cd my-kube-app
```

### Cargo.toml 설정

```toml
[package]
name = "my-kube-app"
version = "0.1.0"
edition = "2021"

[dependencies]
# kube-rs 핵심 크레이트
kube = { version = "0.98", features = ["runtime", "derive"] }
k8s-openapi = { version = "0.24", features = ["latest"] }

# 비동기 런타임
tokio = { version = "1", features = ["full"] }

# 에러 처리
anyhow = "1"

# 직렬화
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

:::warning
`k8s-openapi`의 feature flag(`latest`)는 지원할 Kubernetes 버전을 결정합니다. 특정 버전을 타겟팅해야 한다면 `v1_30` 같은 명시적 버전을 사용하세요. 자세한 내용은 [k8s-openapi 문서](https://docs.rs/k8s-openapi)를 참고하세요.
:::

### 빌드 확인

```bash
cargo build
```

첫 빌드는 의존성 컴파일 때문에 시간이 걸립니다. 이후 빌드는 증분 컴파일로 빠르게 진행됩니다.

:::tip
빌드 시간을 줄이려면 `~/.cargo/config.toml`에 링커 설정을 추가하세요:

```toml
[target.x86_64-unknown-linux-gnu]
linker = "clang"
rustflags = ["-C", "link-arg=-fuse-ld=mold"]

[target.aarch64-apple-darwin]
rustflags = ["-C", "link-arg=-fuse-ld=/opt/homebrew/bin/zld"]
```
:::

## 다음 단계

환경 설정이 완료되었으면, [첫 API 호출](./first-api-call)에서 실제로 Kubernetes API를 호출해봅니다.
